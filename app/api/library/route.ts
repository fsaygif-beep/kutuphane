import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { books, loans, settings, students } from "../../../db/schema";

const isoDate = () => new Date().toISOString().slice(0, 10);
const plusDays = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

function failure(error: unknown) {
  console.error("library api error", error);
  return Response.json({ error: "İşlem tamamlanamadı." }, { status: 500 });
}

export async function GET() {
  try {
    const db = getDb();
    const [config] = await db.select().from(settings).where(eq(settings.id, 1));
    const studentRows = await db.select().from(students).orderBy(students.fullName);
    const bookRows = await db.select().from(books).orderBy(books.title);
    const loanRows = await db.select({
      id: loans.id, studentId: students.id, studentNo: students.studentNo,
      studentName: students.fullName, grade: students.grade, contact: students.contact,
      bookId: books.id, inventoryNo: books.inventoryNo, bookTitle: books.title,
      author: books.author, loanedAt: loans.loanedAt, dueAt: loans.dueAt,
      returnedAt: loans.returnedAt, schoolYear: loans.schoolYear,
    }).from(loans)
      .innerJoin(students, eq(loans.studentId, students.id))
      .innerJoin(books, eq(loans.bookId, books.id))
      .orderBy(desc(loans.loanedAt), desc(loans.id));
    return Response.json({
      settings: config ?? { id: 1, libraryName: "Okul Kütüphanesi", schoolYear: "2026-2027", loanDays: 15 },
      students: studentRows, books: bookRows, loans: loanRows, today: isoDate(),
    });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const db = getDb();
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");
    const now = new Date().toISOString();

    if (action === "seed") {
      await db.insert(settings).values({ id: 1, libraryName: "Atatürk Anadolu Lisesi Kütüphanesi", schoolYear: "2026-2027", loanDays: 15 }).onConflictDoNothing();
      await db.insert(students).values([
        { studentNo: "101", fullName: "Elif Yılmaz", grade: "9-A", contact: "", createdAt: now },
        { studentNo: "205", fullName: "Kerem Arslan", grade: "10-B", contact: "", createdAt: now },
        { studentNo: "312", fullName: "Zeynep Kaya", grade: "11-A", contact: "", createdAt: now },
      ]).onConflictDoNothing();
      await db.insert(books).values([
        { inventoryNo: "DN-001", isbn: "9789753638029", title: "Kürk Mantolu Madonna", author: "Sabahattin Ali", publisher: "Yapı Kredi", category: "Edebiyat", genre: "Roman", shelf: "TR-R", dewey: "813.42", pages: 160, createdAt: now },
        { inventoryNo: "DN-002", isbn: "9789750802941", title: "Saatleri Ayarlama Enstitüsü", author: "Ahmet Hamdi Tanpınar", publisher: "Dergâh", category: "Edebiyat", genre: "Roman", shelf: "TR-R", dewey: "813.42", pages: 382, createdAt: now },
        { inventoryNo: "DN-003", isbn: "9789755100296", title: "İnce Memed", author: "Yaşar Kemal", publisher: "Yapı Kredi", category: "Edebiyat", genre: "Roman", shelf: "TR-R", dewey: "813.42", pages: 436, createdAt: now },
      ]).onConflictDoNothing();
      return Response.json({ ok: true });
    }

    if (action === "addStudent") {
      const studentNo = String(body.studentNo ?? "").trim();
      const fullName = String(body.fullName ?? "").trim();
      const grade = String(body.grade ?? "").trim();
      if (!studentNo || !fullName || !grade) return Response.json({ error: "Öğrenci no, ad soyad ve sınıf zorunludur." }, { status: 400 });
      await db.insert(students).values({ studentNo, fullName, grade, contact: String(body.contact ?? "").trim(), createdAt: now });
      return Response.json({ ok: true }, { status: 201 });
    }

    if (action === "addBook") {
      const inventoryNo = String(body.inventoryNo ?? "").trim();
      const title = String(body.title ?? "").trim();
      const author = String(body.author ?? "").trim();
      if (!inventoryNo || !title || !author) return Response.json({ error: "Demirbaş no, kitap adı ve yazar zorunludur." }, { status: 400 });
      await db.insert(books).values({ inventoryNo, title, author, isbn: String(body.isbn ?? "").trim(), publisher: String(body.publisher ?? "").trim(), category: String(body.category ?? "").trim(), genre: String(body.genre ?? "").trim(), shelf: String(body.shelf ?? "").trim(), dewey: String(body.dewey ?? "").trim(), pages: Number(body.pages) || 0, createdAt: now });
      return Response.json({ ok: true }, { status: 201 });
    }

    if (action === "loan") {
      const studentId = Number(body.studentId);
      const bookId = Number(body.bookId);
      if (!studentId || !bookId) return Response.json({ error: "Öğrenci ve kitap seçmelisiniz." }, { status: 400 });
      const [active] = await db.select({ count: sql<number>`count(*)` }).from(loans).where(and(eq(loans.bookId, bookId), isNull(loans.returnedAt)));
      if (Number(active?.count ?? 0) > 0) return Response.json({ error: "Bu kitap halen ödünçte." }, { status: 409 });
      const [config] = await db.select().from(settings).where(eq(settings.id, 1));
      const loanedAt = isoDate();
      await db.insert(loans).values({ studentId, bookId, loanedAt, dueAt: plusDays(loanedAt, config?.loanDays ?? 15), schoolYear: config?.schoolYear ?? "2026-2027" });
      return Response.json({ ok: true }, { status: 201 });
    }

    if (action === "return") {
      await db.update(loans).set({ returnedAt: isoDate() }).where(and(eq(loans.id, Number(body.loanId)), isNull(loans.returnedAt)));
      return Response.json({ ok: true });
    }

    if (action === "settings") {
      const libraryName = String(body.libraryName ?? "").trim();
      const schoolYear = String(body.schoolYear ?? "").trim();
      const loanDays = Math.max(1, Number(body.loanDays) || 15);
      await db.insert(settings).values({ id: 1, libraryName, schoolYear, loanDays }).onConflictDoUpdate({ target: settings.id, set: { libraryName, schoolYear, loanDays } });
      return Response.json({ ok: true });
    }
    return Response.json({ error: "Geçersiz işlem." }, { status: 400 });
  } catch (error) { return failure(error); }
}
