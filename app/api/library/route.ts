import {circulationDelta} from "../../circulation-delta";
import {normalizeGrade,validGrade,normalizePhone} from "../../student-rules";
import { inventorySyncSql, protectedBulkArchiveSql, overdueEmail, deliverOverdueEmail } from "../../library-operations";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../db";
import { canManage, getAppIdentity } from "../../authz";
import {
  adminNotes,
  appUsers,
  bookRequests,
  books,
  emailLogs,
  inventoryEntries,
  inventorySessions,
  loans,
  membershipRequests,
  settings,
  studentChanges,
  students,
} from "../../../db/schema";
import { getSchoolAccess, isCankiriLisesi, SUPER_ADMIN_EMAIL } from "../../subscription";

const isoDate = () => new Date().toISOString().slice(0, 10);
const plusDays = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
const normalized = (value: unknown) =>
  String(value ?? "").trim().replace(/\s+/g, " ").toLocaleUpperCase("tr");
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
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: new Uint8Array(salt), iterations: 100_000 },
    key,
    256,
  );
  return toBase64(new Uint8Array(bits));
}
const timingSafeEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1)
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
};

function failure(error: unknown) {
  console.error("library api error", error);
  return Response.json({ error: "İşlem tamamlanamadı." }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const db = getDb();
    const identity = await getAppIdentity(request);
    if (!identity) return Response.json({ error: "Oturum bulunamadı." }, { status: 401 });
    if (identity.role === "platform_admin") return identity.email.toLowerCase() === SUPER_ADMIN_EMAIL ? Response.json({ access: "platform", currentUser: identity }) : Response.json({ error: "Merkez yönetimi yalnızca fsaygif@gmail.com hesabına açıktır." }, { status: 403 });
    if(identity.role === "student" && !identity.studentId)return Response.json({error:"Öğrenci eşleşmesi bulunamadı."},{status:403});
    const schoolId = identity.schoolId;
    if (!schoolId) return Response.json({ error: "Kullanıcı bir okulla eşleştirilmemiş." }, { status: 403 });
    const subscription = await getSchoolAccess(schoolId);
    if (!subscription?.allowed) return Response.json({ access: "expired", message: "Deneme süreniz doldu, devam etmek için yönetici ile iletişime geçin.", currentUser: identity });
    const canManageSubscription = isCankiriLisesi(subscription.school.name) && identity.email.toLowerCase() === SUPER_ADMIN_EMAIL;
    const [config] = await db.select().from(settings).where(eq(settings.schoolId, schoolId));
    const studentRows = await db
      .select()
      .from(students)
      .where(and(eq(students.schoolId, schoolId), eq(students.activeMember, 1),identity.role === "student" ? eq(students.id,identity.studentId??0) : undefined))
      .orderBy(students.fullName);
    const bookRows = await db.select().from(books).where(and(eq(books.schoolId, schoolId), eq(books.activeInventory, 1))).orderBy(books.title);
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
        sameDayRequired: loans.sameDayRequired,
      })
      .from(loans)
      .innerJoin(students, eq(loans.studentId, students.id))
      .innerJoin(books, eq(loans.bookId, books.id))
      .where(and(eq(loans.schoolId, schoolId),identity.role === "student"?eq(loans.studentId,identity.studentId??0):undefined))
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
      .where(and(eq(bookRequests.schoolId, schoolId),identity.role === "student"?eq(bookRequests.studentId,identity.studentId??0):undefined))
      .orderBy(desc(bookRequests.id));
    const userRowsRaw = identity.role === "admin" ? await db.select({id:appUsers.id,username:appUsers.username,email:appUsers.email,phone:appUsers.phone,displayName:appUsers.displayName,role:appUsers.role,permissions:appUsers.permissions,studentId:appUsers.studentId,active:appUsers.active,passwordConfigured:sql<number>`CASE WHEN password_hash <> '' AND password_salt <> '' THEN 1 ELSE 0 END`}).from(appUsers).where(eq(appUsers.schoolId,schoolId)).orderBy(appUsers.displayName) : [];
    const userRows=userRowsRaw.map(user=>({...user,permissions:String(user.permissions??"").split(",").filter(Boolean),passwordConfigured:Boolean(user.passwordConfigured)}));
    const membershipRows = identity.role === "admin"
      ? await db.select().from(membershipRequests).where(eq(membershipRequests.schoolId, schoolId)).orderBy(desc(membershipRequests.id))
      : [];
    const noteRows = identity.role === "admin"
      ? await db.select().from(adminNotes).where(eq(adminNotes.schoolId, schoolId)).orderBy(desc(adminNotes.id))
      : [];
    const ownStudentId =
      identity.role === "student" ? identity.studentId : null;
    const staffCanSeeStudents = identity.role !== "staff" || identity.permissions.some((permission) => ["students", "circulation", "overdue", "reports"].includes(permission));
    const staffCanSeeBooks = identity.role !== "staff" || identity.permissions.some((permission) => ["books", "circulation", "inventory", "reports"].includes(permission));
    const staffCanSeeRequests = identity.role !== "staff" || identity.permissions.includes("requests");
    const staffCanSeeInventory = identity.role === "admin" || identity.role === "staff" && identity.permissions.includes("inventory");
    const inventorySessionRows = staffCanSeeInventory ? await db.select().from(inventorySessions).where(eq(inventorySessions.schoolId, schoolId)).orderBy(desc(inventorySessions.countDate), desc(inventorySessions.id)) : [];
    const inventoryEntryRows = staffCanSeeInventory ? await db.select().from(inventoryEntries).where(eq(inventoryEntries.schoolId, schoolId)).orderBy(desc(inventoryEntries.countedAt), desc(inventoryEntries.id)) : [];
    return Response.json({
      access: "granted",
      settings: config ? { ...config, iban: canManageSubscription ? config.iban : "", membershipFee: canManageSubscription ? config.membershipFee : 0 } : {
        id: 1,
        libraryName: "Okul Kütüphanesi",
        city: "",
        district: "",
        schoolName: "",
        institutionCode: "",
        schoolYear: "2026-2027",
        loanDays: 15,
        maxBooksPerStudent: 3,
        theme: "forest",
        senderName: "Okul Kütüphanesi",
        senderEmail: "",
        extensionDays: 7,
        maxRenewals: 1,
        dailyFine: 0,
        logoKey: "",
        dashboardImageKey: "",
        iban: "",
        membershipFee: 0,
        driveAccountEmail: "",
        driveFolderUrl: "",
        bookGenres: "ROMAN,HİKAYE,ŞİİR,DENEME,MAKALE,BİYOGRAFİ",
        uiFont: "Arial",
        titleFont: "Georgia",
        baseFontSize: 14,
        textColor: "#17211b",
        accentColor: "#1d6649",
        surfaceColor: "#f4f6f2",
      },
      students: ownStudentId
        ? studentRows.filter((x) => x.id === ownStudentId)
        : staffCanSeeStudents ? studentRows : [],
      books: staffCanSeeBooks ? bookRows : [],
      loans: ownStudentId
        ? loanRows.filter((x) => x.studentId === ownStudentId)
        : staffCanSeeStudents ? loanRows : [],
      requests: ownStudentId
        ? requestRows.filter((x) => x.studentId === ownStudentId)
        : staffCanSeeRequests ? requestRows : [],
      users: identity.role === "admin" ? userRows : [],
      membershipRequests: membershipRows.map(({passwordHash,passwordSalt,...row})=>row),
      notes: noteRows,
      inventorySessions: inventorySessionRows,
      inventoryEntries: inventoryEntryRows,
      currentUser: {
        ...identity,
        passwordConfigured: true,
      },
      subscription: { exempt: subscription.exempt, premium: subscription.premium, trial: subscription.trial, remainingDays: subscription.remainingDays },
      canManageSubscription,
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
    if (!identity)
      return Response.json(
        { error: "Oturum veya kullanıcı yetkisi bulunamadı." },
        { status: 403 },
      );
    if (identity.role === "platform_admin" || !identity.schoolId)
      return Response.json({ error: "Bu işlem okul hesabına aittir." }, { status: 403 });
    const schoolId = identity.schoolId;
    const subscription = await getSchoolAccess(schoolId);
    if (!subscription?.allowed) return Response.json({ error: "Deneme süreniz doldu, devam etmek için yönetici ile iletişime geçin." }, { status: 403 });
    const staffPermissionForAction: Record<string, string> = {
      addStudent: "students", updateStudent: "students", importStudents: "students", syncStudents: "students", changeGrades: "students",
      addBook: "books", updateBook: "books", importBooks: "books",
      importQuestions: "exams", generateExam: "exams",
      loan: "circulation", return: "circulation", renewLoan: "circulation", markSameDayLoan: "circulation",
      setBookLost: "inventory", createInventorySession: "inventory", countInventoryBook: "inventory", updateInventoryShelf: "inventory", deleteInventorySession: "inventory",
      updateBookRequest: "requests", sendOverdueEmails: "overdue", syncInventoryLoans: "inventory",
    };
    const adminOnly = new Set([
      "settings",
      "upsertUser",
      "deleteUser",
      "deleteStudent",
      "deleteBook",
      "bulkDeleteBooks",
      "deleteGrade",
      "promoteGrades",
      "seed",
      "approveMembership",
      "rejectMembership",
      "addNote",
      "toggleNote",
      "deleteNote",
      "deleteBookRequest",
    ]);
    if (adminOnly.has(action) && identity.role !== "admin")
      return Response.json(
        { error: "Bu işlem yalnızca yöneticilere açıktır." },
        { status: 403 },
      );
    if (identity.role === "staff") {
      const needed = staffPermissionForAction[action];
      if (needed && !identity.permissions.includes(needed))
        return Response.json({ error: "Bu modül için yetkiniz bulunmuyor." }, { status: 403 });
    }
    if (
      identity.role === "student" &&
      !new Set(["addBookRequest", "setAdminPassword", "noop"]).has(action)
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

    if(action === "deleteBookRequest") {
      await db.delete(bookRequests).where(and(eq(bookRequests.schoolId,schoolId),eq(bookRequests.id,Number(body.id))));
      return Response.json({ok:true});
    }
    if (action === "noop") return Response.json({ ok: true });

    if (action === "addNote") {
      const content = String(body.content ?? "").trim();
      if (!content) return Response.json({ error: "Not metni boş bırakılamaz." }, { status: 400 });
      await db.insert(adminNotes).values({ schoolId, content, done: 0, createdAt: now });
      return Response.json({ ok: true });
    }

    if (action === "toggleNote") {
      const id = Number(body.id);
      if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Not bulunamadı." }, { status: 400 });
      await db.update(adminNotes).set({ done: body.done ? 1 : 0 }).where(and(eq(adminNotes.id, id), eq(adminNotes.schoolId, schoolId)));
      return Response.json({ ok: true });
    }

    if (action === "deleteNote") {
      const id = Number(body.id);
      if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Not bulunamadı." }, { status: 400 });
      await db.delete(adminNotes).where(and(eq(adminNotes.id, id), eq(adminNotes.schoolId, schoolId)));
      return Response.json({ ok: true });
    }

    if (action === "approveMembership" || action === "rejectMembership") {
      const id = Number(body.id);
      const [row] = await db.select().from(membershipRequests).where(and(eq(membershipRequests.id, id), eq(membershipRequests.schoolId, schoolId)));
      if (!row || row.status !== "pending") return Response.json({ error: "Bekleyen başvuru bulunamadı." }, { status: 404 });
      if (action === "approveMembership") {
        if (!row.username || !row.passwordHash || !row.passwordSalt)
          return Response.json({ error: "Bu eski başvuruda kullanıcı adı/parola yok. Öğrenciden yeniden başvuru yapmasını isteyin." }, { status: 409 });
        const [duplicate] = await db.select({ id: appUsers.id }).from(appUsers).where(and(eq(appUsers.schoolId, schoolId), or(eq(appUsers.username, row.username), eq(appUsers.email, row.email),eq(appUsers.studentId,row.matchedStudentId))));
        if (duplicate) return Response.json({ error: "Bu kullanıcı adı veya e-posta ile hesap zaten var." }, { status: 409 });
        if(row.phone) {
          const phones=await db.select({phone:appUsers.phone}).from(appUsers).where(eq(appUsers.schoolId,schoolId));
          if(phones.some(u=>normalizePhone(u.phone)===normalizePhone(row.phone)))return Response.json({error:"Bu cep telefonu başka bir hesapta kayıtlıdır."},{status:409});
        }
        await db.batch([db.insert(appUsers).values({ schoolId, username: row.username, email: row.email, phone: row.phone, displayName: row.fullName, role: "student", permissions: "", studentId: row.matchedStudentId, active: 1, passwordHash: row.passwordHash, passwordSalt: row.passwordSalt, passwordUpdatedAt: now, createdAt: now }),
          db.update(students).set({email:row.email,...(row.phone?{contact:row.phone}:{})}).where(and(eq(students.id,row.matchedStudentId),eq(students.schoolId,schoolId))),
          db.update(membershipRequests).set({status:"approved",reviewedAt:now}).where(and(eq(membershipRequests.id,id),eq(membershipRequests.schoolId,schoolId))),
        ]);
        return Response.json({ok:true});
      }
      await db.update(membershipRequests).set({ status: "rejected", reviewedAt: now }).where(and(eq(membershipRequests.id, id), eq(membershipRequests.schoolId, schoolId)));
      return Response.json({ ok: true });
    }

    if (action === "seed") {
      await db
        .insert(settings)
        .values({
          schoolId,
          city: "",
          district: "",
          schoolName: "Atatürk Anadolu Lisesi",
          institutionCode: "",
          libraryName: "Atatürk Anadolu Lisesi Kütüphanesi",
          schoolYear: "2026-2027",
          loanDays: 15,
          maxBooksPerStudent: 3,
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
            schoolId,
            studentNo: "101",
            fullName: "Elif Yılmaz",
            grade: "9-A",
            contact: "",
            createdAt: now,
          },
          {
            schoolId,
            studentNo: "205",
            fullName: "Kerem Arslan",
            grade: "10-B",
            contact: "",
            createdAt: now,
          },
          {
            schoolId,
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
            schoolId,
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
            schoolId,
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
            schoolId,
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
      const memberType = ["teacher","employee"].includes(String(body.memberType))?String(body.memberType):"student";
      const studentNo = memberType === "student" ? String(body.studentNo??"").trim() : String(body.studentNo??"").trim() || `MEM-${crypto.randomUUID()}`;
      const fullName = String(body.fullName ?? "").trim();
      const grade = memberType === "student" ? normalizeGrade(body.grade) : "";
      if(memberType === "student" && !validGrade(grade))return Response.json({error:"Sınıf ve şube boşluksuz olmalıdır. Örnek: 9A, 10B."},{status:400});
      if (!studentNo || !fullName || (memberType === "student" && !grade))
        return Response.json(
          { error: "Öğrenci no, ad soyad ve sınıf zorunludur." },
          { status: 400 },
        );
      const [duplicate] = await db
        .select({ id: students.id })
        .from(students)
        .where(and(eq(students.schoolId, schoolId), eq(students.studentNo, studentNo)));
      if (duplicate)
        return Response.json(
          { error: "Bu öğrenci numarasıyla kayıt zaten var." },
          { status: 409 },
        );
      await db.insert(students).values({
        schoolId,
        studentNo,
        fullName,
        grade,
        contact: String(body.contact ?? "").trim(),
        email: String(body.email ?? "").trim(),
        memberType,
        createdAt: now,
      });
      return Response.json({ ok: true }, { status: 201 });
    }

    if (action === "updateStudent") {
      const id = Number(body.id);
      const [existingMember] = await db.select().from(students).where(and(eq(students.id,id),eq(students.schoolId,schoolId)));
      if(!existingMember)return Response.json({error:"Üye bulunamadı."},{status:404});
      const memberType = ["teacher","employee"].includes(String(body.memberType))?String(body.memberType):"student";
      const studentNo = memberType === "student" ? String(body.studentNo??"").trim() : existingMember.studentNo || `MEM-${crypto.randomUUID()}`;
      const fullName = String(body.fullName ?? "").trim();
      const grade = memberType === "student" ? normalizeGrade(body.grade) : "";
      if(memberType === "student" && !validGrade(grade))return Response.json({error:"Sınıf ve şube boşluksuz olmalıdır. Örnek: 9A, 10B."},{status:400});
      if (!id || !studentNo || !fullName || (memberType === "student" && !grade))
        return Response.json(
          { error: "Zorunlu öğrenci alanları eksik." },
          { status: 400 },
        );
      const [duplicate] = await db
        .select({ id: students.id })
        .from(students)
        .where(and(eq(students.schoolId, schoolId), eq(students.studentNo, studentNo)));
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
          memberType,
          blocked: body.blocked ? 1 : 0,
          blockReason: body.blocked
            ? String(body.blockReason ?? "").trim()
            : "",
        })
        .where(and(eq(students.id, id), eq(students.schoolId, schoolId)));
      return Response.json({ ok: true });
    }

    if (action === "deleteStudent") {
      const id = Number(body.id);
      const [active] = await db
        .select({ count: sql<number>`count(*)` })
        .from(loans)
        .where(and(eq(loans.schoolId, schoolId), eq(loans.studentId, id), isNull(loans.returnedAt)));
      if (Number(active?.count ?? 0) > 0)
        return Response.json(
          { error: "Öğrencinin ödünçte kitabı var; önce iade alın." },
          { status: 409 },
        );
      await db.update(students).set({ activeMember: 0 }).where(and(eq(students.id, id), eq(students.schoolId, schoolId)));
      return Response.json({ ok: true });
    }

    if (action === "addBook") {
      const inventoryNo = String(body.inventoryNo ?? "").trim().toLocaleUpperCase("tr");
      const title = String(body.title ?? "").trim();
      const author = String(body.author ?? "").trim();
      if (!inventoryNo)
        return Response.json(
          { error: "Demirbaş numarası zorunludur." },
          { status: 400 },
        );
      const isbn = String(body.isbn ?? "").trim();
      const [sameDn] = await db
        .select({ id: books.id })
        .from(books)
        .where(and(eq(books.schoolId, schoolId), eq(books.inventoryNo, inventoryNo)));
      if (sameDn)
        return Response.json(
          { error: "Bu demirbaş numarasıyla kitap zaten var." },
          { status: 409 },
        );
      await db.insert(books).values({
        schoolId,
        inventoryNo,
        title,
        author,
        isbn,
        publisher: String(body.publisher ?? "").trim(),
        category: String(body.category ?? "").trim(),
        genre: String(body.genre ?? "").trim(),
        shelf: String(body.shelf ?? "").trim(),
        dewey: String(body.dewey ?? "").trim(),
        pages: Number(body.pages) || 0,
        loanable: body.loanable === false ? 0 : 1,
        createdAt: now,
      });
      return Response.json({ ok: true }, { status: 201 });
    }

    if (action === "updateBook") {
      const id = Number(body.id);
      const inventoryNo = String(body.inventoryNo ?? "").trim().toLocaleUpperCase("tr");
      const isbn = String(body.isbn ?? "").trim();
      const title = String(body.title ?? "").trim();
      const author = String(body.author ?? "").trim();
      if (!id || !inventoryNo)
        return Response.json(
          { error: "Demirbaş numarası zorunludur." },
          { status: 400 },
        );
      const [sameDn] = await db
        .select({ id: books.id })
        .from(books)
        .where(and(eq(books.schoolId, schoolId), eq(books.inventoryNo, inventoryNo)));
      if (sameDn && sameDn.id !== id)
        return Response.json(
          { error: "Bu demirbaş numarası başka bir kitaba ait." },
          { status: 409 },
        );
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
          shelf: String(body.shelf ?? "").trim(),
          dewey: String(body.dewey ?? "").trim(),
          pages: Number(body.pages) || 0,
          loanable: body.loanable === false ? 0 : 1,
        })
        .where(and(eq(books.id, id), eq(books.schoolId, schoolId)));
      return Response.json({ ok: true });
    }

    if (action === "deleteBook") {
      const id = Number(body.id);
      const [active] = await db
        .select({ count: sql<number>`count(*)` })
        .from(loans)
        .where(and(eq(loans.schoolId, schoolId), eq(loans.bookId, id), isNull(loans.returnedAt)));
      if (Number(active?.count ?? 0) > 0)
        return Response.json(
          { error: "Kitap ödünçte; önce iade alın." },
          { status: 409 },
        );
      await db.update(books).set({ activeInventory: 0 }).where(and(eq(books.id, id), eq(books.schoolId, schoolId)));
      return Response.json({ ok: true });
    }

    if (action === "bulkDeleteBooks") {
      const category = String(body.category ?? "").trim();
      const genre = String(body.genre ?? "").trim();
      const shelf = String(body.shelf ?? "").trim();
      const author = String(body.author ?? "").trim();
      if (![category, genre, shelf, author].some(Boolean)) return Response.json({ error: "En az bir silme filtresi seçmelisiniz." }, { status: 400 });
      const password = String(body.adminPassword ?? "");
      const [account] = await db.select().from(appUsers).where(and(eq(appUsers.id, identity.id), eq(appUsers.schoolId, schoolId)));
      if (!password || !account?.passwordHash || !account.passwordSalt || !timingSafeEqual(await derivePassword(password, fromBase64(account.passwordSalt)), account.passwordHash))
        return Response.json({ error: "Yönetici parolası doğrulanamadı. Hiçbir kitap değiştirilmedi." }, { status: 403 });
      const result = await env.DB.prepare(protectedBulkArchiveSql).bind(schoolId, category, category, genre, genre, shelf, shelf, author, author).run();
      return Response.json({ ok: true, updated: result.meta.changes });
    }

    if (action === "syncInventoryLoans") {
      const sessionId = Number(body.sessionId);
      if (!Number.isSafeInteger(sessionId) || sessionId <= 0) return Response.json({ error: "Sayım seçin." }, { status: 400 });
      const result = await env.DB.prepare(inventorySyncSql).bind(now, schoolId, isoDate(), sessionId, isoDate()).run();
      return circulationDelta(schoolId,now);
    }

    if (action === "setBookLost") {
      const id = Number(body.id);
      const lost = body.lost ? 1 : 0;
      await db.update(books).set({ lost, lostAt: lost ? now : null }).where(and(eq(books.id, id), eq(books.schoolId, schoolId), eq(books.activeInventory, 1)));
      return Response.json({ ok: true });
    }

    if (action === "createInventorySession") {
      const countNo = String(body.countNo ?? "").trim();
      const countDate = String(body.countDate ?? "").trim();
      if (!countNo || !/^\d{4}-\d{2}-\d{2}$/.test(countDate)) return Response.json({ error: "Sayım numarası ve geçerli bir tarih zorunludur." }, { status: 400 });
      const [existing] = await db.select().from(inventorySessions).where(and(eq(inventorySessions.schoolId, schoolId), eq(inventorySessions.countNo, countNo), eq(inventorySessions.countDate, countDate)));
      if (!existing) await db.insert(inventorySessions).values({ schoolId, countNo, countDate, status: "open", createdAt: now, updatedAt: now });
      return Response.json({ ok: true });
    }

    if (action === "countInventoryBook") {
      const sessionId = Number(body.sessionId);
      const bookId = Number(body.bookId);
      const shelf = String(body.shelf ?? "").trim();
      const [session] = await db.select().from(inventorySessions).where(and(eq(inventorySessions.id, sessionId), eq(inventorySessions.schoolId, schoolId)));
      const [book] = await db.select().from(books).where(and(eq(books.id, bookId), eq(books.schoolId, schoolId), eq(books.activeInventory, 1)));
      if (!session || !book) return Response.json({ error: "Sayım veya kitap kaydı bulunamadı." }, { status: 404 });
      const [duplicate] = await db.select({ id: inventoryEntries.id }).from(inventoryEntries).where(and(eq(inventoryEntries.sessionId, sessionId), eq(inventoryEntries.bookId, bookId)));
      if (duplicate) return Response.json({ error: "Bu kitap bu sayımda zaten sayıldı." }, { status: 409 });
      const finalShelf = shelf || book.shelf;
      await env.DB.batch([
        env.DB.prepare("INSERT INTO inventory_entries(school_id,session_id,book_id,counted_at,shelf_before,shelf_after,source) VALUES(?,?,?,?,?,?,'manual')").bind(schoolId,sessionId,bookId,now,book.shelf,finalShelf),
        env.DB.prepare("UPDATE books SET shelf=?,lost=0,lost_at=NULL WHERE school_id=? AND id=?").bind(finalShelf,schoolId,bookId),
        env.DB.prepare("UPDATE inventory_sessions SET updated_at=? WHERE school_id=? AND id=?").bind(now,schoolId,sessionId),
      ]);
      return circulationDelta(schoolId,now,0,bookId);
    }

    if (action === "updateInventoryShelf") {
      const sessionId = Number(body.sessionId);
      const bookId = Number(body.bookId);
      const shelf = String(body.shelf ?? "").trim();
      if (!shelf) return Response.json({ error: "Yeni raf bilgisi boş bırakılamaz." }, { status: 400 });
      const [entry] = await db.select().from(inventoryEntries).where(and(eq(inventoryEntries.schoolId, schoolId), eq(inventoryEntries.sessionId, sessionId), eq(inventoryEntries.bookId, bookId)));
      if (!entry) return Response.json({ error: "Bu kitap seçili sayımda bulunamadı." }, { status: 404 });
      await db.update(inventoryEntries).set({ shelfAfter: shelf }).where(eq(inventoryEntries.id, entry.id));
      await db.update(books).set({ shelf }).where(and(eq(books.id, bookId), eq(books.schoolId, schoolId)));
      return Response.json({ok:true,patch:{books:[{id:bookId,shelf}],inventoryEntries:[{...entry,shelfAfter:shelf}]}});
    }

    if (action === "deleteInventorySession") {
      const sessionId = Number(body.sessionId);
      const [session] = await db.select({ id: inventorySessions.id }).from(inventorySessions).where(and(eq(inventorySessions.id, sessionId), eq(inventorySessions.schoolId, schoolId)));
      if (!session) return Response.json({ error: "Sayım kaydı bulunamadı." }, { status: 404 });
      await db.delete(inventoryEntries).where(and(eq(inventoryEntries.sessionId, sessionId), eq(inventoryEntries.schoolId, schoolId)));
      await db.delete(inventorySessions).where(and(eq(inventorySessions.id, sessionId), eq(inventorySessions.schoolId, schoolId)));
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
      const changes=ids.map(id=>db.update(students).set({grade}).where(and(eq(students.id,id),eq(students.schoolId,schoolId))));
      await db.batch([changes[0]!,...changes.slice(1)]);
      return Response.json({ ok: true });
    }

    if (action === "promoteGrades") {
      const all = await db.select().from(students).where(eq(students.schoolId, schoolId));
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
                .where(and(eq(students.id, student.id), eq(students.schoolId, schoolId)));
        })
        .filter(Boolean);
      if (updates.length)
        await db.batch(updates as [NonNullable<(typeof updates)[number]>, ...NonNullable<(typeof updates)[number]>[]]);
      return Response.json({ ok: true });
    }

    if (action === "deleteGrade") {
      const grade = String(body.grade ?? "").trim();
      if (!grade)
        return Response.json({ error: "Sınıf seçmelisiniz." }, { status: 400 });
      const members = await db
        .select({ id: students.id })
        .from(students)
        .where(and(eq(students.grade, grade), eq(students.schoolId, schoolId)));
      for (const member of members) {
        const [active] = await db
          .select({ count: sql<number>`count(*)` })
          .from(loans)
          .where(and(eq(loans.schoolId, schoolId), eq(loans.studentId, member.id), isNull(loans.returnedAt)));
        if (Number(active?.count ?? 0) > 0)
          return Response.json(
            { error: "Bu sınıfta ödünçte kitabı olan öğrenci var." },
            { status: 409 },
          );
      }
      await db.delete(students).where(and(eq(students.grade, grade), eq(students.schoolId, schoolId)));
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
          .where(and(eq(students.schoolId, schoolId), eq(students.studentNo, studentNo)));
        if (exists) {
          skipped++;
          continue;
        }
        await db.insert(students).values({
          schoolId,
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
          .where(and(eq(students.schoolId, schoolId), eq(students.studentNo, studentNo)));
        if (!current) {
          await db.insert(students).values({
            schoolId,
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
          .where(and(eq(students.id, current.id), eq(students.schoolId, schoolId)));
        await db.insert(studentChanges).values(
          changes.map((change) => ({
            schoolId,
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
      let skipped = 0;
      const seen = new Set<string>();
      if (!rows.some((row) => String(row.inventoryNo ?? "").trim())) return Response.json({ error: "Excel dosyasında geçerli bir DN / Demirbaş No sütunu bulunamadı; mevcut envanter değiştirilmedi." }, { status: 400 });
      const incoming: Array<{ inventoryNo: string; isbn: string; title: string; author: string; publisher: string; category: string; genre: string; shelf: string; dewey: string; pages: number }> = [];
      for (const row of rows.slice(0, 100000)) {
        const inventoryNo = String(row.inventoryNo ?? "").trim().toLocaleUpperCase("tr");
        if (!inventoryNo || seen.has(inventoryNo)) {
          skipped++;
          continue;
        }
        seen.add(inventoryNo);
        incoming.push({
          inventoryNo,
          isbn: String(row.isbn ?? "").trim(),
          title: String(row.title ?? "").trim(),
          author: String(row.author ?? "").trim(),
          publisher: String(row.publisher ?? "").trim(),
          category: String(row.category ?? "").trim(),
          genre: String(row.genre ?? "").trim(),
          shelf: String(row.shelf ?? "").trim(),
          dewey: String(row.dewey ?? "").trim(),
          pages: Number(row.pages) || 0,
        });
      }
      const existing = await db.select({ id: books.id, inventoryNo: books.inventoryNo }).from(books).where(eq(books.schoolId, schoolId));
      const upsertSql = `INSERT INTO books (school_id, inventory_no, isbn, title, author, publisher, category, genre, shelf, dewey, pages, active_inventory, lost, lost_at, created_at)
        SELECT ?,
          json_extract(value, '$.inventoryNo'), json_extract(value, '$.isbn'), json_extract(value, '$.title'),
          json_extract(value, '$.author'), json_extract(value, '$.publisher'), json_extract(value, '$.category'),
          json_extract(value, '$.genre'), json_extract(value, '$.shelf'), json_extract(value, '$.dewey'),
          json_extract(value, '$.pages'), 1, 0, NULL, ?
        FROM json_each(?) WHERE true
        ON CONFLICT(school_id, inventory_no) DO UPDATE SET
          isbn=excluded.isbn, title=excluded.title, author=excluded.author, publisher=excluded.publisher,
          category=excluded.category, genre=excluded.genre, shelf=excluded.shelf, dewey=excluded.dewey,
          pages=excluded.pages, active_inventory=1, lost=0, lost_at=NULL`;
      const d1 = env.DB;
      const batchSize = 250;
      const upsertStatements = [];
      for (let index = 0; index < incoming.length; index += batchSize) {
        upsertStatements.push(d1.prepare(upsertSql).bind(schoolId, now, JSON.stringify(incoming.slice(index, index + batchSize))));
      }
      await d1.batch(upsertStatements);
      const importedIds = new Set(incoming.map((row) => row.inventoryNo));
      const removedIds = existing.filter((book) => !importedIds.has(book.inventoryNo.toLocaleUpperCase("tr"))).map((book) => book.id);
      const deactivateStatements = [];
      for (let index = 0; index < removedIds.length; index += 90) {
        const ids = removedIds.slice(index, index + 90);
        deactivateStatements.push(d1.prepare(`UPDATE books SET active_inventory = 0 WHERE school_id = ? AND id IN (${ids.map(() => "?").join(",")})`).bind(schoolId, ...ids));
      }
      if (deactivateStatements.length) await d1.batch(deactivateStatements);
      return Response.json({ ok: true, inserted: incoming.length, skipped });
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
        .where(and(eq(students.id, studentId), eq(students.schoolId, schoolId)));
      if (student?.blocked)
        return Response.json(
          {
            error: `Bu öğrenciye kitap verilemez: ${student.blockReason || "Yönetici engeli"}`,
          },
          { status: 409 },
        );
      const [book] = await db.select({ id: books.id, lost: books.lost, activeInventory: books.activeInventory, loanable: books.loanable }).from(books).where(and(eq(books.id, bookId), eq(books.schoolId, schoolId)));
      if (!student || !book) return Response.json({ error: "Öğrenci veya kitap bu okula ait değil." }, { status: 404 });
      if (!book.activeInventory || book.lost) return Response.json({ error: "Bu kitap envanterde aktif veya ödünç verilebilir durumda değil." }, { status: 409 });
      if (!book.loanable) return Response.json({ error: "Bu kitap ‘Ödünç Verilmez’ olarak işaretlenmiştir." }, { status: 409 });
      const [active] = await db
        .select({ count: sql<number>`count(*)` })
        .from(loans)
        .where(and(eq(loans.schoolId, schoolId), eq(loans.bookId, bookId), isNull(loans.returnedAt)));
      if (Number(active?.count ?? 0) > 0)
        return Response.json(
          { error: "Bu kitap halen ödünçte." },
          { status: 409 },
        );
      const [config] = await db
        .select()
        .from(settings)
        .where(eq(settings.schoolId, schoolId));
      const loanedAt = isoDate();
      const [studentActive] = await db
        .select({ count: sql<number>`count(*)` })
        .from(loans)
        .where(and(eq(loans.schoolId, schoolId), eq(loans.studentId, studentId), isNull(loans.returnedAt)));
      const maxBooksPerStudent = config?.maxBooksPerStudent ?? 3;
      if (Number(studentActive?.count ?? 0) >= maxBooksPerStudent)
        return Response.json(
          { error: `Bu öğrenci aynı anda en fazla ${maxBooksPerStudent} kitap alabilir.` },
          { status: 409 },
        );
      const loanResult = await env.DB.batch([
        env.DB.prepare(`INSERT INTO loans (school_id,student_id,book_id,loaned_at,due_at,school_year)
          SELECT ?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM loans WHERE school_id = ? AND book_id = ? AND returned_at IS NULL) AND (SELECT count(*) FROM loans WHERE school_id=? AND student_id=? AND returned_at IS NULL) < ?`)
          .bind(schoolId, studentId, bookId, loanedAt, plusDays(loanedAt, config?.loanDays ?? 15), config?.schoolYear ?? "2026-2027", schoolId, bookId, schoolId, studentId, maxBooksPerStudent),
        env.DB.prepare(inventorySyncSql).bind(now, schoolId, loanedAt, null, loanedAt),
      ]);
      if (!loanResult[0].meta.changes) return Response.json({ error: "Kitap başka bir işlemde ödünç verildi. Listeyi yenileyin." }, { status: 409 });
      return circulationDelta(schoolId,now,0,bookId);
    }

    if (action === "return") {
      await db
        .update(loans)
        .set({ returnedAt: isoDate() })
        .where(
          and(eq(loans.id, Number(body.loanId)), eq(loans.schoolId, schoolId), isNull(loans.returnedAt)),
        );
      return circulationDelta(schoolId,now,Number(body.loanId));
    }

    if (action === "markSameDayLoan") {
      const loanId = Number(body.loanId);
      const [loan] = await db.select().from(loans).where(and(eq(loans.id, loanId), eq(loans.schoolId, schoolId), isNull(loans.returnedAt)));
      if (!loan) return Response.json({ error: "Aktif ödünç kaydı bulunamadı." }, { status: 404 });
      await db.update(loans).set({ sameDayRequired: 1, dueAt: loan.loanedAt }).where(and(eq(loans.id, loanId), eq(loans.schoolId, schoolId)));
      return Response.json({ ok: true });
    }

    if (action === "renewLoan") {
      const loanId = Number(body.loanId);
      const [loan] = await db.select().from(loans).where(and(eq(loans.id, loanId), eq(loans.schoolId, schoolId)));
      const [config] = await db
        .select()
        .from(settings)
        .where(eq(settings.schoolId, schoolId));
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
        .where(and(eq(loans.id, loanId), eq(loans.schoolId, schoolId)));
      return Response.json({ ok: true });
    }

    if (action === "setStudentBlock") {
      const id = Number(body.id);
      const blocked = body.blocked ? 1 : 0;
      const blockReason = blocked ? String(body.blockReason ?? "").trim() : "";
      await db
        .update(students)
        .set({ blocked, blockReason })
        .where(and(eq(students.id, id), eq(students.schoolId, schoolId)));
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
      const [requestStudent] = await db.select({id:students.id}).from(students).where(and(eq(students.schoolId,schoolId),eq(students.id,studentId)));
      if(!requestStudent)return Response.json({error:"Öğrenci bu okula ait değil."},{status:404});
      await db.insert(bookRequests).values({
        schoolId,
        studentId,
        title,
        author: String(body.author ?? "").trim(),
        note: String(body.note ?? "").trim(),
        createdAt: now,
      });
      return Response.json({ ok: true }, { status: 201 });
    }

    if (action === "updateBookRequest") {
      if(!["new","reviewed","approved","rejected","purchased"].includes(String(body.status)))return Response.json({error:"Geçersiz talep durumu."},{status:400});
      await db
        .update(bookRequests)
        .set({ status: String(body.status ?? "reviewed") })
        .where(and(eq(bookRequests.id, Number(body.id)), eq(bookRequests.schoolId, schoolId)));
      return Response.json({ ok: true });
    }

    if (action === "upsertUser") {
      const username = String(body.username ?? "").trim().toLowerCase();
      const email = String(body.email ?? "")
        .trim()
        .toLowerCase();
      const displayName = String(body.displayName ?? "").trim();
      const phone = String(body.phone ?? "").trim();
      const assignedStudent=Number(body.studentId)||null;
      if(assignedStudent) {
        const [member]=await db.select({id:students.id}).from(students).where(and(eq(students.schoolId,schoolId),eq(students.id,assignedStudent)));
        if(!member)return Response.json({error:"Öğrenci bu okula ait değil."},{status:403});
      }
      const password = String(body.password ?? "");
      const role = ["admin", "staff", "student"].includes(String(body.role))
        ? String(body.role)
        : "student";
      const allowedPermissions = ["circulation", "books", "students", "overdue", "inventory", "reports", "requests"];
      const permissions = role === "staff" && Array.isArray(body.permissions)
        ? body.permissions.map(String).filter((value) => allowedPermissions.includes(value)).join(",")
        : "";
      if (!username || !email || !displayName)
        return Response.json(
          { error: "Kullanıcı adı, ad ve e-posta zorunludur." },
          { status: 400 },
        );
      if (password && password.length < 6)
        return Response.json({ error: "Parola en az 6 karakter olmalıdır." }, { status: 400 });
      const [existingAccount] = await db.select({ id: appUsers.id }).from(appUsers).where(and(eq(appUsers.schoolId, schoolId), eq(appUsers.email, email)));
      if (!existingAccount && !password)
        return Response.json({ error: "Yeni kullanıcı için geçici parola zorunludur." }, { status: 400 });
      const salt = password ? crypto.getRandomValues(new Uint8Array(16)) : null;
      const passwordValues = salt ? { passwordHash: await derivePassword(password, salt), passwordSalt: toBase64(salt), passwordUpdatedAt: now } : {};
      await db
        .insert(appUsers)
        .values({
          schoolId,
          username,
          email,
          phone,
          displayName,
          role,
          permissions,
          studentId: Number(body.studentId) || null,
          active: body.active === false ? 0 : 1,
          ...passwordValues,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: [appUsers.schoolId, appUsers.email],
          set: {
            username,
            displayName,
            phone,
            role,
            permissions,
            studentId: Number(body.studentId) || null,
            active: body.active === false ? 0 : 1,
            ...passwordValues,
          },
        });
      return Response.json({ ok: true });
    }

    if (action === "deleteUser") {
      const id = Number(body.id);
      if (!id)
        return Response.json({ error: "Geçerli bir kullanıcı seçilmedi." }, { status: 400 });
      if (id === identity.id)
        return Response.json(
          { error: "Açık olan yönetici hesabı silinemez." },
          { status: 400 },
        );
      const [target] = await db.select().from(appUsers).where(and(eq(appUsers.id, id), eq(appUsers.schoolId, schoolId)));
      if (!target)
        return Response.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
      if (target.role === "admin") {
        const [adminTotal] = await db
          .select({ count: sql<number>`count(*)` })
          .from(appUsers)
          .where(and(eq(appUsers.schoolId, schoolId), eq(appUsers.role, "admin"), eq(appUsers.active, 1)));
        if (Number(adminTotal?.count ?? 0) <= 1)
          return Response.json(
            { error: "Sistemdeki son etkin yönetici silinemez." },
            { status: 400 },
          );
      }
      await db.delete(appUsers).where(and(eq(appUsers.id, id), eq(appUsers.schoolId, schoolId)));
      return Response.json({ ok: true });
    }

    if (action === "setAdminPassword") {
      const currentPassword = String(body.currentPassword ?? "");
      const password = String(body.password ?? "");
      if (password.length < 6)
        return Response.json(
          { error: "Yeni parola en az 6 karakter olmalıdır." },
          { status: 400 },
        );
      const [account] = await db.select().from(appUsers).where(and(eq(appUsers.id, identity.id), eq(appUsers.schoolId, schoolId)));
      if (!account)
        return Response.json({ error: "Kullanıcı hesabı bulunamadı." }, { status: 403 });
      if (account.passwordHash && account.passwordSalt) {
        if (!currentPassword)
          return Response.json({ error: "Mevcut parola zorunludur." }, { status: 400 });
        const currentHash = await derivePassword(currentPassword, fromBase64(account.passwordSalt));
        if (!timingSafeEqual(currentHash, account.passwordHash))
          return Response.json({ error: "Mevcut parola yanlış." }, { status: 403 });
      }
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const hash = await derivePassword(password, salt);
      await db
        .update(appUsers)
        .set({
          passwordHash: hash,
          passwordSalt: toBase64(salt),
          passwordUpdatedAt: now,
        })
        .where(and(eq(appUsers.id, identity.id), eq(appUsers.schoolId, schoolId)));
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
      const maxBooksPerStudent = Math.min(20, Math.max(1, Number(body.maxBooksPerStudent) || 3));
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
      const driveAccountEmail = String(body.driveAccountEmail ?? "").trim();
      const driveFolderUrl = String(body.driveFolderUrl ?? "").trim();
      const bookGenres = String(body.bookGenres ?? "ROMAN,HİKAYE,ŞİİR,DENEME,MAKALE,BİYOGRAFİ").split(",").map((value) => value.trim()).filter(Boolean).join(",");
      const uiFont = String(body.uiFont ?? "Arial").trim() || "Arial";
      const titleFont = String(body.titleFont ?? "Georgia").trim() || "Georgia";
      const baseFontSize = Math.min(22, Math.max(11, Number(body.baseFontSize) || 14));
      const safeColor = (value: unknown, fallback: string) => /^#[0-9a-f]{6}$/i.test(String(value)) ? String(value) : fallback;
      const textColor = safeColor(body.textColor, "#17211b");
      const accentColor = safeColor(body.accentColor, "#1d6649");
      const surfaceColor = safeColor(body.surfaceColor, "#f4f6f2");
      const canManageSubscription = isCankiriLisesi(subscription.school.name) && identity.email.toLowerCase() === SUPER_ADMIN_EMAIL;
      const iban = canManageSubscription ? String(body.iban ?? "").trim().toLocaleUpperCase("tr") : undefined;
      const membershipFee = canManageSubscription ? Math.max(0, Math.round(Number(body.membershipFee) || 0)) : undefined;
      await db
        .insert(settings)
        .values({
          schoolId,
          city,
          district,
          schoolName,
          institutionCode,
          libraryName,
          schoolYear,
          loanDays,
          maxBooksPerStudent,
          theme,
          senderName,
          senderEmail,
          extensionDays,
          maxRenewals,
          dailyFine,
          driveAccountEmail,
          driveFolderUrl,
          bookGenres,
          uiFont,
          titleFont,
          baseFontSize,
          textColor,
          accentColor,
          surfaceColor,
        })
        .onConflictDoUpdate({
          target: settings.schoolId,
          set: {
            city,
            district,
            schoolName,
            institutionCode,
            libraryName,
            schoolYear,
            loanDays,
            maxBooksPerStudent,
            theme,
            senderName,
            senderEmail,
            extensionDays,
            maxRenewals,
            dailyFine,
            driveAccountEmail,
            driveFolderUrl,
            bookGenres,
            uiFont,
            titleFont,
            baseFontSize,
            textColor,
            accentColor,
            surfaceColor,
            ...(canManageSubscription ? { iban, membershipFee } : {}),
          },
        });
      return Response.json({ ok: true });
    }

    if (action === "sendOverdueEmails") {
      const ids = Array.isArray(body.loanIds)
        ? body.loanIds.map(Number).filter(Boolean)
        : [];
      if (!ids.length) return Response.json({ error: "E-posta gönderilecek kayıtları seçin." }, { status: 400 });
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
        .where(eq(settings.schoolId, schoolId));
      if (!config?.senderEmail || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(config.senderEmail))
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
        .where(and(eq(loans.schoolId, schoolId), isNull(loans.returnedAt)));
      const selected = allRows.filter(
        (row) => ids.includes(row.id) && row.dueAt < isoDate(),
      );
      const groups = Object.values(
        selected.reduce<Record<string, typeof selected>>((acc, row) => {
          if (row.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim())) (acc[`${row.studentId}:${row.email.trim().toLowerCase()}`] ??= []).push({ ...row, email: row.email.trim() });
          return acc;
        }, {}),
      );
      let sent = 0;
      let failed = 0;
      for (const group of groups) {
        const first = group[0];
        const payload = overdueEmail(config, group);
        const { sent: delivered, detail } = await deliverOverdueEmail(runtime.RESEND_API_KEY, payload);
        const subject = payload.subject;
        await db.insert(emailLogs).values({
          schoolId,
          studentId: first.studentId,
          recipient: first.email,
          subject,
          status: delivered ? "sent" : "failed",
          detail,
          sentAt: now,
        });
        delivered ? sent++ : failed++;
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
