import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../db";
import { canManage, getAppIdentity } from "../../authz";
import {
  appUsers,
  bookRequests,
  books,
  emailLogs,
  loans,
  membershipRequests,
  settings,
  studentChanges,
  students,
} from "../../../db/schema";

const isoDate = () => new Date().toISOString().slice(0, 10);
const plusDays = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
const authorShelf = (author: string) =>
  (author.trim().split(/\s+/).at(-1)?.[0] ?? "").toLocaleUpperCase("tr");
const normalized = (value: unknown) =>
  String(value ?? "").trim().replace(/\s+/g, " ").toLocaleUpperCase("tr");
const viewerEmail = (request: Request) =>
  (request.headers.get("oai-authenticated-user-email") ?? "").trim().toLowerCase();

function failure(error: unknown) {
  console.error("library api error", error);
  return Response.json({ error: "İşlem tamamlanamadı." }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const db = getDb();
    const [config] = await db.select().from(settings).where(eq(settings.id, 1));
    const identity = await getAppIdentity(request);
    if (!identity) {
      const email = viewerEmail(request);
      if (!email) return Response.json({ error: "Oturum bulunamadı." }, { status: 401 });
      const [pending] = await db.select().from(membershipRequests).where(eq(membershipRequests.email, email));
      return Response.json({
        access: "unregistered",
        viewerEmail: email,
        school: config ? { city: config.city, district: config.district, schoolName: config.schoolName || config.libraryName } : null,
        membershipRequest: pending ?? null,
      });
    }
    const studentRows = await db
      .select()
      .from(students)
      .orderBy(students.fullName);
    const bookRows = await db.select().from(books).orderBy(books.title);
    const loanRows = await db
      .select({
        id: loans.id,
        studentId: students.id,
        studentNo: students.studentNo,
        studentName: students.fullName,
        grade: students.grade,
        contact: students.contact,
        email: students.email,
        studentPhotoKey: students.photoKey,
        bookId: books.id,
        inventoryNo: books.inventoryNo,
        bookTitle: books.title,
        author: books.author,
        bookCoverKey: books.coverKey,
        loanedAt: loans.loanedAt,
        dueAt: loans.dueAt,
        returnedAt: loans.returnedAt,
        schoolYear: loans.schoolYear,
        renewalCount: loans.renewalCount,
      })
      .from(loans)
      .innerJoin(students, eq(loans.studentId, students.id))
      .innerJoin(books, eq(loans.bookId, books.id))
      .orderBy(desc(loans.loanedAt), desc(loans.id));
    const requestRows = await db
      .select({
        id: bookRequests.id,
        studentId: bookRequests.studentId,
        studentName: students.fullName,
        studentNo: students.studentNo,
        title: bookRequests.title,
        author: bookRequests.author,
        note: bookRequests.note,
        status: bookRequests.status,
        createdAt: bookRequests.createdAt,
      })
      .from(bookRequests)
      .innerJoin(students, eq(bookRequests.studentId, students.id))
      .orderBy(desc(bookRequests.id));
    const userRows = await db
      .select()
      .from(appUsers)
      .orderBy(appUsers.displayName);
    const membershipRows = identity.role === "admin"
      ? await db.select().from(membershipRequests).orderBy(desc(membershipRequests.id))
      : [];
    const ownStudentId =
      identity.role === "student" ? identity.studentId : null;
    return Response.json({
      access: "granted",
      settings: config ?? {
        id: 1,
        libraryName: "Okul Kütüphanesi",
        city: "",
        district: "",
        schoolName: "",
        institutionCode: "",
        schoolYear: "2026-2027",
        loanDays: 15,
        theme: "forest",
        senderName: "Okul Kütüphanesi",
        senderEmail: "",
        extensionDays: 7,
        maxRenewals: 1,
        dailyFine: 0,
        logoKey: "",
      },
      students: ownStudentId
        ? studentRows.filter((x) => x.id === ownStudentId)
        : studentRows,
      books: bookRows,
      loans: ownStudentId
        ? loanRows.filter((x) => x.studentId === ownStudentId)
        : loanRows,
      requests: ownStudentId
        ? requestRows.filter((x) => x.studentId === ownStudentId)
        : requestRows,
      users: identity.role === "admin" ? userRows : [],
      membershipRequests: membershipRows,
      currentUser: identity,
      today: isoDate(),
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const db = getDb();
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");
    const now = new Date().toISOString();
    const identity = await getAppIdentity(request);
    if (!identity && action === "submitMembershipRequest") {
      const email = viewerEmail(request);
      const [config] = await db.select().from(settings).where(eq(settings.id, 1));
      if (!email || !config) return Response.json({ error: "Okul veya oturum bilgisi bulunamadı." }, { status: 400 });
      const [student] = await db.select().from(students).where(eq(students.studentNo, String(body.studentNo ?? "").trim()));
      const matches = student &&
        normalized(body.city) === normalized(config.city) &&
        normalized(body.district) === normalized(config.district) &&
        normalized(body.schoolName) === normalized(config.schoolName || config.libraryName) &&
        normalized(body.fullName) === normalized(student.fullName) &&
        normalized(body.grade) === normalized(student.grade);
      if (!matches) return Response.json({ error: "Bilgiler okul kayıtlarıyla eşleşmedi. Lütfen okul yönetimine başvurun." }, { status: 400 });
      await db.insert(membershipRequests).values({
        email, city: String(body.city), district: String(body.district), schoolName: String(body.schoolName),
        fullName: student.fullName, grade: student.grade, studentNo: student.studentNo,
        matchedStudentId: student.id, status: "pending", createdAt: now,
      }).onConflictDoUpdate({ target: membershipRequests.email, set: {
        city: String(body.city), district: String(body.district), schoolName: String(body.schoolName),
        fullName: student.fullName, grade: student.grade, studentNo: student.studentNo,
        matchedStudentId: student.id, status: "pending", createdAt: now, reviewedAt: null,
      }});
      return Response.json({ ok: true });
    }
    if (!identity)
      return Response.json(
        { error: "Oturum veya kullanıcı yetkisi bulunamadı." },
        { status: 403 },
      );
    const adminOnly = new Set([
      "settings",
      "upsertUser",
      "deleteStudent",
      "deleteBook",
      "deleteGrade",
      "promoteGrades",
      "seed",
      "approveMembership",
      "rejectMembership",
    ]);
    if (adminOnly.has(action) && identity.role !== "admin")
      return Response.json(
        { error: "Bu işlem yalnızca yöneticilere açıktır." },
        { status: 403 },
      );
    if (
      identity.role === "student" &&
      !new Set(["addBookRequest", "noop"]).has(action)
    )
      return Response.json(
        { error: "Öğrenci hesabının bu işlem için yetkisi yoktur." },
        { status: 403 },
      );
    if (!canManage(identity) && identity.role !== "student")
      return Response.json(
        { error: "Bu işlem için yetkiniz yoktur." },
        { status: 403 },
      );

    if (action === "noop") return Response.json({ ok: true });

    if (action === "approveMembership" || action === "rejectMembership") {
      const id = Number(body.id);
      const [row] = await db.select().from(membershipRequests).where(eq(membershipRequests.id, id));
      if (!row) return Response.json({ error: "Başvuru bulunamadı." }, { status: 404 });
      if (action === "approveMembership") {
        await db.insert(appUsers).values({ email: row.email, displayName: row.fullName, role: "student", studentId: row.matchedStudentId, active: 1, createdAt: now })
          .onConflictDoUpdate({ target: appUsers.email, set: { displayName: row.fullName, role: "student", studentId: row.matchedStudentId, active: 1 } });
      }
      await db.update(membershipRequests).set({ status: action === "approveMembership" ? "approved" : "rejected", reviewedAt: now }).where(eq(membershipRequests.id, id));
      return Response.json({ ok: true });
    }

    if (action === "seed") {
      await db
        .insert(settings)
        .values({
          id: 1,
          city: "",
          district: "",
          schoolName: "Atatürk Anadolu Lisesi",
          institutionCode: "",
          libraryName: "Atatürk Anadolu Lisesi Kütüphanesi",
          schoolYear: "2026-2027",
          loanDays: 15,
          theme: "forest",
          senderName: "Okul Kütüphanesi",
          senderEmail: "",
          extensionDays: 7,
          maxRenewals: 1,
          dailyFine: 0,
        })
        .onConflictDoNothing();
      await db
        .insert(students)
        .values([
          {
            studentNo: "101",
            fullName: "Elif Yılmaz",
            grade: "9-A",
            contact: "",
            createdAt: now,
          },
          {
            studentNo: "205",
            fullName: "Kerem Arslan",
            grade: "10-B",
            contact: "",
            createdAt: now,
          },
          {
            studentNo: "312",
            fullName: "Zeynep Kaya",
            grade: "11-A",
            contact: "",
            createdAt: now,
          },
        ])
        .onConflictDoNothing();
      await db
        .insert(books)
        .values([
          {
            inventoryNo: "DN-001",
            isbn: "9789753638029",
            title: "Kürk Mantolu Madonna",
            author: "Sabahattin Ali",
            publisher: "Yapı Kredi",
            category: "Edebiyat",
            genre: "Roman",
            shelf: "TR-R",
            dewey: "813.42",
            pages: 160,
            createdAt: now,
          },
          {
            inventoryNo: "DN-002",
            isbn: "9789750802941",
            title: "Saatleri Ayarlama Enstitüsü",
            author: "Ahmet Hamdi Tanpınar",
            publisher: "Dergâh",
            category: "Edebiyat",
            genre: "Roman",
            shelf: "TR-R",
            dewey: "813.42",
            pages: 382,
            createdAt: now,
          },
          {
            inventoryNo: "DN-003",
            isbn: "9789755100296",
            title: "İnce Memed",
            author: "Yaşar Kemal",
            publisher: "Yapı Kredi",
            category: "Edebiyat",
            genre: "Roman",
            shelf: "TR-R",
            dewey: "813.42",
            pages: 436,
            createdAt: now,
          },
        ])
        .onConflictDoNothing();
      return Response.json({ ok: true });
    }

    if (action === "addStudent") {
      const studentNo = String(body.studentNo ?? "").trim();
      const fullName = String(body.fullName ?? "").trim();
      const grade = String(body.grade ?? "").trim();
      if (!studentNo || !fullName || !grade)
        return Response.json(
          { error: "Öğrenci no, ad soyad ve sınıf zorunludur." },
          { status: 400 },
        );
      const [duplicate] = await db
        .select({ id: students.id })
        .from(students)
        .where(eq(students.studentNo, studentNo));
      if (duplicate)
        return Response.json(
          { error: "Bu öğrenci numarasıyla kayıt zaten var." },
          { status: 409 },
        );
      await db.insert(students).values({
        studentNo,
        fullName,
        grade,
        contact: String(body.contact ?? "").trim(),
        email: String(body.email ?? "").trim(),
        createdAt: now,
      });
      return Response.json({ ok: true }, { status: 201 });
    }

    if (action === "updateStudent") {
      const id = Number(body.id);
      const studentNo = String(body.studentNo ?? "").trim();
      const fullName = String(body.fullName ?? "").trim();
      const grade = String(body.grade ?? "").trim();
      if (!id || !studentNo || !fullName || !grade)
        return Response.json(
          { error: "Zorunlu öğrenci alanları eksik." },
          { status: 400 },
        );
      const [duplicate] = await db
        .select({ id: students.id })
        .from(students)
        .where(eq(students.studentNo, studentNo));
      if (duplicate && duplicate.id !== id)
        return Response.json(
          { error: "Bu öğrenci numarası başka bir üyeye ait." },
          { status: 409 },
        );
      await db
        .update(students)
        .set({
          studentNo,
          fullName,
          grade,
          contact: String(body.contact ?? "").trim(),
          email: String(body.email ?? "").trim(),
          blocked: body.blocked ? 1 : 0,
          blockReason: body.blocked
            ? String(body.blockReason ?? "").trim()
            : "",
        })
        .where(eq(students.id, id));
      return Response.json({ ok: true });
    }

    if (action === "deleteStudent") {
      const id = Number(body.id);
      const [active] = await db
        .select({ count: sql<number>`count(*)` })
        .from(loans)
        .where(and(eq(loans.studentId, id), isNull(loans.returnedAt)));
      if (Number(active?.count ?? 0) > 0)
        return Response.json(
          { error: "Öğrencinin ödünçte kitabı var; önce iade alın." },
          { status: 409 },
        );
      await db.delete(students).where(eq(students.id, id));
      return Response.json({ ok: true });
    }

    if (action === "addBook") {
      const inventoryNo = String(body.inventoryNo ?? "").trim();
      const title = String(body.title ?? "").trim();
      const author = String(body.author ?? "").trim();
      if (!inventoryNo || !title || !author)
        return Response.json(
          { error: "Demirbaş no, kitap adı ve yazar zorunludur." },
          { status: 400 },
        );
      const isbn = String(body.isbn ?? "").trim();
      const [sameDn] = await db
        .select({ id: books.id })
        .from(books)
        .where(eq(books.inventoryNo, inventoryNo));
      if (sameDn)
        return Response.json(
          { error: "Bu demirbaş numarasıyla kitap zaten var." },
          { status: 409 },
        );
      if (isbn) {
        const [sameIsbn] = await db
          .select({ id: books.id })
          .from(books)
          .where(eq(books.isbn, isbn));
        if (sameIsbn)
          return Response.json(
            { error: "Bu ISBN numarasıyla kitap zaten var." },
            { status: 409 },
          );
      }
      await db.insert(books).values({
        inventoryNo,
        title,
        author,
        isbn,
        publisher: String(body.publisher ?? "").trim(),
        category: String(body.category ?? "").trim(),
        genre: String(body.genre ?? "").trim(),
        shelf: String(body.shelf ?? "").trim() || authorShelf(author),
        dewey: String(body.dewey ?? "").trim(),
        pages: Number(body.pages) || 0,
        createdAt: now,
      });
      return Response.json({ ok: true }, { status: 201 });
    }

    if (action === "updateBook") {
      const id = Number(body.id);
      const inventoryNo = String(body.inventoryNo ?? "").trim();
      const isbn = String(body.isbn ?? "").trim();
      const title = String(body.title ?? "").trim();
      const author = String(body.author ?? "").trim();
      if (!id || !inventoryNo || !title || !author)
        return Response.json(
          { error: "Zorunlu kitap alanları eksik." },
          { status: 400 },
        );
      const [sameDn] = await db
        .select({ id: books.id })
        .from(books)
        .where(eq(books.inventoryNo, inventoryNo));
      if (sameDn && sameDn.id !== id)
        return Response.json(
          { error: "Bu demirbaş numarası başka bir kitaba ait." },
          { status: 409 },
        );
      if (isbn) {
        const [sameIsbn] = await db
          .select({ id: books.id })
          .from(books)
          .where(eq(books.isbn, isbn));
        if (sameIsbn && sameIsbn.id !== id)
          return Response.json(
            { error: "Bu ISBN başka bir kitaba ait." },
            { status: 409 },
          );
      }
      await db
        .update(books)
        .set({
          inventoryNo,
          isbn,
          title,
          author,
          publisher: String(body.publisher ?? "").trim(),
          category: String(body.category ?? "").trim(),
          genre: String(body.genre ?? "").trim(),
          shelf: String(body.shelf ?? "").trim() || authorShelf(author),
          dewey: String(body.dewey ?? "").trim(),
          pages: Number(body.pages) || 0,
        })
        .where(eq(books.id, id));
      return Response.json({ ok: true });
    }

    if (action === "deleteBook") {
      const id = Number(body.id);
      const [active] = await db
        .select({ count: sql<number>`count(*)` })
        .from(loans)
        .where(and(eq(loans.bookId, id), isNull(loans.returnedAt)));
      if (Number(active?.count ?? 0) > 0)
        return Response.json(
          { error: "Kitap ödünçte; önce iade alın." },
          { status: 409 },
        );
      await db.delete(books).where(eq(books.id, id));
      return Response.json({ ok: true });
    }

    if (action === "changeGrades") {
      const ids = Array.isArray(body.ids)
        ? body.ids.map(Number).filter(Boolean)
        : [];
      const grade = String(body.grade ?? "").trim();
      if (!ids.length || !grade)
        return Response.json(
          { error: "Öğrenci ve yeni sınıf seçmelisiniz." },
          { status: 400 },
        );
      await db.batch(
        ids.map((id) =>
          db.update(students).set({ grade }).where(eq(students.id, id)),
        ),
      );
      return Response.json({ ok: true });
    }

    if (action === "promoteGrades") {
      const all = await db.select().from(students);
      const updates = all
        .map((student) => {
          const match = student.grade.match(/^(\d+)(.*)$/);
          if (!match) return null;
          const level = Number(match[1]);
          return level >= 12
            ? null
            : db
                .update(students)
                .set({ grade: `${level + 1}${match[2]}` })
                .where(eq(students.id, student.id));
        })
        .filter(Boolean);
      if (updates.length)
        await db.batch(updates as Exclude<(typeof updates)[number], null>[]);
      return Response.json({ ok: true });
    }

    if (action === "deleteGrade") {
      const grade = String(body.grade ?? "").trim();
      if (!grade)
        return Response.json({ error: "Sınıf seçmelisiniz." }, { status: 400 });
      const members = await db
        .select({ id: students.id })
        .from(students)
        .where(eq(students.grade, grade));
      for (const member of members) {
        const [active] = await db
          .select({ count: sql<number>`count(*)` })
          .from(loans)
          .where(and(eq(loans.studentId, member.id), isNull(loans.returnedAt)));
        if (Number(active?.count ?? 0) > 0)
          return Response.json(
            { error: "Bu sınıfta ödünçte kitabı olan öğrenci var." },
            { status: 409 },
          );
      }
      await db.delete(students).where(eq(students.grade, grade));
      return Response.json({ ok: true });
    }

    if (action === "importStudents") {
      const rows = Array.isArray(body.rows)
        ? (body.rows as Array<Record<string, unknown>>)
        : [];
      let inserted = 0;
      let skipped = 0;
      for (const row of rows.slice(0, 5000)) {
        const studentNo = String(row.studentNo ?? "").trim();
        const fullName = String(row.fullName ?? "").trim();
        const grade = String(row.grade ?? "").trim();
        if (!studentNo || !fullName || !grade) {
          skipped++;
          continue;
        }
        const [exists] = await db
          .select({ id: students.id })
          .from(students)
          .where(eq(students.studentNo, studentNo));
        if (exists) {
          skipped++;
          continue;
        }
        await db.insert(students).values({
          studentNo,
          fullName,
          grade,
          contact: String(row.contact ?? "").trim(),
          email: String(row.email ?? "").trim(),
          createdAt: now,
        });
        inserted++;
      }
      return Response.json({ ok: true, inserted, skipped });
    }

    if (action === "syncStudents") {
      const rows = Array.isArray(body.rows)
        ? (body.rows as Array<Record<string, unknown>>)
        : [];
      let inserted = 0;
      let updated = 0;
      let unchanged = 0;
      for (const row of rows.slice(0, 5000)) {
        const studentNo = String(row.studentNo ?? "").trim();
        const fullName = String(row.fullName ?? "").trim();
        const grade = String(row.grade ?? "").trim();
        const contact = String(row.contact ?? "").trim();
        const email = String(row.email ?? "").trim();
        if (!studentNo || !fullName || !grade) {
          unchanged++;
          continue;
        }
        const [current] = await db
          .select()
          .from(students)
          .where(eq(students.studentNo, studentNo));
        if (!current) {
          await db.insert(students).values({
            studentNo,
            fullName,
            grade,
            contact,
            email,
            createdAt: now,
          });
          inserted++;
          continue;
        }
        const changes = (["fullName", "grade", "contact", "email"] as const)
          .map((field) => ({
            field,
            oldValue: String(current[field] ?? ""),
            newValue: String({ fullName, grade, contact, email }[field] ?? ""),
          }))
          .filter((change) => change.oldValue !== change.newValue);
        if (!changes.length) {
          unchanged++;
          continue;
        }
        await db
          .update(students)
          .set({ fullName, grade, contact, email })
          .where(eq(students.id, current.id));
        await db.insert(studentChanges).values(
          changes.map((change) => ({
            studentId: current.id,
            studentNo,
            ...change,
            source: "e-okul",
            changedAt: now,
          })),
        );
        updated++;
      }
      return Response.json({ ok: true, inserted, updated, unchanged });
    }

    if (action === "importBooks") {
      const rows = Array.isArray(body.rows)
        ? (body.rows as Array<Record<string, unknown>>)
        : [];
      let inserted = 0;
      let skipped = 0;
      for (const row of rows.slice(0, 5000)) {
        const inventoryNo = String(row.inventoryNo ?? "").trim();
        const isbn = String(row.isbn ?? "").trim();
        const title = String(row.title ?? "").trim();
        const author = String(row.author ?? "").trim();
        if (!inventoryNo || !title || !author) {
          skipped++;
          continue;
        }
        const [sameDn] = await db
          .select({ id: books.id })
          .from(books)
          .where(eq(books.inventoryNo, inventoryNo));
        const [sameIsbn] = isbn
          ? await db
              .select({ id: books.id })
              .from(books)
              .where(eq(books.isbn, isbn))
          : [];
        if (sameDn || sameIsbn) {
          skipped++;
          continue;
        }
        await db.insert(books).values({
          inventoryNo,
          isbn,
          title,
          author,
          publisher: String(row.publisher ?? "").trim(),
          category: String(row.category ?? "").trim(),
          genre: String(row.genre ?? "").trim(),
          shelf: String(row.shelf ?? "").trim() || authorShelf(author),
          dewey: String(row.dewey ?? "").trim(),
          pages: Number(row.pages) || 0,
          createdAt: now,
        });
        inserted++;
      }
      return Response.json({ ok: true, inserted, skipped });
    }

    if (action === "loan") {
      const studentId = Number(body.studentId);
      const bookId = Number(body.bookId);
      if (!studentId || !bookId)
        return Response.json(
          { error: "Öğrenci ve kitap seçmelisiniz." },
          { status: 400 },
        );
      const [student] = await db
        .select()
        .from(students)
        .where(eq(students.id, studentId));
      if (student?.blocked)
        return Response.json(
          {
            error: `Bu öğrenciye kitap verilemez: ${student.blockReason || "Yönetici engeli"}`,
          },
          { status: 409 },
        );
      const [active] = await db
        .select({ count: sql<number>`count(*)` })
        .from(loans)
        .where(and(eq(loans.bookId, bookId), isNull(loans.returnedAt)));
      if (Number(active?.count ?? 0) > 0)
        return Response.json(
          { error: "Bu kitap halen ödünçte." },
          { status: 409 },
        );
      const [config] = await db
        .select()
        .from(settings)
        .where(eq(settings.id, 1));
      const loanedAt = isoDate();
      await db.insert(loans).values({
        studentId,
        bookId,
        loanedAt,
        dueAt: plusDays(loanedAt, config?.loanDays ?? 15),
        schoolYear: config?.schoolYear ?? "2026-2027",
      });
      return Response.json({ ok: true }, { status: 201 });
    }

    if (action === "return") {
      await db
        .update(loans)
        .set({ returnedAt: isoDate() })
        .where(
          and(eq(loans.id, Number(body.loanId)), isNull(loans.returnedAt)),
        );
      return Response.json({ ok: true });
    }

    if (action === "renewLoan") {
      const loanId = Number(body.loanId);
      const [loan] = await db.select().from(loans).where(eq(loans.id, loanId));
      const [config] = await db
        .select()
        .from(settings)
        .where(eq(settings.id, 1));
      if (!loan || loan.returnedAt)
        return Response.json(
          { error: "Aktif ödünç kaydı bulunamadı." },
          { status: 404 },
        );
      if (loan.renewalCount >= (config?.maxRenewals ?? 1))
        return Response.json(
          { error: "Bu kitap için süre uzatma hakkı doldu." },
          { status: 409 },
        );
      await db
        .update(loans)
        .set({
          dueAt: plusDays(loan.dueAt, config?.extensionDays ?? 7),
          renewalCount: loan.renewalCount + 1,
        })
        .where(eq(loans.id, loanId));
      return Response.json({ ok: true });
    }

    if (action === "setStudentBlock") {
      const id = Number(body.id);
      const blocked = body.blocked ? 1 : 0;
      const blockReason = blocked ? String(body.blockReason ?? "").trim() : "";
      await db
        .update(students)
        .set({ blocked, blockReason })
        .where(eq(students.id, id));
      return Response.json({ ok: true });
    }

    if (action === "addBookRequest") {
      const studentId =
        identity.role === "student"
          ? Number(identity.studentId)
          : Number(body.studentId);
      const title = String(body.title ?? "").trim();
      if (!studentId || !title)
        return Response.json(
          { error: "Öğrenci ve kitap adı zorunludur." },
          { status: 400 },
        );
      await db.insert(bookRequests).values({
        studentId,
        title,
        author: String(body.author ?? "").trim(),
        note: String(body.note ?? "").trim(),
        createdAt: now,
      });
      return Response.json({ ok: true }, { status: 201 });
    }

    if (action === "updateBookRequest") {
      await db
        .update(bookRequests)
        .set({ status: String(body.status ?? "reviewed") })
        .where(eq(bookRequests.id, Number(body.id)));
      return Response.json({ ok: true });
    }

    if (action === "upsertUser") {
      const email = String(body.email ?? "")
        .trim()
        .toLowerCase();
      const displayName = String(body.displayName ?? "").trim();
      const role = ["admin", "staff", "student"].includes(String(body.role))
        ? String(body.role)
        : "student";
      if (!email || !displayName)
        return Response.json(
          { error: "Ad ve e-posta zorunludur." },
          { status: 400 },
        );
      await db
        .insert(appUsers)
        .values({
          email,
          displayName,
          role,
          studentId: Number(body.studentId) || null,
          active: body.active === false ? 0 : 1,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: appUsers.email,
          set: {
            displayName,
            role,
            studentId: Number(body.studentId) || null,
            active: body.active === false ? 0 : 1,
          },
        });
      return Response.json({ ok: true });
    }

    if (action === "settings") {
      const city = String(body.city ?? "").trim();
      const district = String(body.district ?? "").trim();
      const schoolName = String(body.schoolName ?? "").trim();
      const institutionCode = String(body.institutionCode ?? "").trim();
      const libraryName = String(body.libraryName ?? "").trim();
      const schoolYear = String(body.schoolYear ?? "").trim();
      const loanDays = Math.max(1, Number(body.loanDays) || 15);
      const theme = ["forest", "navy", "plum", "sand", "ocean", "ruby", "slate", "teal", "indigo", "rose"].includes(
        String(body.theme),
      )
        ? String(body.theme)
        : "forest";
      const senderName = String(body.senderName ?? "Okul Kütüphanesi").trim();
      const senderEmail = String(body.senderEmail ?? "").trim();
      const extensionDays = Math.max(1, Number(body.extensionDays) || 7);
      const maxRenewals = Math.max(0, Number(body.maxRenewals) || 0);
      const dailyFine = Math.max(0, Math.round(Number(body.dailyFine) || 0));
      await db
        .insert(settings)
        .values({
          id: 1,
          city,
          district,
          schoolName,
          institutionCode,
          libraryName,
          schoolYear,
          loanDays,
          theme,
          senderName,
          senderEmail,
          extensionDays,
          maxRenewals,
          dailyFine,
        })
        .onConflictDoUpdate({
          target: settings.id,
          set: {
            city,
            district,
            schoolName,
            institutionCode,
            libraryName,
            schoolYear,
            loanDays,
            theme,
            senderName,
            senderEmail,
            extensionDays,
            maxRenewals,
            dailyFine,
          },
        });
      return Response.json({ ok: true });
    }

    if (action === "sendOverdueEmails") {
      const ids = Array.isArray(body.loanIds)
        ? body.loanIds.map(Number).filter(Boolean)
        : [];
      const runtime = env as unknown as { RESEND_API_KEY?: string };
      if (!runtime.RESEND_API_KEY)
        return Response.json(
          {
            error:
              "E-posta servisi henüz bağlanmadı. Ayarlara doğrulanmış gönderen adresi ve Resend anahtarı eklenmelidir.",
          },
          { status: 503 },
        );
      const [config] = await db
        .select()
        .from(settings)
        .where(eq(settings.id, 1));
      if (!config?.senderEmail)
        return Response.json(
          { error: "Ayarlar bölümünde gönderen e-posta adresini kaydedin." },
          { status: 400 },
        );
      const allRows = await db
        .select({
          id: loans.id,
          studentId: students.id,
          studentName: students.fullName,
          email: students.email,
          bookTitle: books.title,
          author: books.author,
          loanedAt: loans.loanedAt,
          dueAt: loans.dueAt,
        })
        .from(loans)
        .innerJoin(students, eq(loans.studentId, students.id))
        .innerJoin(books, eq(loans.bookId, books.id))
        .where(isNull(loans.returnedAt));
      const selected = allRows.filter(
        (row) => (!ids.length || ids.includes(row.id)) && row.dueAt < isoDate(),
      );
      const groups = Object.values(
        selected.reduce<Record<string, typeof selected>>((acc, row) => {
          if (row.email) (acc[row.email] ??= []).push(row);
          return acc;
        }, {}),
      );
      let sent = 0;
      let failed = 0;
      for (const group of groups) {
        const first = group[0];
        const items = group
          .map(
            (item) =>
              `<li><strong>${item.bookTitle}</strong> — ${item.author} (alış: ${item.loanedAt}, son teslim: ${item.dueAt})</li>`,
          )
          .join("");
        const subject = `${config.libraryName}: geciken kitap hatırlatması`;
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${runtime.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${config.senderName} <${config.senderEmail}>`,
            to: [first.email],
            subject,
            html: `<p>Sayın ${first.studentName},</p><p>Okul kütüphanemizden alınan aşağıdaki kitapların teslim süresi geçmiştir:</p><ul>${items}</ul><p>Kitapları en kısa sürede kütüphaneye iade etmenizi rica ederiz.</p><p>${config.libraryName}</p>`,
          }),
        });
        const detail = response.ok
          ? "Gönderildi"
          : (await response.text()).slice(0, 500);
        await db.insert(emailLogs).values({
          studentId: first.studentId,
          recipient: first.email,
          subject,
          status: response.ok ? "sent" : "failed",
          detail,
          sentAt: now,
        });
        response.ok ? sent++ : failed++;
      }
      return Response.json({
        ok: true,
        sent,
        failed,
        missingEmail:
          selected.length - groups.reduce((sum, g) => sum + g.length, 0),
      });
    }
    return Response.json({ error: "Geçersiz işlem." }, { status: 400 });
  } catch (error) {
    return failure(error);
  }
}
