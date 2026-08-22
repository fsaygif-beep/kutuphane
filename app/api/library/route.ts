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
      settings: config ?? { id: 1, libraryName: "Okul Kütüphanesi", schoolYear: "2026-2027", loanDays: 15, theme: "forest" },
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
      await db.insert(settings).values({ id: 1, libraryName: "Atatürk Anadolu Lisesi Kütüphanesi", schoolYear: "2026-2027", loanDays: 15, theme: "forest" }).onConflictDoNothing();
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
      const [duplicate] = await db.select({ id: students.id }).from(students).where(eq(students.studentNo, studentNo));
      if (duplicate) return Response.json({ error: "Bu öğrenci numarasıyla kayıt zaten var." }, { status: 409 });
      await db.insert(students).values({ studentNo, fullName, grade, contact: String(body.contact ?? "").trim(), createdAt: now });
      return Response.json({ ok: true }, { status: 201 });
    }

    if (action === "updateStudent") {
      const id = Number(body.id);
      const studentNo = String(body.studentNo ?? "").trim();
      const fullName = String(body.fullName ?? "").trim();
      const grade = String(body.grade ?? "").trim();
      if (!id || !studentNo || !fullName || !grade) return Response.json({ error: "Zorunlu öğrenci alanları eksik." }, { status: 400 });
      const [duplicate] = await db.select({ id: students.id }).from(students).where(eq(students.studentNo, studentNo));
      if (duplicate && duplicate.id !== id) return Response.json({ error: "Bu öğrenci numarası başka bir üyeye ait." }, { status: 409 });
      await db.update(students).set({ studentNo, fullName, grade, contact: String(body.contact ?? "").trim() }).where(eq(students.id, id));
      return Response.json({ ok: true });
    }

    if (action === "deleteStudent") {
      const id = Number(body.id);
      const [active] = await db.select({ count: sql<number>`count(*)` }).from(loans).where(and(eq(loans.studentId, id), isNull(loans.returnedAt)));
      if (Number(active?.count ?? 0) > 0) return Response.json({ error: "Öğrencinin ödünçte kitabı var; önce iade alın." }, { status: 409 });
      await db.delete(students).where(eq(students.id, id));
      return Response.json({ ok: true });
    }

    if (action === "addBook") {
      const inventoryNo = String(body.inventoryNo ?? "").trim();
      const title = String(body.title ?? "").trim();
      const author = String(body.author ?? "").trim();
      if (!inventoryNo || !title || !author) return Response.json({ error: "Demirbaş no, kitap adı ve yazar zorunludur." }, { status: 400 });
      const isbn = String(body.isbn ?? "").trim();
      const [sameDn] = await db.select({ id: books.id }).from(books).where(eq(books.inventoryNo, inventoryNo));
      if (sameDn) return Response.json({ error: "Bu demirbaş numarasıyla kitap zaten var." }, { status: 409 });
      if (isbn) {
        const [sameIsbn] = await db.select({ id: books.id }).from(books).where(eq(books.isbn, isbn));
        if (sameIsbn) return Response.json({ error: "Bu ISBN numarasıyla kitap zaten var." }, { status: 409 });
      }
      await db.insert(books).values({ inventoryNo, title, author, isbn, publisher: String(body.publisher ?? "").trim(), category: String(body.category ?? "").trim(), genre: String(body.genre ?? "").trim(), shelf: String(body.shelf ?? "").trim(), dewey: String(body.dewey ?? "").trim(), pages: Number(body.pages) || 0, createdAt: now });
      return Response.json({ ok: true }, { status: 201 });
    }

    if (action === "updateBook") {
      const id = Number(body.id);
      const inventoryNo = String(body.inventoryNo ?? "").trim();
      const isbn = String(body.isbn ?? "").trim();
      const title = String(body.title ?? "").trim();
      const author = String(body.author ?? "").trim();
      if (!id || !inventoryNo || !title || !author) return Response.json({ error: "Zorunlu kitap alanları eksik." }, { status: 400 });
      const [sameDn] = await db.select({ id: books.id }).from(books).where(eq(books.inventoryNo, inventoryNo));
      if (sameDn && sameDn.id !== id) return Response.json({ error: "Bu demirbaş numarası başka bir kitaba ait." }, { status: 409 });
      if (isbn) { const [sameIsbn] = await db.select({ id: books.id }).from(books).where(eq(books.isbn, isbn)); if (sameIsbn && sameIsbn.id !== id) return Response.json({ error: "Bu ISBN başka bir kitaba ait." }, { status: 409 }); }
      await db.update(books).set({ inventoryNo, isbn, title, author, publisher: String(body.publisher ?? "").trim(), category: String(body.category ?? "").trim(), genre: String(body.genre ?? "").trim(), shelf: String(body.shelf ?? "").trim(), dewey: String(body.dewey ?? "").trim(), pages: Number(body.pages) || 0 }).where(eq(books.id, id));
      return Response.json({ ok: true });
    }

    if (action === "deleteBook") {
      const id = Number(body.id);
      const [active] = await db.select({ count: sql<number>`count(*)` }).from(loans).where(and(eq(loans.bookId, id), isNull(loans.returnedAt)));
      if (Number(active?.count ?? 0) > 0) return Response.json({ error: "Kitap ödünçte; önce iade alın." }, { status: 409 });
      await db.delete(books).where(eq(books.id, id));
      return Response.json({ ok: true });
    }

    if (action === "changeGrades") {
      const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter(Boolean) : [];
      const grade = String(body.grade ?? "").trim();
      if (!ids.length || !grade) return Response.json({ error: "Öğrenci ve yeni sınıf seçmelisiniz." }, { status: 400 });
      await db.batch(ids.map(id => db.update(students).set({ grade }).where(eq(students.id, id))));
      return Response.json({ ok: true });
    }

    if (action === "promoteGrades") {
      const all = await db.select().from(students);
      const updates = all.map(student => { const match = student.grade.match(/^(\d+)(.*)$/); if (!match) return null; const level = Number(match[1]); return level >= 12 ? null : db.update(students).set({ grade: `${level + 1}${match[2]}` }).where(eq(students.id, student.id)); }).filter(Boolean);
      if (updates.length) await db.batch(updates as Exclude<(typeof updates)[number], null>[]);
      return Response.json({ ok: true });
    }

    if (action === "deleteGrade") {
      const grade = String(body.grade ?? "").trim();
      if (!grade) return Response.json({ error: "Sınıf seçmelisiniz." }, { status: 400 });
      const members = await db.select({ id: students.id }).from(students).where(eq(students.grade, grade));
      for (const member of members) { const [active] = await db.select({ count: sql<number>`count(*)` }).from(loans).where(and(eq(loans.studentId, member.id), isNull(loans.returnedAt))); if (Number(active?.count ?? 0) > 0) return Response.json({ error: "Bu sınıfta ödünçte kitabı olan öğrenci var." }, { status: 409 }); }
      await db.delete(students).where(eq(students.grade, grade));
      return Response.json({ ok: true });
    }

    if (action === "importStudents") {
      const rows = Array.isArray(body.rows) ? body.rows as Array<Record<string, unknown>> : [];
      let inserted = 0; let skipped = 0;
      for (const row of rows.slice(0, 5000)) {
        const studentNo = String(row.studentNo ?? "").trim(); const fullName = String(row.fullName ?? "").trim(); const grade = String(row.grade ?? "").trim();
        if (!studentNo || !fullName || !grade) { skipped++; continue; }
        const [exists] = await db.select({ id: students.id }).from(students).where(eq(students.studentNo, studentNo));
        if (exists) { skipped++; continue; }
        await db.insert(students).values({ studentNo, fullName, grade, contact: String(row.contact ?? "").trim(), createdAt: now }); inserted++;
      }
      return Response.json({ ok: true, inserted, skipped });
    }

    if (action === "importBooks") {
      const rows = Array.isArray(body.rows) ? body.rows as Array<Record<string, unknown>> : [];
      let inserted = 0; let skipped = 0;
      for (const row of rows.slice(0, 5000)) {
        const inventoryNo = String(row.inventoryNo ?? "").trim(); const isbn = String(row.isbn ?? "").trim(); const title = String(row.title ?? "").trim(); const author = String(row.author ?? "").trim();
        if (!inventoryNo || !title || !author) { skipped++; continue; }
        const [sameDn] = await db.select({ id: books.id }).from(books).where(eq(books.inventoryNo, inventoryNo));
        const [sameIsbn] = isbn ? await db.select({ id: books.id }).from(books).where(eq(books.isbn, isbn)) : [];
        if (sameDn || sameIsbn) { skipped++; continue; }
        await db.insert(books).values({ inventoryNo, isbn, title, author, publisher: String(row.publisher ?? "").trim(), category: String(row.category ?? "").trim(), genre: String(row.genre ?? "").trim(), shelf: String(row.shelf ?? "").trim(), dewey: String(row.dewey ?? "").trim(), pages: Number(row.pages) || 0, createdAt: now }); inserted++;
      }
      return Response.json({ ok: true, inserted, skipped });
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
      const theme = ["forest","navy","plum","sand"].includes(String(body.theme)) ? String(body.theme) : "forest";
      await db.insert(settings).values({ id: 1, libraryName, schoolYear, loanDays, theme }).onConflictDoUpdate({ target: settings.id, set: { libraryName, schoolYear, loanDays, theme } });
      return Response.json({ ok: true });
    }
    return Response.json({ error: "Geçersiz işlem." }, { status: 400 });
  } catch (error) { return failure(error); }
}
