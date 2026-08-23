"use client";

import { useCallback, useEffect, useState } from "react";
import * as XLSX from "xlsx";

type Student = {
  id: number;
  studentNo: string;
  fullName: string;
  grade: string;
  contact: string;
  email: string;
  photoKey: string;
  blocked: number;
  blockReason: string;
};
type Book = {
  id: number;
  inventoryNo: string;
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  category: string;
  genre: string;
  shelf: string;
  dewey: string;
  pages: number;
  coverKey: string;
};
type Loan = {
  id: number;
  studentId: number;
  studentNo: string;
  studentName: string;
  grade: string;
  contact: string;
  email: string;
  studentPhotoKey: string;
  bookId: number;
  inventoryNo: string;
  bookTitle: string;
  author: string;
  bookCoverKey: string;
  loanedAt: string;
  dueAt: string;
  returnedAt: string | null;
  schoolYear: string;
  renewalCount: number;
};
type BookRequest = {
  id: number;
  studentId: number;
  studentName: string;
  studentNo: string;
  title: string;
  author: string;
  note: string;
  status: string;
  createdAt: string;
};
type AppUser = {
  id: number;
  email: string;
  displayName: string;
  role: string;
  studentId: number | null;
  active: number;
};
type MembershipRequest = { id: number; email: string; fullName: string; grade: string; studentNo: string; city: string; district: string; schoolName: string; status: string; createdAt: string };
type Data = {
  access: "granted";
  settings: {
    city: string;
    district: string;
    schoolName: string;
    institutionCode: string;
    libraryName: string;
    schoolYear: string;
    loanDays: number;
    theme: string;
    senderName: string;
    senderEmail: string;
    extensionDays: number;
    maxRenewals: number;
    dailyFine: number;
    logoKey: string;
  };
  students: Student[];
  books: Book[];
  loans: Loan[];
  requests: BookRequest[];
  users: AppUser[];
  membershipRequests: MembershipRequest[];
  currentUser: AppUser | null;
  today: string;
};
type UnregisteredData = { access: "unregistered"; viewerEmail: string; school: { city: string; district: string; schoolName: string } | null; membershipRequest: MembershipRequest | null };
type Tab =
  | "dashboard"
  | "circulation"
  | "books"
  | "students"
  | "requests"
  | "overdue"
  | "inventory"
  | "reports"
  | "assistant"
  | "settings";

const menu: Array<[Tab, string, string]> = [
  ["dashboard", "Genel Bakış", "⌂"],
  ["circulation", "Ödünç / İade", "⇄"],
  ["books", "Kitaplar", "▤"],
  ["students", "Öğrenciler", "◉"],
  ["requests", "Kitap Talepleri", "✎"],
  ["overdue", "Geç Kalanlar", "!"],
  ["inventory", "Kitap Sayımı", "⌕"],
  ["reports", "Raporlar", "▥"],
  ["assistant", "Asistan", "✧"],
  ["settings", "Ayarlar", "⚙"],
];

async function request(action: string, payload: Record<string, unknown> = {}) {
  const response = await fetch("/api/library", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  const result = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(result.error || "İşlem başarısız.");
  return result as {
    error?: string;
    inserted?: number;
    skipped?: number;
    updated?: number;
    unchanged?: number;
    sent?: number;
    failed?: number;
  };
}

async function uploadImage(
  file: File,
  kind: "student" | "book" | "logo",
  recordKey: string,
) {
  const form = new FormData();
  form.set("file", file);
  form.set("kind", kind);
  form.set("recordKey", recordKey);
  const response = await fetch("/api/media", { method: "POST", body: form });
  const result = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(result.error || "Görsel yüklenemedi.");
}
const mediaUrl = (key: string) => `/api/media?key=${encodeURIComponent(key)}`;

function downloadExcel(
  filename: string,
  sheetName: string,
  rows: Record<string, unknown>[],
) {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName);
  XLSX.writeFile(book, filename);
}
async function readExcel(file: File) {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });
}
function pick(row: Record<string, unknown>, names: string[]) {
  const entry = Object.entries(row).find(([key]) =>
    names.includes(key.trim().toLocaleUpperCase("tr")),
  );
  return entry?.[1] ?? "";
}

function MembershipSignup({ data, busy, act }: { data: UnregisteredData; busy: boolean; act: (a: string, p: Record<string, unknown>, s: string) => Promise<void> }) {
  const school = data.school;
  const [form, setForm] = useState({ city: school?.city ?? "", district: school?.district ?? "", schoolName: school?.schoolName ?? "", fullName: "", grade: "", studentNo: "" });
  const pending = data.membershipRequest?.status === "pending";
  return (
    <main className="signup-page">
      <section className="signup-card">
        <div className="mark">K</div>
        <p className="eyebrow">Güvenli öğrenci erişimi</p>
        <h1>Öğrenci üyelik talebi</h1>
        <p className="muted">Bilgileriniz okulun öğrenci kaydıyla eşleşirse başvurunuz yönetici onayına gönderilir.</p>
        {pending ? (
          <div className="pending-box"><strong>Başvurunuz inceleniyor</strong><p>{data.viewerEmail} hesabıyla yaptığınız talep okul yöneticisinin onayını bekliyor.</p></div>
        ) : (
          <div className="form-grid one">
            <label>Şehir<input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
            <label>İlçe<input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} /></label>
            <label>Okul adı<input value={form.schoolName} onChange={(e) => setForm({ ...form, schoolName: e.target.value })} /></label>
            <label>Adı soyadı<input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></label>
            <div className="form-grid two"><label>Sınıf<input value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} placeholder="9-A" /></label><label>Öğrenci no<input value={form.studentNo} onChange={(e) => setForm({ ...form, studentNo: e.target.value })} /></label></div>
            <button className="primary" disabled={busy || Object.values(form).some((x) => !x.trim())} onClick={() => act("submitMembershipRequest", form, "Başvurunuz yönetici onayına gönderildi.")}>Üyelik talebi gönder</button>
          </div>
        )}
        <a className="signout-link" href="/signout-with-chatgpt?return_to=/">Farklı hesapla giriş yap</a>
      </section>
    </main>
  );
}

