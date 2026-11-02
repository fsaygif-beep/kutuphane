import { and, eq, gt, lt } from "drizzle-orm";
import { getDb } from "../../../db";
import { appSessions, appUsers, schools, students } from "../../../db/schema";
import { isCankiriLisesi } from "../../subscription";

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};
const fromBase64 = (value: string) => {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};
async function derivePassword(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new Uint8Array(salt), iterations: 100_000 }, key, 256);
  return toBase64(new Uint8Array(bits));
}
const safeEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
};
const tokenHash = async (token: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};
const cookieToken = (request: Request) => request.headers.get("cookie")?.match(/(?:^|;\s*)library_session=([^;]+)/)?.[1];

export async function GET(request: Request) {
  const token = cookieToken(request);
  if (!token) return Response.json({ authenticated: false });
  const db = getDb();
  const [session] = await db.select({ id: appSessions.id }).from(appSessions)
    .where(and(eq(appSessions.tokenHash, await tokenHash(decodeURIComponent(token))), gt(appSessions.expiresAt, new Date().toISOString())));
  return Response.json({ authenticated: Boolean(session) });
}

export async function POST(request: Request) {
  const body = await request.json() as { email?: string; password?: string };
  const login = String(body.email ?? "").trim().toLocaleLowerCase("tr");
  const phone = login.replace(/\D/g, "").replace(/^90(?=5\d{9}$)/, "").replace(/^0(?=5\d{9}$)/, "");
  const password = String(body.password ?? "");
  const db = getDb();
  const candidates = await db.select({ id: appUsers.id, schoolId: appUsers.schoolId, username: appUsers.username, email: appUsers.email, phone: appUsers.phone, displayName: appUsers.displayName, role: appUsers.role, studentId: appUsers.studentId, active: appUsers.active, passwordHash: appUsers.passwordHash, passwordSalt: appUsers.passwordSalt, passwordUpdatedAt: appUsers.passwordUpdatedAt, createdAt: appUsers.createdAt, contact: students.contact })
    .from(appUsers).innerJoin(schools, eq(appUsers.schoolId, schools.id)).leftJoin(students, eq(appUsers.studentId, students.id))
    .where(eq(schools.active, 1));
  const normalizedPhone = (value: unknown) => String(value ?? "").replace(/\D/g, "").replace(/^90(?=5\d{9}$)/, "").replace(/^0(?=5\d{9}$)/, "");
  const schoolUsers = candidates.filter(user => user.email.toLocaleLowerCase("tr") === login || (phone.length >= 10 && [user.phone, user.contact].some((value) => normalizedPhone(value) === phone)));
  if (schoolUsers.length > 1) return Response.json({ error: "Bu e-posta veya cep telefonu birden fazla okulla eşleşiyor. Okul yöneticinizle iletişime geçin." }, { status: 409 });
  const [platformUser] = schoolUsers.length ? [] : await db.select().from(appUsers).where(and(eq(appUsers.role, "platform_admin"), eq(appUsers.email, login)));
  const user = schoolUsers[0] ?? platformUser;
  if (!user || !user.active || !user.passwordHash || !user.passwordSalt) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    return Response.json({ error: "E-posta, cep telefonu veya parola yanlış." }, { status: 401 });
  }
  const hash = await derivePassword(password, fromBase64(user.passwordSalt));
  if (!safeEqual(hash, user.passwordHash)) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    return Response.json({ error: "E-posta, cep telefonu veya parola yanlış." }, { status: 401 });
  }
  const now = new Date();
  if (user.schoolId) {
    const [school] = await db.select().from(schools).where(eq(schools.id, user.schoolId));
    if (school && !isCankiriLisesi(school.name) && !school.trialStartedAt) {
      await db.update(schools).set({ trialStartedAt: now.toISOString(), trialEndsAt: new Date(now.getTime() + 30 * 86400000).toISOString() }).where(eq(schools.id, school.id));
    }
  }
  const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  await db.delete(appSessions).where(lt(appSessions.expiresAt, now.toISOString()));
  await db.insert(appSessions).values({ tokenHash: await tokenHash(token), userId: user.id, createdAt: now.toISOString(), expiresAt: expires.toISOString() });
  return Response.json({ ok: true }, { headers: { "Set-Cookie": `library_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000` } });
}

export async function DELETE(request: Request) {
  const token = cookieToken(request);
  if (token) {
    const db = getDb();
    await db.delete(appSessions).where(eq(appSessions.tokenHash, await tokenHash(decodeURIComponent(token))));
  }
  return Response.json({ ok: true }, { headers: { "Set-Cookie": "library_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0" } });
}
