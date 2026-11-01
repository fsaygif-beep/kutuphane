import { env } from "cloudflare:workers";
import { sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { appUsers } from "../../../../db/schema";

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};
async function derivePassword(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100_000 }, key, 256);
  return toBase64(new Uint8Array(bits));
}

export async function POST(request: Request) {
  const body = await request.json() as { setupCode?: string; username?: string; password?: string };
  const expected = String((env as unknown as Record<string, unknown>).INITIAL_ADMIN_SETUP_CODE ?? "");
  const setupCode = String(body.setupCode ?? "");
  const username = String(body.username ?? "").trim().toLocaleLowerCase("tr");
  const password = String(body.password ?? "");
  if (!expected || setupCode !== expected) return Response.json({ error: "Etkinleştirme bağlantısı geçersiz." }, { status: 403 });
  if (!/^[\p{L}\p{N}._@+-]{3,80}$/u.test(username)) return Response.json({ error: "Kullanıcı adı veya e-posta geçersiz; boşluk kullanmayın." }, { status: 400 });
  if (password.length < 6) return Response.json({ error: "Parola en az 6 karakter olmalıdır." }, { status: 400 });
  const db = getDb();
  const [total] = await db.select({ count: sql<number>`count(*)` }).from(appUsers);
  if (Number(total?.count ?? 0) > 0) return Response.json({ error: "Merkez yönetici hesabı daha önce etkinleştirilmiş." }, { status: 409 });
  const salt = crypto.getRandomValues(new Uint8Array(16));
  await db.insert(appUsers).values({ schoolId: null, username, email: username.includes("@") ? username : `${username}@platform.local`, displayName: "Platform Yöneticisi", role: "platform_admin", active: 1, passwordHash: await derivePassword(password, salt), passwordSalt: toBase64(salt), passwordUpdatedAt: new Date().toISOString(), createdAt: new Date().toISOString() });
  return Response.json({ ok: true });
}
