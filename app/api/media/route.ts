import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { books, students } from "../../../db/schema";

const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key") ?? "";
  if (!key) return new Response("Dosya bulunamadı", { status: 404 });
  const object = await env.BUCKET.get(key);
  if (!object) return new Response("Dosya bulunamadı", { status: 404 });
  return new Response(object.body, { headers: { "Content-Type": object.httpMetadata?.contentType ?? "image/jpeg", "Cache-Control": "private, max-age=3600" } });
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const kind = String(form.get("kind") ?? "");
    const recordKey = String(form.get("recordKey") ?? "").trim();
    if (!(file instanceof File) || !allowed.has(file.type) || file.size > 5 * 1024 * 1024) {
      return Response.json({ error: "JPG, PNG veya WebP biçiminde en fazla 5 MB görsel yükleyin." }, { status: 400 });
    }
    if (!recordKey || !["student", "book"].includes(kind)) return Response.json({ error: "Geçersiz kayıt." }, { status: 400 });
    const db = getDb();
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const key = `${kind}/${recordKey}/${crypto.randomUUID()}.${extension}`;
    if (kind === "student") {
      const [row] = await db.select().from(students).where(eq(students.studentNo, recordKey));
      if (!row) return Response.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
      await env.BUCKET.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
      await db.update(students).set({ photoKey: key }).where(eq(students.id, row.id));
      if (row.photoKey) await env.BUCKET.delete(row.photoKey);
    } else {
      const [row] = await db.select().from(books).where(eq(books.inventoryNo, recordKey));
      if (!row) return Response.json({ error: "Kitap bulunamadı." }, { status: 404 });
      await env.BUCKET.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
      await db.update(books).set({ coverKey: key }).where(eq(books.id, row.id));
      if (row.coverKey) await env.BUCKET.delete(row.coverKey);
    }
    return Response.json({ ok: true, key });
  } catch (error) {
    console.error("media upload failed", error);
    return Response.json({ error: "Görsel yüklenemedi." }, { status: 500 });
  }
}
