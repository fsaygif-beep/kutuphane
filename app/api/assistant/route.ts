import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { books, loans, students } from "../../../db/schema";
import { getAppIdentity } from "../../authz";

const instructions = `Sen bir okul kütüphanesi asistanısın. Yalnızca kitaplar, okuma önerileri, kütüphane kullanımı ve verilen kütüphane istatistikleri hakkında cevap ver. Kapsam dışı sorulara kibarca bu konuda yardımcı olamayacağını söyle. Öğrenciye yaşına uygun, eğitsel ve güvenli içerikler öner; açık cinsellik, yoğun şiddet, nefret, kendine zarar verme veya suç işlemeyi özendiren içerikleri önerme. Kütüphanede olmayan bir kitabı varmış gibi gösterme. Kişisel iletişim bilgilerini asla açıklama. Önerileri kısa gerekçelerle Türkçe yaz.`;

export async function POST(request: Request) {
  try {
    const identity = await getAppIdentity(request);
    if (!identity)
      return Response.json(
        { error: "Asistanı kullanmak için yetkili oturum gerekir." },
        { status: 403 },
      );
    const body = (await request.json()) as {
      prompt?: string;
      studentId?: number;
    };
    if (identity.role === "student")
      body.studentId = identity.studentId ?? undefined;
    const prompt = String(body.prompt ?? "").trim();
    if (!prompt)
      return Response.json({ error: "Bir soru yazın." }, { status: 400 });
    const db = getDb();
    const catalog = await db
      .select({
        id: books.id,
        title: books.title,
        author: books.author,
        genre: books.genre,
        category: books.category,
      })
      .from(books);
    let studentContext = "Öğrenci seçilmedi.";
    if (body.studentId) {
      const [student] = await db
        .select({
          id: students.id,
          fullName: students.fullName,
          grade: students.grade,
        })
        .from(students)
        .where(eq(students.id, Number(body.studentId)));
      const history = await db
        .select({
          title: books.title,
          author: books.author,
          genre: books.genre,
        })
        .from(loans)
        .innerJoin(books, eq(loans.bookId, books.id))
        .where(eq(loans.studentId, Number(body.studentId)));
      studentContext = student
        ? `${student.fullName}, ${student.grade}. Okuma geçmişi: ${history.map((x) => `${x.title} - ${x.author} (${x.genre})`).join("; ") || "yok"}.`
        : "Öğrenci bulunamadı.";
    }
    const catalogText = catalog
      .map(
        (x) =>
          `${x.id}: ${x.title} - ${x.author} [${x.genre || x.category || "genel"}]`,
      )
      .join("\n");
    const runtime = env as unknown as { OPENAI_API_KEY?: string };
    if (!runtime.OPENAI_API_KEY) {
      const historyWords = studentContext.toLocaleLowerCase("tr");
      const ranked = [...catalog]
        .sort(
          (a, b) =>
            Number(
              historyWords.includes((b.genre || "").toLocaleLowerCase("tr")),
            ) -
            Number(
              historyWords.includes((a.genre || "").toLocaleLowerCase("tr")),
            ),
        )
        .slice(0, 5);
      return Response.json({
        answer: `Yapay zekâ bağlantısı henüz etkin değil. Katalog ve okuma geçmişine göre başlangıç önerileri:\n\n${ranked.map((x, i) => `${i + 1}. ${x.title} — ${x.author}`).join("\n") || "Katalogda önerilecek kitap bulunmuyor."}\n\nKütüphane yöneticisi OpenAI API anahtarını bağladığında daha ayrıntılı ve gerekçeli öneriler sunabilirim.`,
        mode: "catalog",
      });
    }
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${runtime.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.6",
        instructions,
        input: `Kütüphane kataloğu:\n${catalogText}\n\nÖğrenci bilgisi:\n${studentContext}\n\nKullanıcının isteği:\n${prompt}`,
        max_output_tokens: 900,
      }),
    });
    const result = (await response.json()) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
      error?: { message?: string };
    };
    if (!response.ok)
      return Response.json(
        { error: result.error?.message || "Asistan yanıt veremedi." },
        { status: 502 },
      );
    const answer =
      result.output_text ??
      result.output
        ?.flatMap((x) => x.content ?? [])
        .filter((x) => x.type === "output_text")
        .map((x) => x.text ?? "")
        .join("") ??
      "Yanıt oluşturulamadı.";
    return Response.json({ answer, mode: "ai" });
  } catch (error) {
    console.error("assistant failed", error);
    return Response.json({ error: "Asistan yanıt veremedi." }, { status: 500 });
  }
}
