import { normalizeGrade, validGrade, normalizePhone, validPhone } from "../../student-rules";
import { and, eq, or } from "drizzle-orm";
import { getDb } from "../../../db";
import { appUsers, membershipRequests, schools, students } from "../../../db/schema";

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

async function derivePassword(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new Uint8Array(salt), iterations: 100_000 }, key, 256);
  return toBase64(new Uint8Array(bits));
}

const normalized = (value: unknown) => String(value ?? "").trim().replace(/\s+/g, " ").toLocaleUpperCase("tr");

export async function POST(request: Request) {
  const body = await request.json() as Record<string, unknown>;
  const institutionCode = normalized(body.institutionCode);
  const city = String(body.city ?? "").trim();
  const district = String(body.district ?? "").trim();
  const schoolName = String(body.schoolName ?? "").trim();
  const fullName = String(body.fullName ?? "").trim();
  const grade = normalizeGrade(body.grade);
  const phone=normalizePhone(body.phone);
  if(!validGrade(grade))return Response.json({error:"Sınıf ve şubeyi boşluksuz yazın. Örnek: 9A, 10B, 12C."},{status:400});
  if(!validPhone(phone))return Response.json({error:"Geçerli cep telefonu girin. Örnek: 05XXXXXXXXX."},{status:400});
  const studentNo = String(body.studentNo ?? "").trim();
  const email = String(body.email ?? "").trim().toLocaleLowerCase("tr");
  const username = email;
  const password = String(body.password ?? "");
  if (![institutionCode, city, district, schoolName, fullName, grade, studentNo, email].every(Boolean) || password.length < 6)
    return Response.json({ error: "Tüm alanları doldurun; parola en az 6 karakter olmalıdır." }, { status: 400 });

  const db = getDb();
  const [school] = await db.select().from(schools).where(and(eq(schools.institutionCode, institutionCode), eq(schools.active, 1)));
  if (!school || normalized(school.city) !== normalized(city) || normalized(school.district) !== normalized(district) || normalized(school.name) !== normalized(schoolName))
    return Response.json({ error: "Kurum kodu veya okul bilgileri kayıtlarla uyuşmuyor." }, { status: 404 });

  const [student] = await db.select().from(students).where(and(eq(students.schoolId, school.id), eq(students.studentNo, studentNo),eq(students.activeMember,1)));
  if (!student || normalized(student.fullName) !== normalized(fullName) || normalizeGrade(student.grade) !== grade)
    return Response.json({ error: "Öğrenci numarası, adı soyadı veya sınıfı okul kaydıyla uyuşmuyor." }, { status: 409 });

  const [existingUser] = await db.select({ id: appUsers.id }).from(appUsers)
    .where(and(eq(appUsers.schoolId, school.id), or(eq(appUsers.username, username), eq(appUsers.email, email),eq(appUsers.studentId,student.id),eq(appUsers.phone,phone))));
  if (existingUser) return Response.json({ error: "Bu kullanıcı adı veya e-posta ile etkin bir hesap zaten var." }, { status: 409 });

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const values = {
    schoolId: school.id, username, email, phone, city, district, schoolName, fullName, grade, studentNo,
    matchedStudentId: student.id, passwordHash: await derivePassword(password, salt), passwordSalt: toBase64(salt),
    status: "pending", createdAt: new Date().toISOString(), reviewedAt: null,
  };
  await db.insert(membershipRequests).values(values).onConflictDoUpdate({
    target: [membershipRequests.schoolId, membershipRequests.email],
    set: values,
  });
  return Response.json({ ok: true });
}