export default function LibraryApp() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [data, setData] = useState<Data | UnregisteredData | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/library", { cache: "no-store" });
    if (!response.ok) throw new Error("Veriler yüklenemedi.");
    setData((await response.json()) as Data | UnregisteredData);
  }, []);
  useEffect(() => {
    // Initial network synchronization; state changes only after the response resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load().catch((error) => setNotice(error.message));
  }, [load]);
  const act = async (
    action: string,
    payload: Record<string, unknown>,
    success: string,
  ) => {
    setBusy(true);
    setNotice("");
    try {
      await request(action, payload);
      await load();
      setNotice(success);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "İşlem başarısız.");
    } finally {
      setBusy(false);
    }
  };

  if (!data)
    return (
      <main className="loading">
        <div className="loader" />
        <p>{notice || "Kütüphane hazırlanıyor…"}</p>
      </main>
    );
  if (data.access === "unregistered")
    return <MembershipSignup data={data} busy={busy} act={act} />;
  const activeLoans = data.loans.filter((x) => !x.returnedAt);
  const overdue = activeLoans.filter((x) => x.dueAt < data.today);
  const available = data.books.filter(
    (book) => !activeLoans.some((loan) => loan.bookId === book.id),
  );
  const stats = [
    ["Toplam Kitap", data.books.length, "kitap"],
    ["Kayıtlı Öğrenci", data.students.length, "öğrenci"],
    ["Ödünçte", activeLoans.length, "aktif"],
    ["Geciken", overdue.length, "gecikme"],
  ];
  const role = data.currentUser?.role ?? "student";
  const visibleMenu = menu.filter(
    ([id]) =>
      role === "admin" ||
      (role === "staff"
        ? id !== "settings"
        : ["dashboard", "books", "requests", "assistant"].includes(id)),
  );
  return (
    <div className="shell" data-theme={data.settings.theme || "forest"}>
      <aside>
        <div className="brand">
          <div className="mark">K</div>
          <div>
            <strong>Kütüphane</strong>
            <small>Yönetim Merkezi</small>
          </div>
        </div>
        <nav>
          {visibleMenu.map(([id, label, icon]) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
            >
              <span>{icon}</span>
              {label}
              {id === "overdue" && overdue.length > 0 ? (
                <b>{overdue.length}</b>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="side-note">
          <span>2026</span>
          <p>Kitaplar dolaştıkça bilgi çoğalır.</p>
        </div>
      </aside>
      <main>
        <header>
          <div className="header-title">
            {data.settings.logoKey && (
              <img
                className="school-logo"
                src={mediaUrl(data.settings.logoKey)}
                alt="Okul logosu"
              />
            )}
            <div>
              <p className="eyebrow">
                {data.settings.schoolYear} Eğitim-Öğretim Yılı
              </p>
              <h1>{data.settings.libraryName}</h1>
            </div>
          </div>
          <div className="account-box">
            <strong>{data.currentUser?.displayName}</strong>
            <small>
              {role === "admin"
                ? "Yönetici"
                : role === "staff"
                  ? "Kütüphane görevlisi"
                  : "Öğrenci"}
            </small>
            <a href="/signout-with-chatgpt?return_to=/">Çıkış yap</a>
          </div>
          <div className="today">
            <small>BUGÜN</small>
            <strong>
              {new Date(`${data.today}T12:00:00`).toLocaleDateString("tr-TR", {
                day: "numeric",
                month: "long",
              })}
            </strong>
          </div>
        </header>
        {notice && (
          <div className="notice" onClick={() => setNotice("")}>
            {notice}
            <span>×</span>
          </div>
        )}
        {tab === "dashboard" && (
          <Dashboard
            stats={stats}
            active={activeLoans}
            overdue={overdue}
            setTab={setTab}
            role={role}
          />
        )}
        {tab === "circulation" && (
          <Circulation
            students={data.students}
            books={available}
            active={activeLoans}
            busy={busy}
            act={act}
            readOnly={role === "student"}
          />
        )}
        {tab === "books" && (
          <Books
            books={data.books}
            active={activeLoans}
            busy={busy}
            act={act}
            studentMode={role === "student"}
          />
        )}
        {tab === "students" && (
          <Students
            students={data.students}
            loans={data.loans}
            busy={busy}
            act={act}
          />
        )}
        {tab === "requests" && (
          <Requests
            rows={data.requests}
            students={data.students}
            busy={busy}
            act={act}
          />
        )}
        {tab === "overdue" && (
          <Overdue
            rows={overdue}
            today={data.today}
            dailyFine={data.settings.dailyFine}
            busy={busy}
            act={act}
          />
        )}
        {tab === "inventory" && (
          <Inventory books={data.books} active={activeLoans} />
        )}
        {tab === "reports" && <Reports data={data} />}
        {tab === "assistant" && <Assistant students={data.students} />}
        {tab === "settings" && (
          <Settings
            config={data.settings}
            students={data.students}
            users={data.users}
            membershipRequests={data.membershipRequests}
            empty={!data.books.length && !data.students.length}
            busy={busy}
            act={act}
          />
        )}
      </main>
    </div>
  );
}

function Dashboard({
  stats,
  active,
  overdue,
  setTab,
  role,
}: {
  stats: (string | number)[][];
  active: Loan[];
  overdue: Loan[];
  setTab: (t: Tab) => void;
  role: string;
}) {
  const student = role === "student";
  const staff = role === "staff";
  return (
    <section>
      <div className="page-head">
        <div>
          <h2>{student ? "Öğrenci Paneli" : staff ? "Kütüphane Sorumlusu Paneli" : "Yönetici Paneli"}</h2>
          <p>{student ? "Okuduğunuz kitapları, teslim tarihlerini ve okul kataloğunu izleyin." : staff ? "Günlük ödünç, iade, sayım ve öğrenci işlemlerini yönetin." : "Kütüphanenizin bugünkü durumunu ve yönetim araçlarını tek bakışta görün."}</p>
        </div>
        <button
          className="primary"
          onClick={() => setTab(student ? "requests" : "circulation")}
        >
          {student ? "Kitap talep et" : "+ Yeni ödünç işlemi"}
        </button>
      </div>
      <div className="reading-banner">
        <img
          src="/reading-hero.png"
          alt="Kütüphanede kitap okuyan öğrenciler"
        />
        <div>
          <small>{student ? "BUGÜN NE OKUSAM?" : staff ? "SORUMLU ÇALIŞMA ALANI" : "OKUMA İLHAMI"}</small>
          <blockquote>
            {student ? "“İyi bir kitap, yeni bir dünyaya açılan kapıdır.”" : staff ? "“Doğru kitapla buluşan her öğrenci yeni bir yol keşfeder.”" : "“Bir kitap, insanın kendine yaptığı en güzel yatırımdır.”"}
          </blockquote>
          <p>{student ? "Kataloğu inceleyin veya size uygun bir kitap isteyin." : "Bugün bir öğrenciye doğru kitabı ulaştırın."}</p>
        </div>
      </div>
      <div className="stats">
        {stats.map(([label, value, detail], i) => (
          <article key={String(label)}>
            <div className={`stat-icon s${i}`}>{["▤", "◉", "↗", "!"][i]}</div>
            <div>
              <small>{label}</small>
              <strong>{value}</strong>
              <p>{detail}</p>
            </div>
          </article>
        ))}
      </div>
      <div className="grid-2">
        <Card
          title="Aktif Ödünçler"
          action={student ? "Kitapları aç" : "Tüm işlemler"}
          onAction={() => setTab(student ? "books" : "circulation")}
        >
          <LoanTable rows={active.slice(0, 6)} showReturn={false} />
        </Card>
        <Card
          title="Dikkat Gerekenler"
          action="Geç kalanları aç"
          onAction={() => setTab("overdue")}
        >
          <div className="attention">
            <div className="big-alert">{overdue.length}</div>
            <div>
              <strong>geciken kitap</strong>
              <p>
                {overdue.length
                  ? "Öğrencilere hatırlatma yapılması gerekiyor."
                  : "Harika! Geciken kitap bulunmuyor."}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}

function Circulation({
  students,
  books,
  active,
  busy,
  act,
}: {
  students: Student[];
  books: Book[];
  active: Loan[];
  busy: boolean;
  act: (a: string, p: Record<string, unknown>, s: string) => Promise<void>;
}) {
  const [studentQuery, setStudentQuery] = useState("");
  const [bookQuery, setBookQuery] = useState("");
  const normalize = (value: string) => value.trim().toLocaleUpperCase("tr");
  const selectedStudent = students.find((x) =>
    [x.studentNo, `${x.studentNo} · ${x.fullName} · ${x.grade}`].some((v) => normalize(v) === normalize(studentQuery)),
  );
  const selectedBook = books.find((x) =>
    [x.inventoryNo, x.isbn, `${x.inventoryNo} · ${x.title} · ${x.author}`].some((v) => normalize(v) === normalize(bookQuery)),
  );
  const lend = async () => {
    if (!selectedStudent || !selectedBook) return;
    await act("loan", { studentId: selectedStudent.id, bookId: selectedBook.id }, "Kitap ödünç verildi.");
    setBookQuery("");
  };
  return (
    <section>
      <PageHead
        title="Ödünç Verme ve İade"
        text="Öğrenciyi ve raftaki kitabı seçerek işlemi saniyeler içinde tamamlayın."
      />
      <div className="circulation">
        <Card title="Yeni Ödünç">
          <div className="step">
            <b>1</b>
            <label>
              QR / Öğrenci No / Ad Soyad
              <input list="student-options" value={studentQuery} onChange={(e) => setStudentQuery(e.target.value)} placeholder="QR okutun veya yazmaya başlayın…" autoComplete="off" />
              <datalist id="student-options">{students.map((x) => <option key={x.id} value={`${x.studentNo} · ${x.fullName} · ${x.grade}`} />)}</datalist>
              {selectedStudent && <small className="match-ok">✓ {selectedStudent.fullName} · {selectedStudent.grade}</small>}
            </label>
          </div>
          <div className="step">
            <b>2</b>
            <label>
              QR / DN / ISBN / Kitap Adı
              <input list="book-options" value={bookQuery} onChange={(e) => setBookQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void lend(); }} placeholder="QR okutun veya yazmaya başlayın…" autoComplete="off" />
              <datalist id="book-options">{books.map((x) => <option key={x.id} value={`${x.inventoryNo} · ${x.title} · ${x.author}`} />)}</datalist>
              {selectedBook && <small className="match-ok">✓ {selectedBook.title} · {selectedBook.author}</small>}
            </label>
          </div>
          <button
            className="primary full"
            disabled={busy || !selectedStudent || !selectedBook}
            onClick={() => void lend()}
          >
            Ödünç ver
          </button>
        </Card>
        <Card title="Ödünçteki Kitaplar">
          <LoanTable
            rows={active}
            showReturn
            onReturn={(id) =>
              act("return", { loanId: id }, "Kitap teslim alındı.")
            }
            onRenew={(id) =>
              act(
                "renewLoan",
                { loanId: id },
                "Kitabın teslim süresi uzatıldı.",
              )
            }
            busy={busy}
          />
        </Card>
      </div>
    </section>
  );
}

function Books({
  books,
  active,
  busy,
  act,
  readOnly = false,
}: {
  books: Book[];
  active: Loan[];
  busy: boolean;
  act: (a: string, p: Record<string, unknown>, s: string) => Promise<void>;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);
  const [q, setQ] = useState("");
  const shown = books.filter((x) =>
    `${x.inventoryNo} ${x.isbn} ${x.title} ${x.author}`
      .toLocaleLowerCase("tr")
      .includes(q.toLocaleLowerCase("tr")),
  );
  const exportRows = () =>
    downloadExcel(
      "kitap-listesi.xlsx",
      "Kitaplar",
      books.map((x) => ({
        DN: x.inventoryNo,
        ISBN: x.isbn,
        "KİTAP ADI": x.title,
        YAZARI: x.author,
        YAYINEVİ: x.publisher,
        KATEGORİ: x.category,
        TÜR: x.genre,
        "RAF NO": x.shelf,
        "DEWEY KODU": x.dewey,
        "SAYFA SAYISI": x.pages,
      })),
    );
  const importFile = async (file: File) => {
    const raw = await readExcel(file);
    const rows = raw.map((row) => ({
      inventoryNo: pick(row, ["DN", "DEMİRBAŞ NO"]),
      isbn: pick(row, ["ISBN", "ISBN NO"]),
      title: pick(row, ["KİTAP ADI", "KITAP ADI"]),
      author: pick(row, ["YAZARI", "YAZAR"]),
      publisher: pick(row, ["YAYINEVİ", "YAYINEVI"]),
      category: pick(row, ["KATEGORİ", "KATEGORI"]),
      genre: pick(row, ["TÜR", "TUR"]),
      shelf: pick(row, ["RAF NO", "RAF"]),
      dewey: pick(row, ["DEWEY KODU", "DEWEY"]),
      pages: pick(row, ["SAYFA SAYISI", "SAYFA"]),
    }));
    await act(
      "importBooks",
      { rows },
      "Kitap Excel dosyası işlendi; mükerrer ve eksik kayıtlar atlandı.",
    );
  };
  const imageChanged = async (book: Book, file: File) => {
    try {
      await uploadImage(file, "book", book.inventoryNo);
      await act("noop", {}, "Kapak yüklendi.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Kapak yüklenemedi.");
    }
  };
  return (
    <section>
      <PageHead
        title="Kitaplar"
        text="Katalog kayıtlarını arayın, raf durumunu izleyin ve kapak görsellerini yönetin."
        action={
          readOnly ? undefined : (
            <div className="actions">
              <button className="secondary" onClick={exportRows}>
                Dışa aktar
              </button>
              <label className="import-btn">
                İçe aktar
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void importFile(file);
                    e.target.value = "";
                  }}
                />
              </label>
              <button
                className="primary"
                onClick={() => {
                  setEditing(null);
                  setOpen(!open);
                }}
              >
                + Kitap ekle
              </button>
            </div>
          )
        }
      />
      {open && (
        <BookForm
          busy={busy}
          initial={editing}
          submit={async (p) => {
            await act(
              editing ? "updateBook" : "addBook",
              editing ? { ...p, id: editing.id } : p,
              editing ? "Kitap güncellendi." : "Kitap kataloğa eklendi.",
            );
            setOpen(false);
            setEditing(null);
          }}
          onDelete={
            editing
              ? async () => {
                  if (confirm("Bu kitabı silmek istediğinize emin misiniz?")) {
                    await act(
                      "deleteBook",
                      { id: editing.id },
                      "Kitap silindi.",
                    );
                    setOpen(false);
                    setEditing(null);
                  }
                }
              : undefined
          }
        />
      )}
      <Search
        value={q}
        setValue={setQ}
        placeholder="Kitap adı, yazar, DN veya ISBN ile ara"
      />
      <div className="book-grid">
        {shown.map((book) => (
          <article className="book" key={book.id}>
            <ImageThumb
              src={book.coverKey ? mediaUrl(book.coverKey) : ""}
              alt={`${book.title} kapak görseli`}
              fallback={book.title.slice(0, 1)}
            />
            <div>
              <span
                className={
                  active.some((x) => x.bookId === book.id)
                    ? "badge red"
                    : "badge green"
                }
              >
                {active.some((x) => x.bookId === book.id) ? "Ödünçte" : "Rafta"}
              </span>
              <h3>{book.title}</h3>
              <p>{book.author}</p>
              <small>
                {book.inventoryNo} · {book.shelf || "Raf belirtilmedi"}
              </small>
              {!readOnly && (
                <div className="inline-actions">
                  <label className="image-upload">
                    {book.coverKey ? "Kapağı değiştir" : "Kapak ekle"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void imageChanged(book, file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <button
                    className="edit-link"
                    onClick={() => {
                      setEditing(book);
                      setOpen(true);
                    }}
                  >
                    Düzenle
                  </button>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
      {!shown.length && <Empty text="Aramanızla eşleşen kitap bulunamadı." />}
    </section>
  );
}

function Students({
  students,
  loans,
  busy,
  act,
}: {
  students: Student[];
  loans: Loan[];
  busy: boolean;
  act: (a: string, p: Record<string, unknown>, s: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [classes, setClasses] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [newGrade, setNewGrade] = useState("");
  const [q, setQ] = useState("");
  const shown = students.filter((x) =>
    `${x.studentNo} ${x.fullName} ${x.grade}`
      .toLocaleLowerCase("tr")
      .includes(q.toLocaleLowerCase("tr")),
  );
  const gradeList = [...new Set(students.map((x) => x.grade))].sort((a, b) =>
    a.localeCompare(b, "tr", { numeric: true }),
  );
  const [eokul, setEokul] = useState(false);
  const [syncFile, setSyncFile] = useState<File | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const exportRows = () =>
    downloadExcel(
      "ogrenci-listesi.xlsx",
      "Öğrenciler",
      students.map((x) => ({
        "ÖĞRENCİ NO": x.studentNo,
        "ADI SOYADI": x.fullName,
        SINIFI: x.grade,
        TELEFON: x.contact,
        "E-POSTA": x.email,
      })),
    );
  const mapRows = (raw: Record<string, unknown>[]) =>
    raw.map((row) => ({
      studentNo: pick(row, ["ÖĞRENCİ NO", "OGRENCI NO", "NUMARA", "NO"]),
      fullName: pick(row, ["ADI SOYADI", "AD SOYAD"]),
      grade: pick(row, ["SINIFI", "SINIF"]),
      contact: pick(row, ["İLETİŞİM", "ILETISIM", "TELEFON", "VELİ TELEFON"]),
      email: pick(row, ["E-POSTA", "EPOSTA", "EMAIL"]),
    }));
  const importFile = async (file: File) =>
    act(
      "importStudents",
      { rows: mapRows(await readExcel(file)) },
      "Öğrenci Excel dosyası işlendi; mükerrer ve eksik kayıtlar atlandı.",
    );
  const syncEokul = async () => {
    if (!syncFile) return;
    await act(
      "syncStudents",
      { rows: mapRows(await readExcel(syncFile)) },
      "e-Okul aktarımıyla öğrenci bilgileri eşleştirildi ve değişiklik geçmişi kaydedildi.",
    );
    for (const file of photoFiles) {
      const no = file.name.replace(/\.[^.]+$/, "").trim();
      try {
        await uploadImage(file, "student", no);
      } catch {
        /* unmatched photos are safely skipped */
      }
    }
    if (photoFiles.length)
      await act(
        "noop",
        {},
        "e-Okul bilgileri ve öğrenci numarasıyla eşleşen fotoğraflar güncellendi.",
      );
    setSyncFile(null);
    setPhotoFiles([]);
  };
  const imageChanged = async (student: Student, file: File) => {
    try {
      await uploadImage(file, "student", student.studentNo);
      await act("noop", {}, "Öğrenci fotoğrafı yüklendi.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Fotoğraf yüklenemedi.");
    }
  };
  return (
    <section>
      <PageHead
        title="Öğrenciler"
        text="Öğrenci bilgilerini, fotoğrafları, e-posta adreslerini ve sınıf değişikliklerini yönetin."
        action={
          <div className="actions">
            <button className="secondary" onClick={exportRows}>
              Dışa aktar
            </button>
            <label className="import-btn">
              İçe aktar
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void importFile(file);
                  e.target.value = "";
                }}
              />
            </label>
            <button className="secondary" onClick={() => setEokul(!eokul)}>
              e-Okul’dan güncelle
            </button>
            <button className="secondary" onClick={() => setClasses(!classes)}>
              Sınıf düzenle
            </button>
            <button
              className="primary"
              onClick={() => {
                setEditing(null);
                setOpen(!open);
              }}
            >
              + Öğrenci ekle
            </button>
          </div>
        }
      />
      {eokul && (
        <div className="panel sync-panel">
          <div>
            <strong>e-Okul güvenli güncelleme</strong>
            <p className="muted">
              Yetkili kişinin e-Okul’dan aldığı Excel dosyasını yükleyin.
              Kayıtlar öğrenci numarasına göre eşleşir; sınıf, iletişim ve
              e-posta değişiklikleri geçmişe yazılır. Fotoğrafları 123.jpg
              biçiminde öğrenci numarasıyla adlandırın.
            </p>
          </div>
          <label className="import-btn">
            e-Okul Excel’i seç
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setSyncFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <label className="import-btn">
            Fotoğraf klasörünü seç
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) =>
                setPhotoFiles([...Array.from(e.target.files ?? [])])
              }
            />
          </label>
          <button
            className="primary"
            disabled={!syncFile || busy}
            onClick={() => void syncEokul()}
          >
            Güncellemeyi uygula
          </button>
        </div>
      )}
      {open && (
        <StudentForm
          busy={busy}
          initial={editing}
          submit={async (p) => {
            await act(
              editing ? "updateStudent" : "addStudent",
              editing ? { ...p, id: editing.id } : p,
              editing ? "Öğrenci güncellendi." : "Öğrenci kaydedildi.",
            );
            setOpen(false);
            setEditing(null);
          }}
          onDelete={
            editing
              ? async () => {
                  if (
                    confirm("Bu öğrenciyi silmek istediğinize emin misiniz?")
                  ) {
                    await act(
                      "deleteStudent",
                      { id: editing.id },
                      "Öğrenci silindi.",
                    );
                    setOpen(false);
                    setEditing(null);
                  }
                }
              : undefined
          }
        />
      )}{" "}
      {classes && (
        <div className="panel class-manager">
          <div>
            <strong>Sınıf yönetimi</strong>
            <p className="muted">
              Öğrencileri seçin; fotoğraf ve geçmiş kayıtları korunarak yeni
              sınıfa taşıyın.
            </p>
          </div>
          <select
            value={newGrade}
            onChange={(e) => setNewGrade(e.target.value)}
          >
            <option value="">Yeni sınıf…</option>
            {gradeList.map((g) => (
              <option key={g}>{g}</option>
            ))}
            <option value="9-A">9-A</option>
          </select>
          <button
            className="primary"
            disabled={!selected.size || !newGrade || busy}
            onClick={async () => {
              await act(
                "changeGrades",
                { ids: [...selected], grade: newGrade },
                "Seçilen öğrencilerin sınıfı değiştirildi.",
              );
              setSelected(new Set());
            }}
          >
            Seçilenleri taşı
          </button>
        </div>
      )}
      <Search
        value={q}
        setValue={setQ}
        placeholder="Öğrenci no, ad soyad veya sınıf ile ara"
      />
      <div className="table-card">
        <table>
          <thead>
            <tr>
              {classes && <th>Seç</th>}
              <th>Fotoğraf</th>
              <th>Öğrenci</th>
              <th>Sınıf</th>
              <th>İletişim</th>
              <th>E-posta</th>
              <th>Okuduğu</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((x) => (
              <tr key={x.id}>
                {classes && (
                  <td>
                    <input
                      className="row-check"
                      type="checkbox"
                      checked={selected.has(x.id)}
                      onChange={() =>
                        setSelected((current) => {
                          const next = new Set(current);
                          next.has(x.id) ? next.delete(x.id) : next.add(x.id);
                          return next;
                        })
                      }
                    />
                  </td>
                )}
                <td>
                  <ImageThumb
                    small
                    src={x.photoKey ? mediaUrl(x.photoKey) : ""}
                    alt={`${x.fullName} fotoğrafı`}
                    fallback={x.fullName.slice(0, 1)}
                  />
                  <label className="image-upload compact">
                    {x.photoKey ? "Değiştir" : "Ekle"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void imageChanged(x, file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </td>
                <td>
                  <strong>{x.fullName}</strong>
                  <small>{x.studentNo}</small>
                </td>
                <td>
                  <span className="badge blue">{x.grade}</span>
                </td>
                <td>{x.contact || "—"}</td>
                <td>{x.email || "—"}</td>
                <td>
                  {
                    loans.filter((l) => l.studentId === x.id && l.returnedAt)
                      .length
                  }
                </td>
                <td>
                  <button
                    className="small"
                    onClick={() => {
                      setEditing(x);
                      setOpen(true);
                    }}
                  >
                    Düzenle
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Overdue({
  rows,
  today,
  dailyFine,
  busy,
  act,
}: {
  rows: Loan[];
  today: string;
  dailyFine: number;
  busy: boolean;
  act: (a: string, p: Record<string, unknown>, s: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Set<number>>(
    new Set(rows.filter((x) => x.email).map((x) => x.id)),
  );
  return (
    <section>
      <PageHead
        title="Geç Kalanlar"
        text="Teslim tarihi geçen kitapları takip edin ve e-posta adresi bulunan öğrencilere toplu hatırlatma gönderin."
        action={
          <button
            className="primary"
            disabled={busy || !selected.size}
            onClick={() =>
              confirm(
                `${selected.size} gecikme kaydı için e-posta gönderilsin mi?`,
              ) &&
              act(
                "sendOverdueEmails",
                { loanIds: [...selected] },
                "Gecikme e-postaları gönderim servisine iletildi.",
              )
            }
          >
            Seçilenlere e-posta gönder
          </button>
        }
      />
      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Seç</th>
              <th>Öğrenci</th>
              <th>Kitap</th>
              <th>Son Teslim</th>
              <th>Gecikme</th>
              <th>Ceza</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => (
              <tr key={x.id}>
                <td>
                  <input
                    type="checkbox"
                    disabled={!x.email}
                    checked={selected.has(x.id)}
                    onChange={() =>
                      setSelected((current) => {
                        const next = new Set(current);
                        next.has(x.id) ? next.delete(x.id) : next.add(x.id);
                        return next;
                      })
                    }
                  />
                </td>
                <td>
                  <strong>{x.studentName}</strong>
                  <small>
                    {x.studentNo} · {x.grade} · {x.email || "E-posta yok"}
                  </small>
                </td>
                <td>
                  {x.bookTitle}
                  <small>
                    {x.author} · {fmt(x.loanedAt)} tarihinde alındı
                  </small>
                </td>
                <td>{fmt(x.dueAt)}</td>
                <td>
                  <span className="badge red">
                    {daysBetween(x.dueAt, today)} gün
                  </span>
                </td>
                <td>
                  {(
                    (daysBetween(x.dueAt, today) * dailyFine) /
                    100
                  ).toLocaleString("tr-TR", {
                    style: "currency",
                    currency: "TRY",
                  })}
                </td>
                <td>
                  <button
                    className="small"
                    disabled={busy}
                    onClick={() =>
                      act("return", { loanId: x.id }, "Kitap teslim alındı.")
                    }
                  >
                    İade al
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty text="Geciken kitap bulunmuyor." />}
      </div>
    </section>
  );
}

function Requests({
  rows,
  students,
  busy,
  act,
  studentMode = false,
}: {
  rows: BookRequest[];
  students: Student[];
  busy: boolean;
  act: (a: string, p: Record<string, unknown>, s: string) => Promise<void>;
  studentMode?: boolean;
}) {
  const [studentId, setStudentId] = useState(
    studentMode && students[0] ? String(students[0].id) : "",
  );
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [note, setNote] = useState("");
  const submit = async () => {
    await act(
      "addBookRequest",
      { studentId: Number(studentId), title, author, note },
      "Kitap talebi yöneticinin listesine eklendi.",
    );
    setTitle("");
    setAuthor("");
    setNote("");
  };
  return (
    <section>
      <PageHead
        title="Kitap Talepleri"
        text="Öğrencilerin kütüphanede görmek istedikleri kitapları kaydedin ve değerlendirin."
      />
      <div className="grid-2 requests-layout">
        <Card title="Yeni Kitap Talebi">
          <div className="form-grid one">
            <label>
              Öğrenci
              <select
                disabled={studentMode}
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
              >
                <option value="">Öğrenci seçin…</option>
                {students.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.studentNo} · {x.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Kitap adı
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label>
              Yazar
              <input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
              />
            </label>
            <label>
              Neden kütüphanede olmalı?
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <button
              className="primary"
              disabled={busy || !studentId || !title}
              onClick={() => void submit()}
            >
              Talebi gönder
            </button>
          </div>
        </Card>
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Öğrenci</th>
                <th>İstenen Kitap</th>
                <th>Not</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.studentName}</strong>
                    <small>{row.studentNo}</small>
                  </td>
                  <td>
                    <strong>{row.title}</strong>
                    <small>{row.author || "Yazar belirtilmedi"}</small>
                  </td>
                  <td>{row.note || "—"}</td>
                  <td>
                    {studentMode ? (
                      <span className="badge blue">{row.status}</span>
                    ) : (
                      <select
                        value={row.status}
                        disabled={busy}
                        onChange={(e) =>
                          void act(
                            "updateBookRequest",
                            { id: row.id, status: e.target.value },
                            "Talep durumu güncellendi.",
                          )
                        }
                      >
                        <option value="new">Yeni</option>
                        <option value="reviewed">İnceleniyor</option>
                        <option value="approved">Onaylandı</option>
                        <option value="rejected">Uygun değil</option>
                        <option value="purchased">Temin edildi</option>
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <Empty text="Henüz kitap talebi yok." />}
        </div>
      </div>
    </section>
  );
}

function Assistant({ students }: { students: Student[] }) {
  const [studentId, setStudentId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const ask = async (text = prompt) => {
    if (!text.trim()) return;
    setBusy(true);
    setAnswer("");
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          studentId: Number(studentId) || undefined,
        }),
      });
      const result = (await response.json()) as {
        answer?: string;
        error?: string;
      };
      if (!response.ok)
        throw new Error(result.error || "Asistan yanıt veremedi.");
      setAnswer(result.answer || "");
    } catch (error) {
      setAnswer(
        error instanceof Error ? error.message : "Asistan yanıt veremedi.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section>
      <PageHead
        title="Kütüphane Asistanı"
        text="Katalog ve öğrencinin okuma geçmişine göre güvenli, yaşa uygun kitap önerileri alın."
        action={<span className="badge blue">Kütüphane kapsamı</span>}
      />
      <div className="assistant-tabs">
        <button className="active">Kitap Önerisi</button>
        <button
          onClick={() =>
            void ask(
              "Kütüphane koleksiyonunun güçlü ve eksik yönlerini özetle.",
            )
          }
        >
          Koleksiyon Analizi
        </button>
        <button
          onClick={() =>
            void ask("Okumayı teşvik edecek kısa bir kitap listesi oluştur.")
          }
        >
          Liste Oluştur
        </button>
      </div>
      <div className="assistant-grid">
        <Card title="Öğrenci Seç">
          <div className="form-grid one">
            <label>
              Öğrenci No / Adı Soyadı
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
              >
                <option value="">Genel öneri</option>
                {students.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.studentNo} · {x.fullName} · {x.grade}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                void ask(
                  "Seçilen öğrencinin okuma geçmişine uygun, kütüphanede bulunan beş kitap öner.",
                )
              }
            >
              ✧ Kitap Önerisi Al
            </button>
            <p className="muted">
              Asistan yalnızca kütüphane ve kitap konularında yanıt verir;
              iletişim bilgilerini kullanmaz.
            </p>
          </div>
        </Card>
        <Card title="Asistanın Yanıtı">
          <div className="assistant-answer">
            {busy
              ? "Öneriler hazırlanıyor…"
              : answer ||
                "Bir öğrenci seçip öneri alın veya aşağıdaki kutudan kütüphane hakkında soru sorun."}
          </div>
          <div className="assistant-input">
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void ask();
              }}
              placeholder="Kütüphane hakkında sorunuzu yazın…"
            />
            <button
              className="primary"
              disabled={busy || !prompt.trim()}
              onClick={() => void ask()}
            >
              Gönder
            </button>
          </div>
        </Card>
      </div>
    </section>
  );
}

function Reports({ data }: { data: Data }) {
  const completed = data.loans.filter((x) => x.returnedAt);
  const readers = Object.values(
    completed.reduce<
      Record<number, { name: string; grade: string; count: number }>
    >((acc, x) => {
      acc[x.studentId] ??= { name: x.studentName, grade: x.grade, count: 0 };
      acc[x.studentId].count++;
      return acc;
    }, {}),
  ).sort((a, b) => b.count - a.count);
  const titles = Object.values(
    data.loans.reduce<
      Record<string, { title: string; author: string; count: number }>
    >((acc, x) => {
      const key = `${x.bookTitle}|${x.author}`;
      acc[key] ??= { title: x.bookTitle, author: x.author, count: 0 };
      acc[key].count++;
      return acc;
    }, {}),
  ).sort((a, b) => b.count - a.count);
  return (
    <section>
      <PageHead
        title="Raporlar ve İstatistikler"
        text={`${data.settings.schoolYear} döneminin okuma hareketlerini inceleyin.`}
      />
      <div className="grid-2">
        <Card title="En Çok Okuyan Öğrenciler">
          <Ranking
            rows={readers.map((x) => [
              x.name,
              `${x.grade} · ${x.count} kitap`,
              x.count,
            ])}
          />
        </Card>
        <Card title="En Çok Okunan Kitaplar">
          <Ranking
            rows={titles.map((x) => [
              x.title,
              `${x.author} · ${x.count} ödünç`,
              x.count,
            ])}
          />
        </Card>
      </div>
    </section>
  );
}

function Inventory({ books, active }: { books: Book[]; active: Loan[] }) {
  const [query, setQuery] = useState("");
  const [genreFilter, setGenreFilter] = useState("");
  const presetGenres = [
    "İNGİLİZ EDEBİYATI",
    "FRANSIZ EDEBİYATI",
    "ŞİİR",
    "DENEME MAKALE",
    "TÜRK ROMAN HİKAYE",
  ];
  const genres = [
    ...new Set([...presetGenres, ...books.map((x) => x.genre).filter(Boolean)]),
  ].sort((a, b) => a.localeCompare(b, "tr"));
  const shelfLetter = (author: string) =>
    (author.trim().split(/\s+/).at(-1)?.[0] ?? "?").toLocaleUpperCase("tr");
  const groupedBooks = books
    .filter((x) => !genreFilter || x.genre === genreFilter)
    .sort(
      (a, b) =>
        shelfLetter(a.author).localeCompare(shelfLetter(b.author), "tr") ||
        a.author.localeCompare(b.author, "tr"),
    );
  const [rows, setRows] = useState<
    Array<{ query: string; book?: Book; status: string }>
  >([]);
  const check = () => {
    const needle = query.trim().toLocaleLowerCase("tr");
    if (!needle) return;
    const book = books.find((x) =>
      `${x.title} ${x.inventoryNo} ${x.isbn} ${x.genre}`
        .toLocaleLowerCase("tr")
        .includes(needle),
    );
    setRows((v) => [
      {
        query: query.trim(),
        book,
        status: book
          ? active.some((l) => l.bookId === book.id)
            ? "Ödünçte"
            : "Rafta"
          : "Eksik / Kayıtsız",
      },
      ...v,
    ]);
    setQuery("");
  };
  const download = () => {
    const csv = [
      "Aranan,Kitap,DN,ISBN,Raf,Durum",
      ...rows.map((x) =>
        [
          x.query,
          x.book?.title ?? "",
          x.book?.inventoryNo ?? "",
          x.book?.isbn ?? "",
          x.book?.shelf ?? "",
          x.status,
        ]
          .map((v) => `\"${String(v).replaceAll('"', '""')}\"`)
          .join(","),
      ),
    ].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kitap-sayim-raporu.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section>
      <PageHead
        title="Kitap Sayımı ve Raf Kontrol"
        text="Kitapları tek tek kontrol edin; tür ve yazar soyadının raf harfine göre raftaki adetleri görün."
        action={
          <button
            className="secondary"
            disabled={!rows.length}
            onClick={download}
          >
            Raporu indir
          </button>
        }
      />
      <div className="panel inventory-filters">
        <label>
          TÜR
          <select
            value={genreFilter}
            onChange={(e) => setGenreFilter(e.target.value)}
          >
            <option value="">Tüm türler</option>
            {genres.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <div>
          <strong>{groupedBooks.length}</strong>
          <small>Seçili türde toplam</small>
        </div>
        <div>
          <strong>
            {
              groupedBooks.filter((x) => !active.some((l) => l.bookId === x.id))
                .length
            }
          </strong>
          <small>Rafta bulunan</small>
        </div>
      </div>
      <div className="table-card genre-shelf-table">
        <table>
          <thead>
            <tr>
              <th>Tür</th>
              <th>Raf Harfi</th>
              <th>Yazar</th>
              <th>Kitap</th>
              <th>Rafta</th>
            </tr>
          </thead>
          <tbody>
            {groupedBooks.map((book) => (
              <tr key={book.id}>
                <td>{book.genre || "Tür belirtilmedi"}</td>
                <td>
                  <span className="shelf-letter">
                    {shelfLetter(book.author)}
                  </span>
                </td>
                <td>{book.author}</td>
                <td>
                  {book.title}
                  <small>{book.inventoryNo}</small>
                </td>
                <td>
                  {active.some((l) => l.bookId === book.id) ? (
                    <span className="badge red">Ödünçte</span>
                  ) : (
                    <span className="badge green">Rafta</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="inventory">
        <Card title="Kitap Sorgula">
          <div className="form-grid one">
            <label>
              Kitap Adı / DN / ISBN
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") check();
                }}
                placeholder="örn. DN-001 veya kitap adı"
              />
            </label>
            <button className="primary" onClick={check}>
              Kontrol et
            </button>
          </div>
          <div className="inventory-summary">
            <span>
              <b>{rows.length}</b> Sayılan
            </span>
            <span>
              <b>{rows.filter((x) => x.status === "Rafta").length}</b> Rafta
            </span>
            <span>
              <b>{rows.filter((x) => x.status === "Ödünçte").length}</b> Ödünçte
            </span>
            <span>
              <b>{rows.filter((x) => x.status.startsWith("Eksik")).length}</b>{" "}
              Eksik
            </span>
          </div>
        </Card>
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Aranan</th>
                <th>Kitap</th>
                <th>DN / ISBN</th>
                <th>Raf</th>
                <th>Tür</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x, i) => (
                <tr key={`${x.query}-${i}`}>
                  <td>{x.query}</td>
                  <td>
                    <strong>{x.book?.title || "—"}</strong>
                    <small>
                      {x.book?.author || "Kütüphane kaydında bulunamadı"}
                    </small>
                  </td>
                  <td>
                    {x.book
                      ? `${x.book.inventoryNo} / ${x.book.isbn || "—"}`
                      : "—"}
                  </td>
                  <td>{x.book?.shelf || "—"}</td>
                  <td>{x.book?.genre || "—"}</td>
                  <td>
                    <span
                      className={
                        x.status === "Rafta" ? "badge green" : "badge red"
                      }
                    >
                      {x.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <Empty text="Kontrol edilen kitaplar burada listelenecek." />
          )}
        </div>
      </div>
    </section>
  );
}

function Settings({
  config,
  students,
  users,
  membershipRequests,
  empty,
  busy,
  act,
}: {
  config: Data["settings"];
  students: Student[];
  users: AppUser[];
  membershipRequests: MembershipRequest[];
  empty: boolean;
  busy: boolean;
  act: (a: string, p: Record<string, unknown>, s: string) => Promise<void>;
}) {
  const [form, setForm] = useState(config);
  const [graduate, setGraduate] = useState("");
  const [userForm, setUserForm] = useState({
    displayName: "",
    email: "",
    role: "student",
    studentId: "",
  });
  const grades = [...new Set(students.map((x) => x.grade))].sort((a, b) =>
    a.localeCompare(b, "tr", { numeric: true }),
  );
  const themes = [
    { id: "forest", name: "Orman", hint: "Georgia + Inter" },
    { id: "navy", name: "Akademik", hint: "Trebuchet + Segoe UI" },
    { id: "plum", name: "Edebiyat", hint: "Palatino + Verdana" },
    { id: "sand", name: "Klasik", hint: "Garamond + Tahoma" },
    { id: "ocean", name: "Okyanus", hint: "Arial + Georgia" },
    { id: "ruby", name: "Yakut", hint: "Segoe UI + Cambria" },
    { id: "slate", name: "Antrasit", hint: "Roboto + Trebuchet" },
    { id: "teal", name: "Turkuaz", hint: "Verdana + Georgia" },
    { id: "indigo", name: "İndigo", hint: "Segoe UI + Palatino" },
    { id: "rose", name: "Gül", hint: "Tahoma + Cambria" },
  ];
  const chooseTheme = (theme: string) => {
    setForm({ ...form, theme });
    document.documentElement.setAttribute("data-theme", theme);
  };
  const changeLogo = async (file: File) => {
    try {
      await uploadImage(file, "logo", "school");
      await act("noop", {}, "Okul logosu güncellendi.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Logo yüklenemedi.");
    }
  };
  return (
    <section>
      <PageHead
        title="Kütüphane Ayarları"
        text="Kurum bilgilerini, görünümü, ödünç süresini ve e-posta göndericisini düzenleyin."
      />
      <div className="grid-2">
        <Card title="Genel Ayarlar">
          <div className="form-grid one">
            <label>Şehir<input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
            <label>İlçe<input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} /></label>
            <label>Okul adı<input value={form.schoolName} onChange={(e) => setForm({ ...form, schoolName: e.target.value })} /></label>
            <label>Kurum kodu<input value={form.institutionCode} onChange={(e) => setForm({ ...form, institutionCode: e.target.value })} /></label>
            <label>
              Kütüphane adı
              <input
                value={form.libraryName}
                onChange={(e) =>
                  setForm({ ...form, libraryName: e.target.value })
                }
              />
            </label>
            <label>
              Eğitim-öğretim yılı
              <input
                value={form.schoolYear}
                onChange={(e) =>
                  setForm({ ...form, schoolYear: e.target.value })
                }
              />
            </label>
            <label>
              Ödünç süresi (gün)
              <input
                type="number"
                min="1"
                value={form.loanDays}
                onChange={(e) =>
                  setForm({ ...form, loanDays: Number(e.target.value) })
                }
              />
            </label>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                act("settings", form, "Ayarlar ve arayüz teması kaydedildi.")
              }
            >
              Ayarları kaydet
            </button>
          </div>
        </Card>
        <Card title={`Öğrenci Üyelik Başvuruları (${membershipRequests.filter((x) => x.status === "pending").length})`}>
          <div className="approval-list">
            {membershipRequests.filter((x) => x.status === "pending").map((row) => (
              <article key={row.id}>
                <div><strong>{row.fullName}</strong><small>{row.grade} · No {row.studentNo} · {row.email}</small><small>{row.city} / {row.district} · {row.schoolName}</small></div>
                <div className="actions"><button className="small" disabled={busy} onClick={() => act("rejectMembership", { id: row.id }, "Başvuru reddedildi.")}>Reddet</button><button className="primary small" disabled={busy} onClick={() => act("approveMembership", { id: row.id }, "Öğrenci hesabı onaylandı.")}>Onayla</button></div>
              </article>
            ))}
            {!membershipRequests.some((x) => x.status === "pending") && <p className="empty">Bekleyen üyelik başvurusu yok.</p>}
          </div>
        </Card>
        <Card title="Okul Logosu">
          <div className="logo-settings">
            {config.logoKey ? (
              <img src={mediaUrl(config.logoKey)} alt="Yüklü okul logosu" />
            ) : (
              <div className="logo-placeholder">LOGO</div>
            )}
            <div>
              <p className="muted">
                JPG, PNG veya WebP biçiminde en fazla 5 MB. Logo ana panelin üst
                bölümünde gösterilir.
              </p>
              <label className="import-btn">
                Logo seç
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void changeLogo(file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>
        </Card>
        <Card title="Süre Uzatma ve Gecikme">
          <div className="form-grid one">
            <label>
              Her uzatmada eklenecek gün
              <input
                type="number"
                min="1"
                value={form.extensionDays}
                onChange={(e) =>
                  setForm({ ...form, extensionDays: Number(e.target.value) })
                }
              />
            </label>
            <label>
              En fazla uzatma sayısı
              <input
                type="number"
                min="0"
                value={form.maxRenewals}
                onChange={(e) =>
                  setForm({ ...form, maxRenewals: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Günlük gecikme bedeli (kuruş)
              <input
                type="number"
                min="0"
                value={form.dailyFine}
                onChange={(e) =>
                  setForm({ ...form, dailyFine: Number(e.target.value) })
                }
              />
            </label>
            <p className="muted">
              Ceza, gecikilen gün × günlük tutar olarak hesaplanır. 100 kuruş =
              1 TL.
            </p>
            <button
              className="secondary"
              disabled={busy}
              onClick={() =>
                act(
                  "settings",
                  form,
                  "Süre uzatma ve gecikme ayarları kaydedildi.",
                )
              }
            >
              Kuralları kaydet
            </button>
          </div>
        </Card>
        <Card title="Kullanıcı ve Yetki Yönetimi">
          <div className="form-grid one">
            <label>
              Ad soyad
              <input
                value={userForm.displayName}
                onChange={(e) =>
                  setUserForm({ ...userForm, displayName: e.target.value })
                }
              />
            </label>
            <label>
              Giriş e-postası
              <input
                type="email"
                value={userForm.email}
                onChange={(e) =>
                  setUserForm({ ...userForm, email: e.target.value })
                }
              />
            </label>
            <label>
              Yetki
              <select
                value={userForm.role}
                onChange={(e) =>
                  setUserForm({ ...userForm, role: e.target.value })
                }
              >
                <option value="admin">Yönetici</option>
                <option value="staff">Kütüphane görevlisi</option>
                <option value="student">Öğrenci</option>
              </select>
            </label>
            {userForm.role === "student" && (
              <label>
                Öğrenci kaydı
                <select
                  value={userForm.studentId}
                  onChange={(e) =>
                    setUserForm({ ...userForm, studentId: e.target.value })
                  }
                >
                  <option value="">Seçin…</option>
                  {students.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.studentNo} · {x.fullName}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              className="primary"
              disabled={busy || !userForm.email || !userForm.displayName}
              onClick={() =>
                act(
                  "upsertUser",
                  {
                    ...userForm,
                    studentId: Number(userForm.studentId) || null,
                  },
                  "Kullanıcı ve yetkisi kaydedildi.",
                )
              }
            >
              Kullanıcıyı kaydet / güncelle
            </button>
            <div className="user-list">
              {users.map((user) => (
                <span key={user.id}>
                  <strong>{user.displayName}</strong>
                  <small>
                    {user.email} · {user.role}
                  </small>
                </span>
              ))}
            </div>
            <p className="muted">
              Parola uygulamada saklanmaz; güvenli oturum açma sağlayıcısı
              kullanılır.
            </p>
          </div>
        </Card>
        <Card title="E-posta Hesabı">
          <div className="form-grid one">
            <label>
              Gönderen adı
              <input
                value={form.senderName}
                onChange={(e) =>
                  setForm({ ...form, senderName: e.target.value })
                }
                placeholder="Çankırı Lisesi Kütüphanesi"
              />
            </label>
            <label>
              Doğrulanmış gönderen e-posta
              <input
                type="email"
                value={form.senderEmail}
                onChange={(e) =>
                  setForm({ ...form, senderEmail: e.target.value })
                }
                placeholder="kutuphane@okul.edu.tr"
              />
            </label>
            <p className="muted">
              Toplu gönderim için bu adres e-posta servisinde doğrulanmalıdır.
              Servis anahtarı tarayıcıda veya veritabanında tutulmaz.
            </p>
            <button
              className="secondary"
              disabled={busy}
              onClick={() =>
                act("settings", form, "E-posta gönderici bilgileri kaydedildi.")
              }
            >
              Göndericiyi kaydet
            </button>
          </div>
        </Card>
        <Card title="Arayüz Rengi ve Yazı Tipi">
          <div className="theme-grid">
            {themes.map((theme) => (
              <button
                key={theme.id}
                data-theme-option={theme.id}
                className={form.theme === theme.id ? "selected" : ""}
                onClick={() => chooseTheme(theme.id)}
              >
                <i />
                <strong>{theme.name}</strong>
                <small>{theme.hint}</small>
              </button>
            ))}
          </div>
          <p className="theme-note">
            Tema seçildiğinde renk paleti, başlık karakteri ve arayüz yazı tipi
            birlikte değişir.
          </p>
        </Card>
        <Card title="Öğretim Yılı İşlemleri">
          <div className="form-grid one">
            <p className="muted">
              Sınıf atlatma işlemi 9→10, 10→11 ve 11→12 olarak uygulanır. On
              ikinci sınıflar otomatik silinmez.
            </p>
            <button
              className="secondary"
              disabled={busy || !students.length}
              onClick={() =>
                confirm("Tüm uygun öğrenciler bir üst sınıfa geçirilsin mi?") &&
                act("promoteGrades", {}, "Öğrenciler bir üst sınıfa geçirildi.")
              }
            >
              Sınıfları topluca atlat
            </button>
            <label>
              Mezun sınıfı seç
              <select
                value={graduate}
                onChange={(e) => setGraduate(e.target.value)}
              >
                <option value="">Sınıf seçin…</option>
                {grades.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </label>
            <button
              className="danger"
              disabled={busy || !graduate}
              onClick={() =>
                confirm(`${graduate} sınıfındaki öğrenciler silinsin mi?`) &&
                act(
                  "deleteGrade",
                  { grade: graduate },
                  "Mezun sınıf kayıtları silindi.",
                )
              }
            >
              Seçili mezun sınıfı sil
            </button>
          </div>
        </Card>
        <Card title="Başlangıç Verileri">
          <p className="muted">
            Projeyi hızlıca denemek için üç öğrenci ve üç kitap
            ekleyebilirsiniz. Aynı kayıtlar ikinci kez oluşturulmaz.
          </p>
          <div className="form-grid one">
            <button
              className="secondary"
              disabled={busy || !empty}
              onClick={() => act("seed", {}, "Örnek kayıtlar eklendi.")}
            >
              {empty ? "Örnek verileri yükle" : "Örnek veriler hazır"}
            </button>
          </div>
        </Card>
      </div>
    </section>
  );
}

function BookForm({
  busy,
  initial,
  submit,
  onDelete,
}: {
  busy: boolean;
  initial: Book | null;
  submit: (p: Record<string, unknown>) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [f, setF] = useState(() =>
    initial
      ? { ...initial, pages: String(initial.pages) }
      : {
          inventoryNo: "",
          isbn: "",
          title: "",
          author: "",
          publisher: "",
          category: "",
          genre: "",
          shelf: "",
          dewey: "",
          pages: "",
        },
  );
  return (
    <form
      className="panel form-grid"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(f);
      }}
    >
      {Object.entries({
        inventoryNo: "Demirbaş No *",
        isbn: "ISBN",
        title: "Kitap Adı *",
        author: "Yazar *",
        publisher: "Yayınevi",
        category: "Kategori",
        genre: "Tür",
        shelf: "Raf No",
        dewey: "Dewey Kodu",
        pages: "Sayfa Sayısı",
      }).map(([key, label]) => (
        <label key={key}>
          {label}
          <input
            type={key === "pages" ? "number" : "text"}
            list={key === "genre" ? "genre-options" : undefined}
            value={String(f[key as keyof typeof f] ?? "")}
            onChange={(e) => setF({ ...f, [key]: e.target.value })}
          />
        </label>
      ))}
      <datalist id="genre-options">
        <option value="İNGİLİZ EDEBİYATI" />
        <option value="FRANSIZ EDEBİYATI" />
        <option value="ŞİİR" />
        <option value="DENEME MAKALE" />
        <option value="TÜRK ROMAN HİKAYE" />
      </datalist>
      <label className="check-label">
        <input
          type="checkbox"
          checked={f.blocked}
          onChange={(e) => setF({ ...f, blocked: e.target.checked })}
        />
        Bu öğrenciye kitap verilmesin
      </label>
      {f.blocked && (
        <label>
          Engel nedeni
          <select
            value={f.blockReason}
            onChange={(e) => setF({ ...f, blockReason: e.target.value })}
          >
            <option value="">Neden seçin…</option>
            <option>Çok geç iade</option>
            <option>Kitaba zarar verme</option>
            <option>Uygunsuz davranış</option>
            <option>Ödenmemiş gecikme bedeli</option>
            <option>Yönetici kararı</option>
          </select>
        </label>
      )}
      <div className="form-actions">
        {onDelete && (
          <button
            type="button"
            className="danger"
            disabled={busy}
            onClick={() => void onDelete()}
          >
            Kaydı sil
          </button>
        )}
        <button className="primary" disabled={busy}>
          {initial ? "Değişiklikleri kaydet" : "Kitabı kaydet"}
        </button>
      </div>
    </form>
  );
}
function StudentForm({
  busy,
  initial,
  submit,
  onDelete,
}: {
  busy: boolean;
  initial: Student | null;
  submit: (p: Record<string, unknown>) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [f, setF] = useState(() =>
    initial
      ? {
          studentNo: initial.studentNo,
          fullName: initial.fullName,
          grade: initial.grade,
          contact: initial.contact,
          email: initial.email,
          blocked: Boolean(initial.blocked),
          blockReason: initial.blockReason,
        }
      : {
          studentNo: "",
          fullName: "",
          grade: "",
          contact: "",
          email: "",
          blocked: false,
          blockReason: "",
        },
  );
  return (
    <form
      className="panel form-grid"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(f);
      }}
    >
      {Object.entries({
        studentNo: "Öğrenci No *",
        fullName: "Adı Soyadı *",
        grade: "Sınıfı *",
        contact: "Telefon / İletişim",
        email: "E-posta",
      }).map(([key, label]) => (
        <label key={key}>
          {label}
          <input
            type={key === "email" ? "email" : "text"}
            value={String(f[key as keyof typeof f])}
            onChange={(e) => setF({ ...f, [key]: e.target.value })}
          />
        </label>
      ))}
      <div className="form-actions">
        {onDelete && (
          <button
            type="button"
            className="danger"
            disabled={busy}
            onClick={() => void onDelete()}
          >
            Kaydı sil
          </button>
        )}
        <button className="primary" disabled={busy}>
          {initial ? "Değişiklikleri kaydet" : "Öğrenciyi kaydet"}
        </button>
      </div>
    </form>
  );
}
function ImageThumb({
  src,
  alt,
  fallback,
  small = false,
}: {
  src: string;
  alt: string;
  fallback: string;
  small?: boolean;
}) {
  const [large, setLarge] = useState(false);
  return (
    <>
      <button
        type="button"
        className={`image-thumb ${small ? "small-thumb" : ""}`}
        onClick={() => src && setLarge(true)}
        aria-label={src ? `${alt} büyüt` : alt}
      >
        {src ? <img src={src} alt={alt} /> : <span>{fallback}</span>}
      </button>
      {large && (
        <div
          className="image-modal"
          role="dialog"
          aria-modal="true"
          onClick={() => setLarge(false)}
        >
          <button aria-label="Kapat">×</button>
          <img src={src} alt={alt} />
        </div>
      )}
    </>
  );
}
function LoanTable({
  rows,
  showReturn,
  onReturn,
  onRenew,
  busy,
}: {
  rows: Loan[];
  showReturn: boolean;
  onReturn?: (id: number) => void;
  onRenew?: (id: number) => void;
  busy?: boolean;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Öğrenci</th>
            <th>Kitap</th>
            <th>Son Teslim</th>
            {showReturn && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.map((x) => (
            <tr key={x.id}>
              <td>
                <strong>{x.studentName}</strong>
                <small>{x.grade}</small>
              </td>
              <td>
                {x.bookTitle}
                <small>
                  {x.inventoryNo} · {x.renewalCount} uzatma
                </small>
              </td>
              <td>{fmt(x.dueAt)}</td>
              {showReturn && (
                <td>
                  <div className="inline-actions">
                    <button
                      className="small"
                      disabled={busy}
                      onClick={() => onRenew?.(x.id)}
                    >
                      Süreyi uzat
                    </button>
                    <button
                      className="small"
                      disabled={busy}
                      onClick={() => onReturn?.(x.id)}
                    >
                      İade al
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <Empty text="Henüz kayıt yok." />}
    </div>
  );
}
function Ranking({ rows }: { rows: (string | number)[][] }) {
  const max = Math.max(1, ...rows.map((x) => Number(x[2])));
  return (
    <div className="ranking">
      {rows.slice(0, 8).map((x, i) => (
        <div key={String(x[0])}>
          <b>{i + 1}</b>
          <span>
            <strong>{x[0]}</strong>
            <small>{x[1]}</small>
            <i style={{ width: `${(Number(x[2]) / max) * 100}%` }} />
          </span>
        </div>
      ))}
      {!rows.length && (
        <Empty text="Rapor oluşturmak için tamamlanmış ödünç kaydı gerekiyor." />
      )}
    </div>
  );
}
function Card({
  title,
  children,
  action,
  onAction,
}: {
  title: string;
  children: React.ReactNode;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <article className="card">
      <div className="card-head">
        <h3>{title}</h3>
        {action && <button onClick={onAction}>{action} →</button>}
      </div>
      {children}
    </article>
  );
}
function PageHead({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
      {action}
    </div>
  );
}
function Search({
  value,
  setValue,
  placeholder,
}: {
  value: string;
  setValue: (x: string) => void;
  placeholder: string;
}) {
  return (
    <div className="search">
      <span>⌕</span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <span>◇</span>
      <p>{text}</p>
    </div>
  );
}
function fmt(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("tr-TR");
}
function daysBetween(a: string, b: string) {
  return Math.max(
    0,
    Math.ceil(
      (new Date(`${b}T12:00:00`).getTime() -
        new Date(`${a}T12:00:00`).getTime()) /
        86400000,
    ),
  );
}
