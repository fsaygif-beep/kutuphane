import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { getAppIdentity } from "../../authz";
import { appUsers, schoolApplications, schools, settings } from "../../../db/schema";
import { isCankiriLisesi, SUPER_ADMIN_EMAIL } from "../../subscription";

const isSuperAdmin = (identity: Awaited<ReturnType<typeof getAppIdentity>>) =>
  Boolean(
    identity?.active &&
    identity.email.toLowerCase() === SUPER_ADMIN_EMAIL &&
    (identity.role === "platform_admin" || identity.role === "admin"),
  );

const toBase64 = (bytes: Uint8Array) => {
  let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary);
};
async function derivePassword(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new Uint8Array(salt), iterations: 100_000 }, key, 256);
  return toBase64(new Uint8Array(bits));
}

export async function GET(request: Request) {
  const identity = await getAppIdentity(request);
  if (!isSuperAdmin(identity)) return Response.json({ error: "Yetkisiz erişim." }, { status: 403 });
  const db = getDb();
  const schoolRows = await db.select().from(schools).orderBy(desc(schools.id));
  const now = new Date();
  return Response.json({ access: "platform", currentUser: identity,
    applications: await db.select().from(schoolApplications).orderBy(desc(schoolApplications.id)),
    schools: schoolRows.map((school) => { const exempt = isCankiriLisesi(school.name); const premium = Boolean(school.premiumUntil && new Date(school.premiumUntil) >= now); const trial = Boolean(school.trialEndsAt && new Date(school.trialEndsAt) >= now); const end = premium ? new Date(school.premiumUntil!) : school.trialEndsAt ? new Date(school.trialEndsAt) : now; return { ...school, exempt, premium, trial, remainingDays: exempt ? null : Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000)), statusLabel: exempt ? "Süresiz tam erişim" : premium ? "Premium" : trial ? "Deneme" : "Süresi doldu" }; }),
  });
}

export async function POST(request: Request) {
  const db = getDb();
  const body = await request.json() as Record<string, unknown>;
  const action = String(body.action ?? "");
  const now = new Date().toISOString();
  if (action === "apply") {
    const city = String(body.city ?? "").trim(), district = String(body.district ?? "").trim();
    const schoolName = String(body.schoolName ?? "").trim(), institutionCode = String(body.institutionCode ?? "").trim().toLocaleUpperCase("tr");
    const adminName = String(body.adminName ?? "").trim(), adminEmail = String(body.adminEmail ?? "").trim().toLowerCase();
    const adminUsername = adminEmail, password = String(body.password ?? "");
    if (![city, district, schoolName, institutionCode, adminName, adminEmail].every(Boolean) || password.length < 6)
      return Response.json({ error: "Tüm alanları doldurun; parola en az 6 karakter olmalıdır." }, { status: 400 });
    const [existingSchool] = await db.select({ id: schools.id }).from(schools).where(eq(schools.institutionCode, institutionCode));
    if (existingSchool) return Response.json({ error: "Bu kurum kodu zaten kayıtlıdır." }, { status: 409 });
    const salt = crypto.getRandomValues(new Uint8Array(16));
    await db.insert(schoolApplications).values({ city, district, schoolName, institutionCode, adminName, adminEmail, adminUsername,
      passwordHash: await derivePassword(password, salt), passwordSalt: toBase64(salt), status: "pending", createdAt: now,
    }).onConflictDoUpdate({ target: schoolApplications.institutionCode, set: { city, district, schoolName, adminName, adminEmail, adminUsername, passwordHash: await derivePassword(password, salt), passwordSalt: toBase64(salt), status: "pending", createdAt: now, reviewedAt: null } });
    return Response.json({ ok: true });
  }
  const identity = await getAppIdentity(request);
  if (!isSuperAdmin(identity)) return Response.json({ error: "Bu işlem fsaygif@gmail.com hesabına aittir." }, { status: 403 });
  const id = Number(body.id);
  if (action === "setPremium") {
    const [school] = await db.select().from(schools).where(eq(schools.id, id));
    if (!school) return Response.json({ error: "Okul bulunamadı." }, { status: 404 });
    const premiumUntil = body.enabled ? new Date(Date.now() + 365 * 86400000).toISOString() : null;
    await db.update(schools).set({ premiumUntil }).where(eq(schools.id, id));
    return Response.json({ ok: true });
  }
  const [application] = await db.select().from(schoolApplications).where(eq(schoolApplications.id, id));
  if (!application || application.status !== "pending") return Response.json({ error: "Bekleyen başvuru bulunamadı." }, { status: 404 });
  if (action === "reject") {
    await db.update(schoolApplications).set({ status: "rejected", reviewedAt: now }).where(eq(schoolApplications.id, id));
    return Response.json({ ok: true });
  }
  if (action !== "approve") return Response.json({ error: "Geçersiz işlem." }, { status: 400 });
  const [school] = await db.insert(schools).values({ city: application.city, district: application.district, name: application.schoolName, institutionCode: application.institutionCode, active: 1, createdAt: now, trialStartedAt: null, trialEndsAt: null, premiumUntil: null }).returning();
  await db.insert(settings).values({ schoolId: school.id, city: school.city, district: school.district, schoolName: school.name, institutionCode: school.institutionCode, libraryName: `${school.name} Kütüphanesi`, schoolYear: "2026-2027" });
  await db.insert(appUsers).values({ schoolId: school.id, username: application.adminUsername, email: application.adminEmail, displayName: application.adminName, role: "admin", active: 1, passwordHash: application.passwordHash, passwordSalt: application.passwordSalt, passwordUpdatedAt: now, createdAt: now });
  await db.update(schoolApplications).set({ status: "approved", reviewedAt: now }).where(and(eq(schoolApplications.id, id), eq(schoolApplications.status, "pending")));
  return Response.json({ ok: true });
}
