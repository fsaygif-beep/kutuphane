"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type {WorkSheet} from "xlsx";
import { matchingRecords, memberActiveLoans } from "./circulation-selection";
import {sameBookIdentity,selectedInventoryBook} from "./book-identity";
import {MyReviews,Recommendations,Messages,SwitchUser} from "./member-portal";
import {QrScanner} from "./qr-scanner";
import { LocationFields } from "./location-fields";
import {displayGrade,memberCaption} from "./member-display";
import {normalizeGrade,validGrade} from "./student-rules";
import {Photo,BookDiscussion,ReviewModeration,Complaints,StudentReading,ReadingLists} from "./student-community";
import { reportData } from "./report-data";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";

const addDateDays = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

export type Student = {
  id: number;
  studentNo: string;
  fullName: string;
  grade: string;
  contact: string;
  branch?: string;
  email: string;
  photoKey: string;
  blocked: number;
  blockReason: string;
  memberType: "student" | "teacher" | "employee";
};
export type Book = {
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
  activeInventory: number;
  loanable: number;
  lost: number;
  lostAt: string | null;
};
export type Loan = {
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
  sameDayRequired: number;
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
  username?: string;
  email: string;
  phone: string;
  displayName: string;
  role: string;
  permissions: string[];
  studentId: number | null;
  active: number;
  passwordConfigured?: boolean;
};
type MembershipRequest = { phone: string; id: number; username: string; email: string; fullName: string; grade: string; studentNo: string; city: string; district: string; schoolName: string; status: string; createdAt: string };
type AdminNote = { id: number; content: string; done: number; createdAt: string };
type ManagedSchool = { id: number; name: string; city: string; district: string; institutionCode: string; active: number; createdAt: string; exempt: boolean; premium: boolean; trial: boolean; remainingDays: number | null; statusLabel: string; premiumUntil: string | null };
type InventorySession = { id: number; countNo: string; countDate: string; status: string; createdAt: string; updatedAt: string };
type InventoryEntry = { source: string; id: number; sessionId: number; bookId: number; countedAt: string; shelfBefore: string; shelfAfter: string };
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
    maxBooksPerStudent: number;
    theme: string;
    senderName: string;
    senderEmail: string;
    extensionDays: number;
    maxRenewals: number;
    dailyFine: number;
    logoKey: string;
    dashboardImageKey: string;
    iban: string;
    membershipFee: number;
    driveAccountEmail: string;
    driveFolderUrl: string;
    bookGenres: string;
    uiFont: string;
    titleFont: string;
    baseFontSize: number;
    textColor: string;
    accentColor: string;
    surfaceColor: string;
  };
  students: Student[];
  books: Book[];
  loans: Loan[];
  requests: BookRequest[];
  users: AppUser[];
  membershipRequests: MembershipRequest[];
  notes: AdminNote[];
  inventorySessions: InventorySession[];
  inventoryEntries: InventoryEntry[];
  currentUser: AppUser | null;
  subscription: { exempt: boolean; premium: boolean; trial: boolean; remainingDays: number | null };
  canManageSubscription: boolean;
  today: string;
};
type UnregisteredData = { access: "unregistered"; viewerEmail: string; school: { city: string; district: string; schoolName: string } | null; membershipRequest: MembershipRequest | null };
type PlatformData = { access: "platform"; currentUser: AppUser };
type ExpiredData = { access: "expired"; message: string; currentUser: AppUser };
type Tab =
  | "dashboard"
  | "circulation"
  | "returns"
  | "books"
  | "students"
  | "requests"
  | "overdue"
  | "inventory"
  | "reports"
  | "notes"
  | "bulk"
  | "account"
  | "reading"
  | "lists"
  | "myreviews"
  | "recommendations"
  | "messages"
  | "settings";

const menu: Array<[Tab, string, string]> = [
  ["dashboard", "Genel Bakış", "⌂"],
  ["circulation", "Ödünç Ver", "↗"],
  ["returns", "İade Al", "↙"],
  ["books", "Kitaplar", "▤"],
  ["students", "Üyeler", "◉"],
  ["overdue", "Geç Kalanlar", "!"],
  ["inventory", "Kitap Sayımı", "⌕"],
  ["reports", "Raporlar", "▥"],
  ["reading", "Okuduğum Kitaplar", "▤"],
  ["lists", "Okuma Listelerim", "☷"],
  ["myreviews", "Yorumlarım", "✎"],
  ["recommendations", "Tavsiye Listesi", "☷"],
  ["messages", "Mesajlar", "✉"],
  ["requests", "Talepler ve Şikâyetler", "✎"],
  ["settings", "Ayarlar", "⚙"],
  ["notes", "Notlar", "✓"],
  ["bulk", "Toplu İşlemler", "⇧"],
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
    failed?: number; missingEmail?: number;
    patch?: Partial<Record<"loans"|"books"|"inventoryEntries"|"inventorySessions",Array<{id:number}>>>;
  };
}

async function uploadImage(
  file: File,
  kind: "student" | "book" | "logo" | "dashboard",
  recordKey: string,
) {
  const image = await createImageBitmap(file);
  const limit = kind === "logo" ? 800 : kind === "student" ? 1000 : 1400;
  const scale = Math.min(1, limit / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Görsel işlenemedi.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error("Görsel küçültülemedi."))),
      "image/webp",
      0.82,
    ),
  );
  const optimized = new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, {
    type: "image/webp",
  });
  const form = new FormData();
  form.set("file", optimized);
  form.set("kind", kind);
  form.set("recordKey", recordKey);
  const response = await fetch("/api/media", { method: "POST", body: form });
  const result = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(result.error || "Görsel yüklenemedi.");
}
const mediaUrl = (key: string) => `/api/media?key=${encodeURIComponent(key)}`;

async function downloadExcel(
  filename: string,
  sheetName: string,
  rows: Record<string, unknown>[],
) {
  const XLSX=await import("xlsx");
  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName);
  XLSX.writeFile(book, filename);
}
function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
function downloadTextPdf(filename: string, title: string, lines: string[]) {
  const safe = (value: string) => value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/([\\()])/g, "\\$1");
  const height = Math.max(595, 90 + lines.length * 14);
  const commands = [
    "BT /F1 16 Tf 28 " + (height - 38) + ` Td (${safe(title)}) Tj ET`,
    ...lines.map((line, index) => `BT /F1 8 Tf 28 ${height - 62 - index * 14} Td (${safe(line)}) Tj ET`),
  ].join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
    `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 842 ${height}] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >> endobj\n`,
    `4 0 obj << /Length ${commands.length} >> stream\n${commands}\nendstream endobj\n`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object) => { offsets.push(pdf.length); pdf += object; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  downloadBlob(filename, new Blob([pdf], { type: "application/pdf" }));
}
async function readExcel(file: File) {
  const XLSX=await import("xlsx");
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);
  return workbook.SheetNames.flatMap((name) => XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[name], { defval: "", raw: false }));
}
function pick(row: Record<string, unknown>, names: string[]) {
  const entry = Object.entries(row).find(([key]) =>
    names.includes(key.trim().toLocaleUpperCase("tr")),
  );
  return entry?.[1] ?? "";
}

function MembershipSignup({ data, busy, act }: { data: UnregisteredData; busy: boolean; act: (a: string, p: Record<string, unknown>, s: string) => Promise<boolean> }) {
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
            <div className="form-grid two"><label>Sınıf<input value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} placeholder="9 A" /></label><label>Öğrenci no<input value={form.studentNo} onChange={(e) => setForm({ ...form, studentNo: e.target.value })} /></label></div>
            <button className="primary" disabled={busy || Object.values(form).some((x) => !x.trim())} onClick={() => act("submitMembershipRequest", form, "Başvurunuz yönetici onayına gönderildi.")}>Üyelik talebi gönder</button>
          </div>
        )}
        <a className="signout-link" href="/signout-with-chatgpt?return_to=/">Farklı hesapla giriş yap</a>
      </section>
    </main>
  );
}

function LoginScreen({ onLogin }: { onLogin: () => Promise<void> }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [setupCode] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("setup") || "");
  const [setupMode, setSetupMode] = useState(Boolean(setupCode));
  const [applicationMode, setApplicationMode] = useState(false);
  const [studentApplicationMode, setStudentApplicationMode] = useState(false);
  const [membershipFee, setMembershipFee] = useState(0);
  const [application, setApplication] = useState({ city: "", district: "", schoolName: "", institutionCode: "", adminName: "", adminEmail: "", password: "" });
  const [studentApplication, setStudentApplication] = useState({ city: "", district: "", schoolName: "", institutionCode: "", fullName: "", grade: "", studentNo: "", email: "", phone: "", password: "" });
  useEffect(() => {
    void fetch("/api/pricing", { cache: "no-store" }).then((response) => response.json()).then((result: { membershipFee?: number }) => setMembershipFee(Math.max(0, Number(result.membershipFee) || 0))).catch(() => setMembershipFee(0));
  }, []);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: username, password }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Giriş yapılamadı.");
      await onLogin();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Giriş yapılamadı.");
    } finally { setBusy(false); }
  };
  const applySchool = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/platform", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "apply", ...application }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Başvuru gönderilemedi.");
      setApplicationMode(false); setError("Okul başvurunuz merkez yöneticisinin onayına gönderildi.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Başvuru gönderilemedi."); }
    finally { setBusy(false); }
  };
  const applyStudent = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/membership", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(studentApplication) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Üyelik talebi gönderilemedi.");
      setStudentApplicationMode(false);
      setError("Öğrenci üyelik talebiniz okul yöneticisinin onayına gönderildi.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Üyelik talebi gönderilemedi."); }
    finally { setBusy(false); }
  };
  const activate = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ setupCode, username, password }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Hesap etkinleştirilemedi.");
      window.history.replaceState({}, "", "/"); setSetupMode(false); setError("Hesap etkinleştirildi. Şimdi giriş yapabilirsiniz.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Hesap etkinleştirilemedi."); }
    finally { setBusy(false); }
  };
  return <main className="login-page">
    <section className="login-panel">
      <div className="login-brand"><span className="mark">K</span><div><strong>Okul Kütüphane Otomasyonu</strong><small>Öğrenciler için cep telefonu ve parola ile güvenli erişim</small></div></div>
      <div className="login-copy"><p className="eyebrow">OKUL KÜTÜPHANESİ YÖNETİMİ</p><h1>Okul kütüphanenizi tek panelden yönetin.</h1><p>Kitap ve üye kayıtlarını, ödünç-iade işlemlerini, raf kontrolünü ve kütüphane raporlarını güvenli bir çevrim içi sistemde yönetin.</p></div>
      {studentApplicationMode ? <form className="login-form school-application" onSubmit={applyStudent}>
        <LocationFields city={studentApplication.city} district={studentApplication.district} onChange={(city,district)=>setStudentApplication({...studentApplication,city,district})}/>

        {Object.entries({ schoolName: "Okul adı", fullName: "Adı soyadı", grade: "Sınıf ve şube (ör. 9 A)", studentNo: "Öğrenci numarası", phone: "Cep telefonu (05XXXXXXXXX)", password: "En az 6 karakter parola" }).map(([key, label]) => <label key={key}>{label}<input type={key === "password" ? "password" : key === "email" ? "email" : key === "phone" ? "tel" : "text"} value={studentApplication[key as keyof typeof studentApplication]} onChange={(event) => setStudentApplication({ ...studentApplication, [key]: key === "grade" ? displayGrade(normalizeGrade(event.target.value)) : event.target.value })} required minLength={key === "password" ? 6 : undefined} /></label>)}
        {error && <p className="login-error">{error}</p>}
        <button className="login-button" disabled={busy}>Üyelik talebi gönder <span>→</span></button>
        <button type="button" className="secondary" onClick={() => setStudentApplicationMode(false)}>Giriş ekranına dön</button>
      </form> : applicationMode ? <form className="login-form school-application" onSubmit={applySchool}>
        {Object.entries({ city: "Şehir", district: "İlçe", schoolName: "Okul adı", institutionCode: "Kurum kodu", adminName: "Okul yöneticisi adı soyadı", adminEmail: "Yönetici e-postası", password: "En az 6 karakter parola" }).map(([key, label]) => <label key={key}>{label}<input type={key === "password" ? "password" : key === "adminEmail" ? "email" : "text"} value={application[key as keyof typeof application]} onChange={(event) => setApplication({ ...application, [key]: event.target.value })} required minLength={key === "password" ? 6 : undefined} /></label>)}
        {error && <p className="login-error">{error}</p>}
        <button className="login-button" disabled={busy}>Okul başvurusu gönder <span>→</span></button>
        <button type="button" className="secondary" onClick={() => setApplicationMode(false)}>Giriş ekranına dön</button>
      </form> : <form className="login-form" onSubmit={setupMode ? activate : submit}>
        <label>{setupMode ? "Kullanıcı adı" : "Öğrenci: cep telefonu · Yetkili: kullanıcı adı / e-posta"}<input type="text" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required /></label>
        <label>{setupMode ? "Yeni parola" : "Parola"}<input type="password" autoComplete={setupMode ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} /></label>
        {error && <p className="login-error">{error}</p>}
        <button className="login-button" disabled={busy || !username || password.length < 6}>{busy ? "İşleniyor…" : setupMode ? "Merkez yönetici hesabını etkinleştir" : "Giriş yap"}<span>→</span></button>
      </form>}
      {!setupMode && !applicationMode && !studentApplicationMode && <div className="login-request-actions"><button className="school-apply-link" onClick={() => { setStudentApplicationMode(true); setError(""); }}>Öğrenci üyelik talebi oluşturun</button><button className="school-apply-link" onClick={() => { setApplicationMode(true); setError(""); }}>Okulunuz için kullanım başvurusu yapın</button></div>}
      {!setupMode && !applicationMode && !studentApplicationMode && <div className="role-cards" aria-label="Kütüphane otomasyonu özellikleri">
        <article><span aria-hidden="true">K</span><strong>Kitap ve envanter</strong><p>Excel ile kitap aktarımı, kategori ve raf filtreleriyle katalog ve sayım yönetimi.</p></article>
        <article><span aria-hidden="true">Ü</span><strong>Üye ve ödünç işlemleri</strong><p>Öğrenci, öğretmen ve çalışan kayıtlarıyla hızlı ödünç verme ve iade takibi.</p></article>
        <article><span aria-hidden="true">R</span><strong>Rapor ve istatistik</strong><p>En çok okunan kitapları, aktif üyeleri ve tarih aralığına göre hareketleri inceleyin.</p></article>
      </div>}
      <p className="login-note">Okullar merkez onayından sonra kendi yalıtılmış yönetim alanına erişir.</p>
      <nav className="login-seo-links" aria-label="Program hakkında"><a href="/okul-kutuphanesi-programi">Okul kütüphanesi programı</a><a href="/ozellikler">Özellikler</a><a href="/sikca-sorulan-sorular">Sıkça sorulanlar</a></nav>
    </section>
    <aside className="login-visual"><div className="login-visual-image"><img src="/reading-hero.png" alt="Kütüphanede kitap okuyan öğrenciler" /><div className="login-visual-copy"><strong>Her okul için, her yerden erişim</strong><p>İnternet bağlantısı olan bilgisayar, tablet ve telefondan kullanılabilir.</p></div></div><div className="login-pricing"><div><small>365 günlük okul üyeliği</small><strong>{membershipFee.toLocaleString("tr-TR")} ₺</strong></div><span>30 gün ücretsiz deneme</span></div></aside>
  </main>;
}

function PlatformConsole({ onLogout }: { onLogout: () => Promise<void> }) {
  type Application = { id: number; city: string; district: string; schoolName: string; institutionCode: string; adminName: string; adminEmail: string; status: string; createdAt: string };
  type School = { id: number; city: string; district: string; name: string; institutionCode: string; active: number; createdAt: string; exempt: boolean; premium: boolean; trial: boolean; remainingDays: number | null; statusLabel: string; premiumUntil: string | null };
  const [applications, setApplications] = useState<Application[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/platform", { cache: "no-store" });
    const result = await response.json() as { applications?: Application[]; schools?: School[]; error?: string };
    if (!response.ok) throw new Error(result.error || "Merkez verileri yüklenemedi.");
    setApplications(result.applications || []); setSchools(result.schools || []);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((error) => setNotice(error.message));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const review = async (id: number, action: "approve" | "reject") => {
    const response = await fetch("/api/platform", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) return setNotice(result.error || "İşlem tamamlanamadı.");
    setNotice(action === "approve" ? "Okul onaylandı ve yönetici hesabı açıldı." : "Başvuru reddedildi."); await load();
  };
  const setPremium = async (id: number, enabled: boolean) => {
    const response = await fetch("/api/platform", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action: "setPremium", enabled }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) return setNotice(result.error || "Premium erişim değiştirilemedi.");
    setNotice(enabled ? "Okula 365 günlük premium erişim açıldı." : "Okulun premium erişimi kapatıldı."); await load();
  };
  return <main className="platform-page">
    <header><div><p className="eyebrow">ÇOK OKULLU KÜTÜPHANE SİSTEMİ</p><h1>Merkez Yönetim Paneli</h1></div><button className="secondary" onClick={() => void onLogout()}>Çıkış yap</button></header>
    {notice && <div className="notice">{notice}</div>}
    <div className="stats"><article><div className="stat-icon s0">⌂</div><div><small>Etkin okul</small><strong>{schools.filter((x) => x.active).length}</strong></div></article><article><div className="stat-icon s2">⌛</div><div><small>Bekleyen başvuru</small><strong>{applications.filter((x) => x.status === "pending").length}</strong></div></article></div>
    <div className="grid-2">
      <Card title="Okul Başvuruları"><div className="approval-list">{applications.map((item) => <article key={item.id}><div><strong>{item.schoolName}</strong><small>{item.city} / {item.district} · Kurum: {item.institutionCode}</small><small>Yönetici: {item.adminName} · {item.adminEmail}</small><span className={`badge ${item.status === "approved" ? "green" : item.status === "rejected" ? "red" : "blue"}`}>{item.status}</span></div>{item.status === "pending" && <div className="actions"><button className="primary" onClick={() => void review(item.id, "approve")}>Onayla</button><button className="danger" onClick={() => void review(item.id, "reject")}>Reddet</button></div>}</article>)}</div>{!applications.length && <Empty text="Henüz okul başvurusu yok." />}</Card>
      <Card title="Okul Yönetimi"><div className="user-list">{schools.map((school) => <span key={school.id}><span className="user-summary"><strong>{school.name}</strong><small>{school.city} / {school.district} · {school.institutionCode}</small><small>Kayıt: {new Date(school.createdAt).toLocaleDateString("tr-TR")} · {school.statusLabel}{school.remainingDays !== null ? ` · ${school.remainingDays} gün kaldı` : ""}</small></span><span className="subscription-status"><span className={`badge ${school.exempt || school.premium ? "green" : school.trial ? "blue" : "red"}`}>{school.statusLabel}</span>{!school.exempt && <label className="check-label"><input type="checkbox" checked={school.premium} onChange={(e) => void setPremium(school.id, e.target.checked)} />365 gün premium</label>}</span></span>)}</div>{!schools.length && <Empty text="Henüz onaylanmış okul yok." />}</Card>
    </div>
  </main>;
}

export default function LibraryApp() {
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === "undefined") return "dashboard";
    const requested = new URLSearchParams(window.location.search).get("tab");
    return menu.some(([id]) => id === requested) ? requested as Tab : "dashboard";
  });
  const [data, setData] = useState<Data | UnregisteredData | PlatformData | ExpiredData | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [authRequired, setAuthRequired] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch("/api/library", { cache: "no-store" });
    if (response.status === 401) { setAuthRequired(true); setData(null); return; }
    if (!response.ok) throw new Error("Veriler yüklenemedi.");
    setAuthRequired(false);
    setData((await response.json()) as Data | UnregisteredData | PlatformData | ExpiredData);
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
  ): Promise<boolean> => {
    setBusy(true);
    setNotice("");
    try {
      const result = await request(action, payload);
      if(result.patch) setData(current=> {
        if(!current || current.access!=="granted")return current;
        const next={...current};
        for(const key of ["loans","books","inventoryEntries","inventorySessions"] as const) {
          const changes=result.patch?.[key]; if(!changes?.length)continue;
          const byId=new Map((current[key] as Array<{id:number}>).map(row=>[row.id,row]));
          for(const row of changes)byId.set(row.id,{...byId.get(row.id),...row});
          (next as any)[key]=Array.from(byId.values());
        } return next;
      });
      else await load();
      setNotice(action === "importBooks"
        ? `${result.inserted ?? 0} kitap envantere işlendi${result.skipped ? `; ${result.skipped} boş veya yinelenen DN atlandı` : ""}.`
        : action === "sendOverdueEmails"
          ? `${result.sent ?? 0} e-posta servis tarafından kabul edildi; ${result.failed ?? 0} başarısız; ${result.missingEmail ?? 0} kayıtta geçerli e-posta yok.`
          : success);
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "İşlem başarısız.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  const signOut = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    setData(null);
    setAuthRequired(true);
  };

  if (authRequired) return <LoginScreen onLogin={load} />;
  if (!data)
    return (
      <main className="loading">
        <div className="loader" />
        <p>{notice || "Kütüphane hazırlanıyor…"}</p>
      </main>
    );
  if (data.access === "platform") return <PlatformConsole onLogout={async () => { await fetch("/api/auth", { method: "DELETE" }); setData(null); setAuthRequired(true); }} />;
  if (data.access === "expired") return <main className="expired-page"><section className="card expired-card"><div className="stat-icon s2">⌛</div><h1>Deneme süreniz doldu</h1><p>{data.message}</p><button className="secondary" onClick={async () => { await fetch("/api/auth", { method: "DELETE" }); setData(null); setAuthRequired(true); }}>Çıkış yap</button></section></main>;
  if (data.access === "unregistered")
    return <MembershipSignup data={data} busy={busy} act={act} />;
  const activeLoans = data.loans.filter((x) => !x.returnedAt);
  const overdue = activeLoans.filter((x) => x.dueAt < data.today);
  const activeBookIds = new Set(activeLoans.map(l=>l.bookId));
  const available = data.books.filter(book => Boolean(book.loanable) && !book.lost && !activeBookIds.has(book.id));
  const stats = [
    ["Toplam Kitap", data.books.length, "kitap"],
    ["Kayıtlı Üye", data.students.length, "üye"],
    ["Ödünçte", activeLoans.length, "aktif"],
    ["Geciken", overdue.length, "gecikme"],
  ];
  const role = data.currentUser?.role ?? "student";
  const permissions = data.currentUser?.permissions ?? [];
  const tabPermission: Partial<Record<Tab, string>> = {
    circulation: "circulation", returns: "circulation", books: "books", students: "students", overdue: "overdue",
    inventory: "inventory", reports: "reports", requests: "requests",
  };
  const visibleMenu = menu.filter(
    ([id]) =>
      role === "admin" ? !["reading","lists","myreviews"].includes(id) :
      (role === "staff"
        ? ["dashboard", "settings"].includes(id) || Boolean(tabPermission[id] && permissions.includes(tabPermission[id]!))
        : ["dashboard", "books", "requests", "settings", "reading", "lists", "myreviews", "recommendations", "messages"].includes(id)),
  );
  return (
    <div className="shell" data-theme={data.settings.theme || "forest"} style={{ "--ui-font": `${data.settings.uiFont === "Inter" ? "Arial" : data.settings.uiFont}, sans-serif`, "--title-font": `${data.settings.titleFont}, serif`, "--base-size": `${data.settings.baseFontSize}px`, "--ink": data.settings.textColor, "--green": data.settings.accentColor, "--paper": data.settings.surfaceColor } as React.CSSProperties}>
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
            {role === "student" && data.students[0] && <Photo imageKey={data.students[0].photoKey} name={data.students[0].fullName} kind="member"/>}
            <strong>{data.currentUser?.displayName}</strong>
            <small>
              {role === "admin"
                ? "Yönetici"
                : role === "staff"
                  ? "Kütüphane görevlisi"
                  : "Öğrenci"}
            </small>
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
          <SwitchUser onChanged={()=>{setTab("dashboard");void load();}}/>
          <button className="header-signout" onClick={() => void signOut()}><span>↪</span> Çıkış</button>
        </header>
        {role==="student"&&overdue.length>0&&<div className="overdue-student-warning" role="alert"><strong>UYARI</strong><span>Teslim tarihi geçen {overdue.length} kitabınız var. Lütfen kitaplarınızı okul kütüphanesine teslim edin.</span></div>}
        {notice && (
          <div className="notice" onClick={() => setNotice("")}>
            {notice}
            <span>×</span>
          </div>
        )}
        {tab === "dashboard" && role === "student" && data.students[0] && <div className="student-profile"><Photo imageKey={data.students[0].photoKey} name={data.students[0].fullName} kind="member"/><div><strong>{data.students[0].fullName}</strong><p>{data.students[0].grade} · No {data.students[0].studentNo}</p></div></div>}
        {tab === "dashboard" && (
          <Dashboard
            stats={stats}
            active={activeLoans}
            overdue={overdue}
            setTab={setTab}
            role={role}
            imageKey={data.settings.dashboardImageKey}
          />
        )}
        {tab === "reading" && role === "student" && <StudentReading student={data.students[0]} loans={data.loans} books={data.books}/>}
        {tab === "lists" && role === "student" && <ReadingLists books={data.books}/>}
        {tab === "myreviews" && role === "student" && <MyReviews books={data.books}/>}
        {tab === "recommendations" && (role === "admin"||role === "student") && <Recommendations books={data.books} studentMode={role==="student"}/>}
        {tab === "messages" && (role === "admin"||role === "student") && <Messages students={data.students} overdueIds={overdue.map(l=>l.studentId)} studentMode={role==="student"}/>}
        {(tab === "circulation" || tab === "returns") && (
          <Circulation
            key={tab}
            mode={tab === "returns" ? "return" : "lend"}
            students={data.students}
            books={available}
            active={activeLoans}
            busy={busy}
            act={act}
            history={data.loans}
          />
        )}
        {tab === "books" && (
          <Books
            books={data.books}
            active={activeLoans}
            loans={data.loans}
            act={act}
            genreOptions={data.settings.bookGenres.split(",").map((value) => value.trim()).filter(Boolean)}
            studentMode={role === "student"}
            readOnly={role === "student" || (role === "staff" && !permissions.includes("books"))}
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
          <div className="community-sections"><Requests
            studentMode={role === "student"}
            canDelete={role === "admin"}
            rows={data.requests}
            students={data.students}
            busy={busy}
            act={act}
          /><Complaints books={data.books} studentMode={role === "student"}/>{role === "admin" && <ReviewModeration books={data.books}/>}</div>
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
          <InventoryPersistent books={data.books} active={activeLoans} sessions={data.inventorySessions} entries={data.inventoryEntries} today={data.today} busy={busy} act={act} />
        )}
        {tab === "reports" && <Reports data={data} />}
        {tab === "notes" && role === "admin" && <Notes rows={data.notes} busy={busy} act={act} />}
        {tab === "bulk" && role === "admin" && <BulkImages students={data.students} books={data.books} busy={busy} act={act} />}
        {tab === "account" && (
          <AccountSecurity currentUser={data.currentUser} busy={busy} act={act} />
        )}
        {tab === "settings" && role !== "admin" && <AccountSecurity currentUser={data.currentUser} busy={busy} act={act}/> }
        {tab === "settings" && role === "admin" && (
          <Settings
            config={data.settings}
            students={data.students}
            books={data.books}
            users={data.users}
            currentUser={data.currentUser}
            canManageSubscription={data.canManageSubscription}
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
  imageKey,
}: {
  stats: (string | number)[][];
  active: Loan[];
  overdue: Loan[];
  setTab: (t: Tab) => void;
  role: string;
  imageKey: string;
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
          className="overview-image"
          src={imageKey ? mediaUrl(imageKey) : "/reading-hero.png"}
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

function CirculationPhoto({imageKey,name,kind}:{imageKey:string;name:string;kind:"member"|"book"}) {return <Photo imageKey={imageKey} name={name} kind={kind}/>;}

function Circulation({ mode, students, books, active, history, busy, act }: {
  mode: "lend" | "return";
  students: Student[];
  books: Book[];
  active: Loan[];
  history: Loan[];
  busy: boolean;
  act: (a: string, p: Record<string, unknown>, s: string) => Promise<boolean>;
}) {
  const [studentQuery, setStudentQuery] = useState("");
  const [selectedMemberId,setSelectedMemberId]=useState<number|null>(null);
  const [bookQuery, setBookQuery] = useState("");
  const suggestions=useMemo(()=>{
    const text=bookQuery.toLocaleUpperCase("tr").trim();
    return books.filter(b=>!text||`${b.inventoryNo} ${b.isbn} ${b.title} ${b.author}`.toLocaleUpperCase("tr").includes(text)).slice(0,40);
  },[books,bookQuery]);
  const memberSuggestions=useMemo(()=>{const text=studentQuery.toLocaleUpperCase("tr").trim();return students.filter(s=>!text||`${s.studentNo} ${s.fullName} ${s.grade}`.toLocaleUpperCase("tr").includes(text)).slice(0,40);},[students,studentQuery]);
  const submitting = useRef(false);
  const memberValue = memberCaption;
  const memberMatches = matchingRecords(students, studentQuery, (member) => [member.studentNo, member.fullName, memberValue(member)]);
  const selectedStudent = students.find(member=>member.id===selectedMemberId) || (memberMatches.length === 1 ? memberMatches[0] : undefined);
  const setMemberQuery = (value:string) => {
    const matches=matchingRecords(students,value,member=>[member.studentNo,member.fullName,memberValue(member)]);
    const member=matches.length===1?matches[0]:undefined;
    const hideCode=member&&member.memberType!=="student";
    setSelectedMemberId(hideCode?member.id:null);
    setStudentQuery(hideCode?memberValue(member):value);
  };
  const bookMatches = matchingRecords(books, bookQuery, (book) => [book.inventoryNo, book.isbn, book.title, `${book.inventoryNo} · ${book.title} · ${book.author}`]);
  const selectedBook = bookMatches.length === 1 ? bookMatches[0] : undefined;
  const loanValue = (loan: Loan) => `${loan.inventoryNo} · ${loan.bookTitle} · ${loan.studentName}`;
  const returnMatches = matchingRecords(active, bookQuery, (loan) => [loan.inventoryNo, loan.bookTitle, loanValue(loan)]);
  const selectedReturn = returnMatches.length === 1 ? returnMatches[0] : undefined;
  const selectBorrower = (loan: Loan) => {
    const member = students.find((row) => row.id === loan.studentId);
    if (member) {setSelectedMemberId(member.id);setStudentQuery(memberValue(member));}
  };
  const searchReturnBook = (value: string) => {
    setBookQuery(value);
    const matches = matchingRecords(active, value, (loan) => [loan.inventoryNo, loan.bookTitle, loanValue(loan)]);
    if (matches.length === 1) selectBorrower(matches[0]);
  };
  const personLoans = selectedStudent ? memberActiveLoans(active, selectedStudent.id) : [];
  const returnBook = async (id: number) => {
    if (busy || submitting.current) return;
    submitting.current = true;
    try {
      if (await act("return", { loanId: id }, "Kitap teslim alındı.")) setBookQuery("");
    } finally { submitting.current = false; }
  };
  const lend = async () => {
    if (busy || submitting.current || !selectedStudent || !selectedBook || selectedStudent.blocked) return;
    submitting.current = true;
    try {
      if (await act("loan", { studentId: selectedStudent.id, bookId: selectedBook.id }, "Kitap ödünç verildi.")) setBookQuery("");
    } finally { submitting.current = false; }
  };
  const list = (rows: Loan[], chooseMember = false) => <LoanTable rows={rows.map(loan=>({...loan,grade:students.find(member=>member.id===loan.studentId)?.memberType==="student"?displayGrade(loan.grade):""}))} showReturn showPhotos busy={busy}
    onReturn={(id) => void returnBook(id)}
    onSelectMember={chooseMember ? selectBorrower : undefined}
    onRenew={(id) => act("renewLoan", { loanId: id }, "Kitabın teslim süresi uzatıldı.")}
    onSameDay={(id) => act("markSameDayLoan", { loanId: id }, "Kitabın aynı gün teslim edilmesi işaretlendi.")} />;
  return <section>
    <PageHead title={mode === "lend" ? "Ödünç Ver" : "İade Al"} text={mode === "lend" ? "Üyeyi ve raftaki kitabı seçin. Üyenin üzerindeki kitapları da buradan teslim alabilirsiniz." : "Üyeyi seçin veya teslim edilen kitabın demirbaş numarasını okutun. Aynı kişinin diğer kitaplarını da teslim alabilirsiniz."} />
    <div className="circulation-stack">
      <Card title={mode === "lend" ? "Yeni ödünç işlemi" : "İade edilecek kitabı veya üyeyi seçin"}>
        <div className="loan-entry-grid">
          <div className="step"><b>1</b><label>QR / Üye No / Ad Soyad
            <input list="circulation-members" value={studentQuery} onChange={(event) => { setMemberQuery(event.target.value); if (mode === "return") setBookQuery(""); }} placeholder="Üye numarasını okutun veya kişiyi seçin…" autoComplete="off" />
            <datalist id="circulation-members">{memberSuggestions.map((member) => <option key={member.id} value={memberValue(member)} />)}</datalist>
            {memberMatches.length > 1 && !selectedStudent && <div className="member-match-options"><small role="status">Birden fazla üye bulundu. İlgili kişiyi seçin.</small>{memberMatches.map(member=><button type="button" className="small" key={member.id} onClick={()=>{setSelectedMemberId(member.id);setStudentQuery(memberValue(member));}}>{memberValue(member)}</button>)}</div>}
          </label></div>
          <div className="step"><b>2</b><label>{mode === "lend" ? "QR / DN / ISBN / Kitap Adı" : "QR / DN / İade edilecek kitap"}
            <input list="circulation-books" value={bookQuery} onChange={(event) => mode === "lend" ? setBookQuery(event.target.value) : searchReturnBook(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); if (mode === "lend") void lend(); } }} placeholder="Demirbaş numarasını okutun veya kitabı seçin…" autoComplete="off" />
            <datalist id="circulation-books">{mode === "lend" ? suggestions.map((book) => <option key={book.id} value={`${book.inventoryNo} · ${book.title} · ${book.author}`} />) : active.map((loan) => <option key={loan.id} value={loanValue(loan)} />)}</datalist>
            {(mode === "lend" ? bookMatches : returnMatches).length > 1 && <small role="status">Birden fazla nüsha eşleşti. Demirbaş numarasıyla kitabı seçin.</small>}
            {bookQuery && !(mode === "lend" ? bookMatches : returnMatches).length && <small role="status">{mode === "lend" ? "Ödünç verilebilir bir kitap seçin." : "Eşleşen aktif ödünç bulunamadı."}</small>}
          </label></div>
        </div>
        <div className="circulation-camera"><QrScanner disabled={busy} onScan={value=>mode==="lend"?setBookQuery(value):searchReturnBook(value)}/></div>
        <div className="circulation-previews">
          {selectedStudent && <div className="circulation-preview"><CirculationPhoto imageKey={selectedStudent.photoKey} name={selectedStudent.fullName} kind="member" /><div><strong>{selectedStudent.fullName}</strong>{selectedStudent.memberType==="student"&&<small>No {selectedStudent.studentNo} · {displayGrade(selectedStudent.grade)}</small>}<span className="badge blue">{personLoans.length} kitap üzerinde</span>{mode === "lend" && Boolean(selectedStudent.blocked) && <p className="login-error">Bu üyeye kitap verilemez: {selectedStudent.blockReason || "Yönetici engeli"}</p>}</div></div>}
          {mode === "lend" && selectedBook && <div className="circulation-preview"><CirculationPhoto imageKey={selectedBook.coverKey} name={selectedBook.title} kind="book" /><div><strong>{selectedBook.title}</strong><small>{selectedBook.author}</small><small>DN {selectedBook.inventoryNo}</small></div></div>}
          {mode === "return" && selectedReturn && <div className="circulation-preview"><CirculationPhoto imageKey={selectedReturn.bookCoverKey} name={selectedReturn.bookTitle} kind="book" /><div><strong>{selectedReturn.bookTitle}</strong><small>{selectedReturn.author} · DN {selectedReturn.inventoryNo}</small><small>{selectedReturn.studentName}</small><button className="small" disabled={busy} onClick={() => void returnBook(selectedReturn.id)}>Bu kitabı iade al</button></div></div>}
        </div>
        {mode === "lend" && <button className="primary full loan-submit" disabled={busy || !selectedStudent || !selectedBook || Boolean(selectedStudent.blocked)} onClick={() => void lend()}>Ödünç ver</button>}
      </Card>
      {selectedStudent && <Card title={`${selectedStudent.fullName} üzerindeki kitaplar (${personLoans.length})`}>
        {personLoans.length ? list(personLoans) : <Empty text="Bu kişinin üzerinde ödünç kitap bulunmuyor." />}
      </Card>}
      {mode === "return" && !selectedStudent && <Card title={`Aktif ödünçler (${active.length})`}>{list(active, true)}</Card>}
      <Card title="Son işlemler"><div className="recent-circulation">{history.filter((loan) => !selectedStudent || loan.studentId === selectedStudent.id).slice(0, 8).map((loan) => <span key={loan.id}><span><b>{loan.bookTitle}</b><small>{loan.studentName} · DN {loan.inventoryNo}</small></span><span className={`badge ${loan.returnedAt ? "green" : "blue"}`}>{loan.returnedAt ? `İade · ${fmt(loan.returnedAt)}` : `Ödünç · ${fmt(loan.loanedAt)}`}</span></span>)}</div></Card>
    </div>
  </section>;
}

function Books({
  books,
  active,
  loans,
  act,
  readOnly = false,
  studentMode = false,
  genreOptions,
}: {
  books: Book[];
  active: Loan[];
  loans: Loan[];
  act: (a: string, p: Record<string, unknown>, s: string) => Promise<boolean>;
  readOnly?: boolean;
  studentMode?: boolean;
  genreOptions: string[];
}) {
  const [visibleLimit,setVisibleLimit]=useState(60);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);
  const [q, setQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [genreFilter, setGenreFilter] = useState("");
  const [shelfFilter, setShelfFilter] = useState("");
  const [authorFilter, setAuthorFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const categories = [...new Set(books.map((book) => book.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr"));
  const genres = [...new Set(books.map((book) => book.genre).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr"));
  const shelves = [...new Set(books.map((book) => book.shelf).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr"));
  const authors = [...new Set(books.map((book) => book.author).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr"));
  const shown = books
    .filter((x) => `${x.inventoryNo} ${x.isbn} ${x.title} ${x.author} ${x.publisher} ${x.category} ${x.genre} ${x.shelf}`.toLocaleLowerCase("tr").includes(q.toLocaleLowerCase("tr")))
    .filter((x) => !categoryFilter || x.category === categoryFilter)
    .filter((x) => !genreFilter || x.genre === genreFilter)
    .filter((x) => !shelfFilter || x.shelf === shelfFilter)
    .filter((x) => !authorFilter || x.author === authorFilter)
    .filter((x) => !statusFilter || (statusFilter === "lost" ? Boolean(x.lost) : statusFilter === "loaned" ? active.some((loan) => loan.bookId === x.id) : !x.lost && !active.some((loan) => loan.bookId === x.id)));
  const selectedBook = books.find((book) => book.id === selectedBookId);
  const selectedBookLoans = selectedBook
    ? loans.filter((loan) => sameBookIdentity({title:loan.bookTitle,author:loan.author},selectedBook))
    : [];
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
        RAF: x.shelf || (x.author.trim().split(/\s+/).at(-1)?.[0] ?? "").toLocaleUpperCase("tr"),
        "DEWEY KODU": x.dewey,
        "SAYFA SAYISI": x.pages,
      })),
    );
  const importFile = async (file: File) => {
    if (!confirm("Bu Excel yüklemesi mevcut kitap envanterini sıfırlayıp yalnızca son dosyadaki demirbaşları gösterecek. Devam edilsin mi?")) return;
    const raw = await readExcel(file);
    const rows = raw.map((row) => ({
      inventoryNo: pick(row, ["DN", "DEMİRBAŞ NO", "DEMIRBAS NO", "DEMİRBAŞ NUMARASI", "DEMIRBAS NUMARASI", "KİTAP NO", "KITAP NO", "ID"]),
      isbn: pick(row, ["ISBN", "ISBN NO"]),
      title: pick(row, ["KİTAP ADI", "KITAP ADI", "KİTABIN ADI", "KITABIN ADI", "ESER ADI"]),
      author: pick(row, ["YAZARI", "YAZAR", "YAZAR ADI"]),
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
      "Kitap envanteri son Excel dosyasına göre yenilendi. Yalnızca boş veya yinelenen demirbaş numaraları atlandı.",
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
    <section className="books-page">
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
          key={editing ? `edit-${editing.id}` : "new-book"}
          initial={editing}
          genreOptions={genreOptions}
          submit={async (p) => {
            const ok = await act(
              editing ? "updateBook" : "addBook",
              editing ? { ...p, id: editing.id } : p,
              editing ? "Kitap güncellendi." : "Kitap kataloğa eklendi.",
            );
            if (ok) { setOpen(false); setEditing(null); }
          }}
          onDelete={
            editing
              ? async () => {
                  if (confirm("Bu kitabı silmek istediğinize emin misiniz?")) {
                    const ok = await act(
                      "deleteBook",
                      { id: editing.id },
                      "Kitap silindi.",
                    );
                    if (ok) { setOpen(false); setEditing(null); }
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
      <div className="panel book-filter-panel">
        <label>Kategori<select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}><option value="">Tümü</option>{categories.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Tür<select value={genreFilter} onChange={(e) => setGenreFilter(e.target.value)}><option value="">Tümü</option>{genres.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Raf<select value={shelfFilter} onChange={(e) => setShelfFilter(e.target.value)}><option value="">Tümü</option>{shelves.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Yazar<select value={authorFilter} onChange={(e) => setAuthorFilter(e.target.value)}><option value="">Tümü</option>{authors.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Durum<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">Tümü</option><option value="available">Rafta</option><option value="loaned">Ödünçte</option><option value="lost">Kayıp</option></select></label>
        <button className="secondary compact-filter-button" onClick={() => { setQ(""); setCategoryFilter(""); setGenreFilter(""); setShelfFilter(""); setAuthorFilter(""); setStatusFilter(""); }}>Filtreleri temizle</button>
        <strong className="book-result-count">{shown.length} / {books.length} kitap listeleniyor</strong>
      </div>
      <div className="book-grid">
        {shown.slice(0, visibleLimit).map((book) => (
          <article className={`book clickable-book ${selectedBookId === book.id ? "selected" : ""}`} key={book.id} role="button" tabIndex={0} onClick={() => setSelectedBookId((current) => current === book.id ? null : book.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedBookId((current) => current === book.id ? null : book.id); } }}>
            <ImageThumb
              src={book.coverKey ? mediaUrl(book.coverKey) : ""}
              alt={`${book.title} kapak görseli`}
              fallback={book.title.slice(0, 1)}
            />
            <div>
              <span
                className={
                  book.lost || active.some((x) => x.bookId === book.id)
                    ? "badge red"
                    : "badge green"
                }
              >
                {book.lost ? "Kayıp" : active.some((x) => x.bookId === book.id) ? "Ödünçte" : "Rafta"}
              </span>
              <h3>{book.title}</h3>
              <p>{book.author}</p>
              {book.category && <small className="book-category">{book.category}</small>}
              <small>
                {book.inventoryNo} · {book.shelf || "Raf belirtilmedi"}
              </small>
                <div className="inline-actions">
                  {!readOnly && <><label className="image-upload" onClick={(event) => event.stopPropagation()}>
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
                    type="button"
                    className="edit-link"
                    onClick={(event) => {
                      event.stopPropagation();
                      setEditing(book);
                      setOpen(true);
                      window.setTimeout(() => document.getElementById("book-edit-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
                    }}
                  >
                    Düzenle
                  </button></>}
                  <button type="button" className="edit-link book-review-link" onClick={e=>{e.stopPropagation();setSelectedBookId(book.id);}}>Yorumlar</button>
                </div>
            </div>
          </article>
        ))}
      </div>
      {shown.length>visibleLimit&&<button className="secondary" onClick={()=>setVisibleLimit(x=>x+60)}>Daha fazla kitap göster ({shown.length-visibleLimit})</button>}
      {selectedBook && <div className="history-panel">
        <div className="history-head"><div><strong>{selectedBook.title}</strong><small>{selectedBook.author} · Aynı ad ve yazara ait tüm nüshalar</small></div><button className="small" onClick={() => setSelectedBookId(null)}>Kapat</button></div>
        <BookDiscussion key={selectedBook.id} bookId={selectedBook.id} canReview={studentMode && selectedBookLoans.some(l=>Boolean(l.returnedAt))}/>
        <div className="table-card"><table><thead><tr><th>Üye</th><th>DN</th><th>Alış tarihi</th><th>İade / Durum</th></tr></thead><tbody>{selectedBookLoans.map((loan) => <tr key={loan.id}><td><strong>{loan.studentName}</strong><small>{loan.studentNo} · {loan.grade}</small></td><td>{loan.inventoryNo}</td><td>{fmt(loan.loanedAt)}</td><td>{loan.returnedAt ? fmt(loan.returnedAt) : <span className="badge blue">Ödünçte</span>}</td></tr>)}</tbody></table>{!selectedBookLoans.length && <Empty text="Bu kitap veya aynı ad-yazardaki diğer nüshalar için ödünç kaydı bulunmuyor." />}</div>
      </div>}
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
  act: (a: string, p: Record<string, unknown>, s: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [classes, setClasses] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [newGrade, setNewGrade] = useState("");
  const [q, setQ] = useState("");
  const [memberTab, setMemberTab] = useState<"student" | "teacher" | "employee">("student");
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const shown = students.filter((x) => x.memberType === memberTab).filter((x) =>
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
        BRANŞI: x.branch||"",
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
        title="Üyeler"
        text="Öğrenci, öğretmen ve diğer çalışan üyeliklerini tek merkezden yönetin."
        action={
          <div className="actions member-page-actions">
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
                + {memberTab === "student" ? "Öğrenci" : memberTab === "teacher" ? "Öğretmen" : "Çalışan"} ekle
            </button>
          </div>
        }
      />
      <div className="member-tabs" role="tablist" aria-label="Üye türleri">{[["student", "Öğrenciler"], ["teacher", "Öğretmenler"], ["employee", "Diğer Çalışanlar"]].map(([id, label]) => <button key={id} className={memberTab === id ? "active" : ""} onClick={() => { setMemberTab(id as typeof memberTab); setOpen(false); setEditing(null); }}>{label}</button>)}</div>
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
          memberType={memberTab}
          busy={busy}
          initial={editing}
          submit={async (p) => {
            const ok = await act(
              editing ? "updateStudent" : "addStudent",
              editing ? { ...p, id: editing.id } : { ...p, memberType: memberTab },
              editing ? "Öğrenci güncellendi." : "Öğrenci kaydedildi.",
            );
            if (ok) { setOpen(false); setEditing(null); }
          }}
          onDelete={
            editing
              ? async () => {
                  if (
                    confirm("Bu öğrenciyi silmek istediğinize emin misiniz?")
                  ) {
                    const ok = await act(
                      "deleteStudent",
                      { id: editing.id },
                      "Öğrenci silindi.",
                    );
                    if (ok) { setOpen(false); setEditing(null); }
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
        placeholder="Üye no, ad soyad veya sınıf/birim ile ara"
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
              <th>Branşı</th>
              <th>Okuduğu</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((x) => [
              <tr key={`member-${x.id}`} className={`clickable-row ${selectedMemberId === x.id ? "selected" : ""}`} tabIndex={0} onClick={() => setSelectedMemberId((current) => current === x.id ? null : x.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedMemberId((current) => current === x.id ? null : x.id); } }}>
                {classes && (
                  <td>
                    <input
                      className="row-check"
                      type="checkbox"
                      onClick={(event) => event.stopPropagation()}
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
                  <label className="image-upload compact" onClick={(event) => event.stopPropagation()}>
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
                  {x.memberType==="student"&&<small>{x.studentNo} · {displayGrade(x.grade)}</small>}
                </td>
                <td>
                  <span className="badge blue">{x.memberType==="student"?displayGrade(x.grade):""}</span>
                </td>
                <td>{x.contact || "—"}</td>
                <td>{x.branch || "—"}</td>
                <td>
                  {
                    loans.filter((l) => l.studentId === x.id && l.returnedAt)
                      .length
                  }
                </td>
                <td>
                  <button
                    className="small"
                    onClick={(event) => {
                      event.stopPropagation();
                      setEditing(x);
                      setOpen(true);
                    }}
                  >
                    Düzenle
                  </button>
                </td>
              </tr>,
              selectedMemberId === x.id ? <tr className="member-history-row" key={`history-${x.id}`}><td colSpan={classes ? 8 : 7}>
                <div className="inline-history"><strong>{x.fullName} — aldığı bütün kitaplar</strong><div className="history-items">{loans.filter((loan) => loan.studentId === x.id).map((loan) => <span key={loan.id}><span><Photo imageKey={loan.bookCoverKey} name={loan.bookTitle}/><b>{loan.bookTitle}</b><small>{loan.author} · DN {loan.inventoryNo}</small></span><span><small>{fmt(loan.loanedAt)} → {loan.returnedAt ? fmt(loan.returnedAt) : "Hâlen ödünçte"}</small></span></span>)}</div>{!loans.some((loan) => loan.studentId === x.id) && <p className="empty">Bu üyenin ödünç kaydı bulunmuyor.</p>}</div>
              </td></tr> : null
            ])}
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
  act: (a: string, p: Record<string, unknown>, s: string) => Promise<boolean>;
}) {
  const [query, setQuery] = useState("");
  const shown = rows.filter((row) => `${row.studentName} ${row.studentNo} ${row.grade} ${row.contact} ${row.bookTitle} ${row.author} ${row.inventoryNo}`.toLocaleLowerCase("tr").includes(query.trim().toLocaleLowerCase("tr")));
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showPhones,setShowPhones]=useState(false);
  const selectable = shown;
  const selectedIds = selectable.filter((row) => selected.has(row.id)).map((row) => row.id);
  const allSelected = selectable.length > 0 && selectedIds.length === selectable.length;
  const reportRows = shown.map((x, index) => ({
    "SIRA NO": index + 1,
    SINIF: x.grade,
    NO: x.studentNo,
    "ADI SOYADI": x.studentName,
    "KİTAP ADI": x.bookTitle,
    YAZARI: x.author,
    "ALINDIĞI TARİH": fmt(x.loanedAt),
    "SON TESLİM": fmt(x.dueAt),
    "GECİKME SÜRESİ": `${daysBetween(x.dueAt, today)} gün`,
    CEZA: ((daysBetween(x.dueAt, today) * dailyFine) / 100).toLocaleString("tr-TR", {
      style: "currency",
      currency: "TRY",
    }),
  }));
  const phoneRows=shown.filter(x=>!selectedIds.length||selectedIds.includes(x.id)).map(x=>({"AD SOYAD":x.studentName,"SINIF":x.grade,"NUMARA":x.studentNo,"ALDIĞI KİTAP":x.bookTitle,"CEP TELEFONU":x.contact||"Kayıtlı değil"}));
  const exportWord = () => {
    const headings = Object.keys(reportRows[0] ?? {});
    const table = `<table border="1" cellspacing="0" cellpadding="6"><thead><tr>${headings.map((x) => `<th>${x}</th>`).join("")}</tr></thead><tbody>${reportRows.map((row) => `<tr>${headings.map((key) => `<td>${String(row[key as keyof typeof row] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    downloadBlob("gec-kalanlar.doc", new Blob([`<html><meta charset="utf-8"><body><h1>Geç Kalanlar</h1>${table}</body></html>`], { type: "application/msword;charset=utf-8" }));
  };
  const exportPdf = () => {
    downloadTextPdf("gec-kalanlar.pdf", "Gec Kalanlar Raporu", reportRows.map((row) =>
      `${row["SIRA NO"]}. ${row.SINIF} / ${row.NO} - ${row["ADI SOYADI"]} | ${row["KİTAP ADI"]} | ${row["GECİKME SÜRESİ"]} | ${row.CEZA}`,
    ));
  };
  const exportPng = () => {
    const width = 1500;
    const rowHeight = 34;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = Math.max(180, 100 + reportRows.length * rowHeight);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#153b2d";
    context.font = "bold 26px Arial";
    context.fillText("Geç Kalanlar Raporu", 24, 38);
    context.font = "bold 15px Arial";
    context.fillText("Sıra", 24, 78); context.fillText("Sınıf / No", 85, 78); context.fillText("Adı Soyadı", 230, 78); context.fillText("Kitap", 520, 78); context.fillText("Gecikme", 1160, 78); context.fillText("Ceza", 1320, 78);
    context.font = "14px Arial";
    reportRows.forEach((row, index) => {
      const y = 106 + index * rowHeight;
      context.fillStyle = index % 2 ? "#f4f7f4" : "#ffffff";
      context.fillRect(16, y - 23, width - 32, rowHeight);
      context.fillStyle = "#17221d";
      context.fillText(String(row["SIRA NO"]), 24, y);
      context.fillText(`${row.SINIF} / ${row.NO}`, 85, y);
      context.fillText(String(row["ADI SOYADI"]).slice(0, 32), 230, y);
      context.fillText(String(row["KİTAP ADI"]).slice(0, 68), 520, y);
      context.fillText(String(row["GECİKME SÜRESİ"]), 1160, y);
      context.fillText(String(row.CEZA), 1320, y);
    });
    canvas.toBlob((blob) => blob && downloadBlob("gec-kalanlar.png", blob), "image/png");
  };
  return (
    <section>
      <PageHead
        title="Geç Kalanlar"
        text="Teslim tarihi geçen kitapları ve üyelerin iletişim bilgilerini takip edin."
        action={<div className="actions overdue-actions">
          <button className="secondary" disabled={!shown.length} onClick={() => downloadExcel("gec-kalanlar.xlsx", "Geç Kalanlar", reportRows)}>Excel</button>
          <button className="secondary" disabled={!shown.length} onClick={exportWord}>Word</button>
          <button className="secondary" disabled={!shown.length} onClick={exportPdf}>PDF</button>
          <button className="secondary" disabled={!shown.length} onClick={exportPng}>PNG</button>
          <button className="primary" onClick={()=>setShowPhones(v=>!v)}>Gecikenlerin Cep Telefonları</button>
        </div>}
      />
      <Search value={query} setValue={setQuery} placeholder="Üye adı, numara, sınıf, telefon, kitap, yazar veya DN ile ara" />
      <div className="actions"><button className="secondary" disabled={busy || !selectable.length} onClick={() => setSelected((current) => { const next = new Set(current); selectable.forEach((row) => allSelected ? next.delete(row.id) : next.add(row.id)); return next; })}>{allSelected ? "Seçimi kaldır" : "Tümünü seç"}</button><span>{shown.length} / {rows.length} kayıt · Seçim ve telefon listesi mevcut arama sonuçlarına uygulanır.</span></div>
      {showPhones&&<section className="card community-card"><h3>Gecikenlerin Cep Telefonları</h3><div className="actions"><button disabled={!phoneRows.length} onClick={()=>downloadExcel("gecikenlerin-cep-telefonlari.xlsx","Cep Telefonları",phoneRows)}>Excel indir</button><button disabled={!phoneRows.length} onClick={()=>downloadCsv("gecikenlerin-cep-telefonlari.csv",phoneRows)}>CSV indir</button></div><p>Seçim varsa seçili kayıtlar, yoksa arama sonucundaki tüm gecikenler gösterilir.</p><div className="table-card"><table><thead><tr>{Object.keys(phoneRows[0]||{}).map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{phoneRows.map((row,i)=><tr key={i}>{Object.values(row).map((v,j)=><td key={j}>{v}</td>)}</tr>)}</tbody></table></div></section>}
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
            {shown.map((x) => (
              <tr key={x.id}>
                <td>
                  <input
                    type="checkbox"
                    disabled={!selectable.some((row) => row.id === x.id)}
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
                  <Photo hidden imageKey={x.studentPhotoKey} name={x.studentName} kind="member"/>
                  <small>
                    {x.studentNo} · {x.grade}
                  </small>
                </td>
                <td>
                  <Photo hidden imageKey={x.bookCoverKey} name={x.bookTitle}/>
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
        {!shown.length && <Empty text="Bu aramada geciken kitap bulunmuyor." />}
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
  canDelete = false,
}: {
  rows: BookRequest[];
  students: Student[];
  busy: boolean;
  act: (a: string, p: Record<string, unknown>, s: string) => Promise<boolean>;
  studentMode?: boolean;
  canDelete?: boolean;
}) {
  const [archive,setArchive]=useState(false);
  const shownRows=rows.filter(r=>archive?r.status!=="new":r.status==="new");
  const [studentId, setStudentId] = useState(
    studentMode && students[0] ? String(students[0].id) : "",
  );
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [note, setNote] = useState("");
  const submit = async () => {
    const saved = await act(
      "addBookRequest",
      { studentId: Number(studentId), title, author, note },
      "Kitap talebi yöneticinin listesine eklendi.",
    );
    if(!saved)return;
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
      <div className="member-tabs"><button className={!archive?"active":""} onClick={()=>setArchive(false)}>Aktif talepler ({rows.filter(r=>r.status==="new").length})</button><button className={archive?"active":""} onClick={()=>setArchive(true)}>Pasif / Değerlendirilen talepler ({rows.filter(r=>r.status!=="new").length})</button></div>
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
              {shownRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Photo imageKey={students.find(s=>s.id===row.studentId)?.photoKey||""} name={row.studentName} kind="member"/><strong>{row.studentName}</strong>
                    <small>{row.studentNo}</small>
                  </td>
                  <td>
                    <strong>{row.title}</strong>
                    <small>{row.author || "Yazar belirtilmedi"}</small>
                  </td>
                  <td>{row.note || "—"}</td>
                  <td>
                    {studentMode ? (
                      <span className="badge blue">{{new:"Yeni",reviewed:"İnceleniyor",approved:"Onaylandı",rejected:"Uygun değil",purchased:"Temin edildi"}[row.status] || row.status}</span>
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
                  {canDelete&&<button className="small danger" disabled={busy} onClick={()=>{if(confirm("Bu kitap talebi silinsin mi?"))void act("deleteBookRequest",{id:row.id},"Talep silindi.");}}>Talebi sil</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!shownRows.length && <Empty text="Henüz kitap talebi yok." />}
        </div>
      </div>
    </section>
  );
}

function Notes({ rows, busy, act }: { rows: AdminNote[]; busy: boolean; act: (a: string, p: Record<string, unknown>, s: string) => Promise<boolean> }) {
  const [content, setContent] = useState("");
  const add = async () => {
    if (!content.trim()) return;
    if (await act("addNote", { content }, "Not eklendi.")) setContent("");
  };
  return <section>
    <PageHead title="Notlar" text="Yönetici notlarını kaydedin, son eklenenleri üstte görün ve tamamlananları işaretleyin." />
    <div className="notes-layout">
      <Card title="Not Ekle">
        <label>Yeni not<textarea rows={5} value={content} onChange={(event) => setContent(event.target.value)} placeholder="Hatırlatmak istediğiniz işi yazın…" /></label>
        <button className="primary full" disabled={busy || !content.trim()} onClick={() => void add()}>Notu kaydet</button>
      </Card>
      <Card title={`Notlar (${rows.length})`}>
        <ol className="note-list">
          {rows.map((row, index) => <li key={row.id} className={row.done ? "done" : ""}>
            <span className="note-number">{index + 1}</span>
            <span className="note-copy"><strong>{row.content}</strong><small>{new Date(row.createdAt).toLocaleString("tr-TR")}</small></span>
            <span className="note-actions"><label className="note-check"><input type="checkbox" checked={Boolean(row.done)} disabled={busy} onChange={(event) => void act("toggleNote", { id: row.id, done: event.target.checked }, event.target.checked ? "Not tamamlandı." : "Not yeniden açıldı.")} /> Yapıldı</label><button className="danger compact" disabled={busy} onClick={() => confirm("Bu not silinsin mi?") && void act("deleteNote", { id: row.id }, "Not silindi.")}>Sil</button></span>
          </li>)}
        </ol>
        {!rows.length && <Empty text="Henüz not eklenmedi." />}
      </Card>
    </div>
  </section>;
}

type BulkAssignment = { file: File; kind: "student" | "book"; recordKey: string; label: string };

function BulkImages({ students, books, busy, act }: { students: Student[]; books: Book[]; busy: boolean; act: (a: string, p: Record<string, unknown>, s: string) => Promise<boolean> }) {
  const [mode, setMode] = useState<"student" | "teacher" | "employee" | "book">("student");
  const [query, setQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [shelfFilter, setShelfFilter] = useState("");
  const [assignments, setAssignments] = useState<Record<string, BulkAssignment>>({});
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const normalize = (value: string) => value.trim().replace(/\.[^.]+$/, "").toLocaleUpperCase("tr");
  const memberRows = students.filter((row) => row.memberType === mode);
  const rows = mode === "book" ? books : memberRows;
  const grades = Array.from(new Set(students.filter((row) => row.memberType === "student").map((row) => row.grade || "Sınıfsız"))).sort((a, b) => a.localeCompare(b, "tr", { numeric: true }));
  const categories = Array.from(new Set(books.map((book) => book.category || "Kategorisiz"))).sort((a, b) => a.localeCompare(b, "tr"));
  const shelves = Array.from(new Set(books.map((book) => book.shelf || "Raf belirtilmedi"))).sort((a, b) => a.localeCompare(b, "tr", { numeric: true }));
  const visible = rows
    .filter((row) => normalize(mode === "book" ? `${(row as Book).inventoryNo} ${(row as Book).title} ${(row as Book).author}` : `${(row as Student).studentNo} ${(row as Student).fullName} ${(row as Student).grade}`).includes(normalize(query)))
    .filter((row) => mode !== "student" || !gradeFilter || ((row as Student).grade || "Sınıfsız") === gradeFilter)
    .filter((row) => mode !== "book" || !categoryFilter || ((row as Book).category || "Kategorisiz") === categoryFilter)
    .filter((row) => mode !== "book" || !shelfFilter || ((row as Book).shelf || "Raf belirtilmedi") === shelfFilter);
  const assign = (file: File, row: Student | Book) => {
    if (!file.type.startsWith("image/")) return;
    const isBook = mode === "book";
    const recordKey = isBook ? (row as Book).inventoryNo : (row as Student).studentNo;
    const key = `${isBook ? "book" : "student"}:${recordKey}`;
    setAssignments((current) => ({ ...current, [key]: { file, kind: isBook ? "book" : "student", recordKey, label: isBook ? (row as Book).title : (row as Student).fullName } }));
  };
  const matchFiles = (files: FileList | File[]) => {
    const candidates = (mode === "book" ? books : memberRows).map((row) => ({ row, key: normalize(mode === "book" ? (row as Book).inventoryNo : (row as Student).studentNo) })).sort((a, b) => b.key.length - a.key.length);
    const matched: Record<string, BulkAssignment> = {};
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const name = normalize(file.name);
      const candidate = candidates.find((item) => name === item.key || name.startsWith(`${item.key} `) || name.startsWith(`${item.key}-`) || name.startsWith(`${item.key}_`));
      if (!candidate) continue;
      const isBook = mode === "book";
      const row = candidate.row;
      const recordKey = isBook ? (row as Book).inventoryNo : (row as Student).studentNo;
      matched[`${isBook ? "book" : "student"}:${recordKey}`] = { file, kind: isBook ? "book" : "student", recordKey, label: isBook ? (row as Book).title : (row as Student).fullName };
    }
    setAssignments((current) => ({ ...current, ...matched }));
  };
  const uploadAll = async () => {
    const entries = Object.values(assignments);
    if (!entries.length) return;
    setUploading(true); setProgress(0);
    let succeeded = 0;
    for (let index = 0; index < entries.length; index += 1) {
      try { await uploadImage(entries[index].file, entries[index].kind, entries[index].recordKey); succeeded += 1; } catch { /* Remaining files continue. */ }
      setProgress(Math.round(((index + 1) / entries.length) * 100));
    }
    await act("noop", {}, `${succeeded}/${entries.length} görsel yüklendi.`);
    if (succeeded === entries.length) setAssignments({});
    setUploading(false);
  };
  const groups = mode === "student"
    ? Array.from(new Set(visible.map((row) => (row as Student).grade || "Sınıfsız"))).sort((a, b) => a.localeCompare(b, "tr", { numeric: true }))
    : [mode === "teacher" ? "Öğretmenler" : mode === "employee" ? "Diğer Çalışanlar" : `Kitaplar${categoryFilter ? ` · ${categoryFilter}` : ""}${shelfFilter ? ` · Raf ${shelfFilter}` : ""}`];
  return <section>
    <PageHead title="Toplu İşlemler" text="Üye ve kitap görsellerini dosya adından otomatik eşleştirin veya ilgili kaydın üzerine sürükleyin." />
    <Card title="Toplu Görsel Yükleme">
      <div className="bulk-tabs">
        {([["student", "Öğrenciler"], ["teacher", "Öğretmenler"], ["employee", "Diğer Çalışanlar"], ["book", "Kitaplar"]] as const).map(([id, label]) => <button key={id} className={mode === id ? "active" : ""} onClick={() => { setMode(id); setQuery(""); setGradeFilter(""); setCategoryFilter(""); setShelfFilter(""); }}>{label}</button>)}
      </div>
      {mode === "student" && <div className="bulk-filter-row"><label>Sınıf<select value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)}><option value="">Tüm sınıflar</option>{grades.map((grade) => <option key={grade}>{grade}</option>)}</select></label><button className="secondary" disabled={!gradeFilter} onClick={() => setGradeFilter("")}>Sınıf filtresini temizle</button><strong>{visible.length} öğrenci</strong></div>}
      {mode === "book" && <div className="bulk-filter-row"><label>Kategori<select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="">Tüm kategoriler</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label>Raf<select value={shelfFilter} onChange={(event) => setShelfFilter(event.target.value)}><option value="">Tüm raflar</option>{shelves.map((shelf) => <option key={shelf}>{shelf}</option>)}</select></label><button className="secondary" disabled={!categoryFilter && !shelfFilter} onClick={() => { setCategoryFilter(""); setShelfFilter(""); }}>Kitap filtrelerini temizle</button><strong>{visible.length} kitap</strong></div>}
      <div className="bulk-toolbar">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Numara, ad veya kitap ara…" />
        <label className="import-btn">Toplu fotoğraf seç<input hidden type="file" accept="image/*" multiple onChange={(event) => event.target.files && matchFiles(event.target.files)} /></label>
        <button className="primary" disabled={busy || uploading || !Object.keys(assignments).length} onClick={() => void uploadAll()}>Seçilenleri yükle ({Object.keys(assignments).length})</button>
      </div>
      {(uploading || progress > 0) && <div className="upload-progress"><span style={{ width: `${progress}%` }} /><strong>{progress}%</strong></div>}
      <p className="bulk-help">Otomatik eşleştirme için dosya adını üye numarası veya kitap demirbaş numarasıyla başlatın. İsterseniz fotoğrafı doğrudan kaydın üzerine bırakın.</p>
      <div className="bulk-groups">
        {groups.map((group) => <div className="bulk-group" key={group}><h3>{group}</h3><div className="bulk-grid">
          {visible.filter((row) => mode !== "student" || ((row as Student).grade || "Sınıfsız") === group).map((row) => {
            const isBook = mode === "book"; const recordKey = isBook ? (row as Book).inventoryNo : (row as Student).studentNo; const assignmentKey = `${isBook ? "book" : "student"}:${recordKey}`; const selected = assignments[assignmentKey]; const imageKey = isBook ? (row as Book).coverKey : (row as Student).photoKey;
            return <label key={`${mode}-${row.id}`} className={`bulk-drop ${selected ? "selected" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) assign(file, row); }}>
              <Photo imageKey={imageKey} name={isBook?(row as Book).title:(row as Student).fullName} kind={isBook?"book":"member"}/>
              <span><strong>{isBook ? (row as Book).title : (row as Student).fullName}</strong><small>{recordKey}{!isBook && ` · ${(row as Student).grade}`}</small><em>{selected ? selected.file.name : "Fotoğrafı buraya sürükleyin"}</em></span>
              <input hidden type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && assign(event.target.files[0], row)} />
            </label>;
          })}
        </div></div>)}
      </div>
      {!visible.length && <Empty text="Bu bölümde eşleşen kayıt bulunamadı." />}
    </Card>
  </section>;
}

function Reports({ data }: { data: Data }) {
  const [yearStart, yearEnd] = data.settings.schoolYear.split("-").map(Number);
  const [startDate, setStartDate] = useState(`${yearStart || new Date().getFullYear()}-09-01`);
  const [endDate, setEndDate] = useState(`${yearEnd || (yearStart + 1)}-06-30`);
  const [detail, setDetail] = useState<{ kind: "student"; id: number } | { kind: "book"; key: string } | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (detail) detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [detail]);
  const { completed, readers, titles } = reportData(data.loans, startDate, endDate);
  const selectedReader = detail?.kind === "student" ? readers.find((row) => row.id === detail.id) : undefined;
  const selectedTitle = detail?.kind === "book" ? titles.find((row) => row.key === detail.key) : undefined;
  const detailRows = completed.filter((loan) => selectedReader ? loan.studentId === selectedReader.id : selectedTitle ? JSON.stringify([loan.bookTitle, loan.author]) === selectedTitle.key : false);
  return (
    <section>
      <PageHead
        title="Raporlar ve İstatistikler"
        text={`${data.settings.schoolYear} döneminin okuma hareketlerini inceleyin.`}
      />
      <div className="grid-2 reports-grid">
        <Card title="En Çok Okuyan Öğrenciler">
          <div className="date-range"><label>Başlangıç tarihi<input type="date" value={startDate} max={endDate} onChange={(e) => setStartDate(e.target.value)} /></label><label>Bitiş tarihi<input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} /></label></div>
          <Ranking
            onSelect={(index) => setDetail({ kind: "student", id: readers[index].id })}
            rows={readers.map((x) => [
              x.name,
              `${x.grade} · ${x.count} kitap`,
              x.count,
            ])}
          />
        </Card>
        <Card title="En Çok Okunan Kitaplar">
          <div className="date-range"><label>Başlangıç tarihi<input type="date" value={startDate} max={endDate} onChange={(e) => setStartDate(e.target.value)} /></label><label>Bitiş tarihi<input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} /></label></div>
          <Ranking
            onSelect={(index) => setDetail({ kind: "book", key: titles[index].key })}
            rows={titles.map((x) => [
              x.title,
              `${x.author} · ${x.count} ödünç`,
              x.count,
            ])}
          />
        </Card>
      </div>
      {(selectedReader || selectedTitle) && <div ref={detailRef} className="report-detail" role="region" aria-live="polite" aria-label="Seçilen okuma ayrıntıları"><Card title={selectedReader ? "Okuduğu kitaplar" : "Okuyan üyeler"} action="Kapat" onAction={() => setDetail(null)}>
        <div className="report-selected-identity"><Photo imageKey={selectedReader ? (data.students.find(student=>student.id===selectedReader.id)?.photoKey || detailRows[0]?.studentPhotoKey || "") : (detailRows.find(loan=>loan.bookCoverKey)?.bookCoverKey || "")} name={selectedReader?.name || selectedTitle?.title || ""} kind={selectedReader?"member":"book"}/><strong>{selectedReader?.name || selectedTitle?.title}</strong></div>
        <p className="report-detail-note">{fmt(startDate)} – {fmt(endDate)} tarihleri arasındaki sıralamaya dahil edilen {detailRows.length} tamamlanmış ödünç işlemi.</p>
        <div className="table-wrap"><table><thead><tr><th>Üye</th><th>Kitap</th><th>Alış</th><th>İade</th></tr></thead><tbody>{detailRows.map((loan) => <tr key={loan.id}><td><strong>{loan.studentName}</strong><small>{loan.studentNo} · {loan.grade}</small></td><td><strong>{loan.bookTitle}</strong><small>{loan.author} · DN {loan.inventoryNo}</small></td><td>{fmt(loan.loanedAt)}</td><td>{fmt(loan.returnedAt!)}</td></tr>)}</tbody></table></div>
      </Card></div>}
    </section>
  );
}

function InventoryPersistent({ books, active, sessions, entries, today, busy, act }: { books: Book[]; active: Loan[]; sessions: InventorySession[]; entries: InventoryEntry[]; today: string; busy: boolean; act: (a: string, p: Record<string, unknown>, s: string) => Promise<boolean> }) {
  const [listLimit,setListLimit]=useState(100);
  const [showNew, setShowNew] = useState(!sessions.length), [countNo, setCountNo] = useState(""), [countDate, setCountDate] = useState(today);
  const [sessionKey, setSessionKey] = useState(sessions[0] ? String(sessions[0].id) : ""), [query, setQuery] = useState(""), deferredQuery = useDeferredValue(query);
  const [shelf, setShelf] = useState(""), [categoryFilter, setCategoryFilter] = useState(""), [shelfFilter, setShelfFilter] = useState("");
  const [selectedMatches,setSelectedMatches]=useState<Set<number>>(new Set());
  const [countingMatches,setCountingMatches]=useState(false);
  const countingRef=useRef(false);
  const [selectedBookId, setSelectedBookId] = useState(0), [optimisticIds, setOptimisticIds] = useState<Set<number>>(new Set()), [compareA, setCompareA] = useState(""), [compareB, setCompareB] = useState("");
  useEffect(()=>setOptimisticIds(new Set()),[sessionKey]);
  const session = sessions.find((x) => String(x.id) === sessionKey) || sessions[0];
  const syncedSession = useRef<number | null>(null);
  useEffect(() => {
    if (!session || session.status !== "open" || syncedSession.current === session.id || busy) return;
    syncedSession.current = session.id;
    void act("syncInventoryLoans", { sessionId: session.id }, "Ödünçteki sayılmamış kitaplar mevcut sayıma eklendi.");
  }, [session?.id, session?.status, busy]);
  const sessionEntries = useMemo(() => entries.filter((x) => x.sessionId === session?.id), [entries, session?.id]);
  const entryByBook = useMemo(() => new Map(sessionEntries.map((entry) => [entry.bookId, entry])), [sessionEntries]);
  const countedIds = useMemo(() => new Set([...sessionEntries.map((x) => x.bookId), ...optimisticIds]), [sessionEntries, optimisticIds]);
  const activeIds = useMemo(() => new Set(active.map((loan) => loan.bookId)), [active]);
  const categories = useMemo(() => [...new Set(books.map((book) => book.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"tr")), [books]);
  const shelves = useMemo(() => [...new Set(books.map((book) => book.shelf).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"tr",{numeric:true})), [books]);
  const normalizeSearch = (value: string) => value.toLocaleLowerCase("tr").replace(/\s+/g," ").trim();
  const searchMatches = useMemo(() => { const needle=normalizeSearch(deferredQuery); if(!needle) return []; return books.filter((book)=>normalizeSearch(`${book.inventoryNo} ${book.isbn} ${book.title} ${book.author}`).includes(needle)).slice(0,30); }, [books,deferredQuery]);
  const exact = useMemo(() => selectedInventoryBook(books,query,selectedBookId,searchMatches), [books,query,selectedBookId,searchMatches]);
  const visibleBooks = useMemo(() => books.filter(book=>(!categoryFilter||book.category===categoryFilter)&&(!shelfFilter||book.shelf===shelfFilter)), [books,categoryFilter,shelfFilter]);
  const remainingBooks = useMemo(() => visibleBooks.filter(book=>!countedIds.has(book.id)), [visibleBooks,countedIds]);
  const countedBooks = useMemo(() => visibleBooks.filter(book=>countedIds.has(book.id)).sort((a,b)=>(entryByBook.get(b.id)?.countedAt||"").localeCompare(entryByBook.get(a.id)?.countedAt||"")), [visibleBooks,countedIds,entryByBook]);
  const create = async () => { if (!countNo.trim() || !countDate) return alert("Sayım numarası ve tarih girin."); const ok=await act("createInventorySession",{countNo,countDate},"Sayım açıldı; aynı numara ve tarihle daha sonra devam edebilirsiniz."); if(ok){setShowNew(false);setCountNo("");} };
  const deleteSession = async () => { if (!session || !confirm(`#${session.countNo} numaralı ${fmt(session.countDate)} tarihli sayım ve içindeki tüm sayılan kitap kayıtları silinsin mi?`)) return; const ok = await act("deleteInventorySession", { sessionId: session.id }, "Sayım kaydı silindi."); if (ok) { setSessionKey(""); setOptimisticIds(new Set()); } };
  const countBook = async (book?: Book) => { if(countingRef.current)return; if(!session)return alert("Önce yeni bir sayım açın veya kayıtlı sayımı seçin."); if(!book)return alert(searchMatches.length>1?"Birden fazla kitap bulundu. Listeden doğru kitabı seçin.":"Bu bilgiyle kayıtlı kitap bulunamadı."); if(countedIds.has(book.id))return alert("Bu kitap bu sayımda zaten sayıldı."); setOptimisticIds(current=>new Set(current).add(book.id)); const ok=await act("countInventoryBook",{sessionId:session.id,bookId:book.id,shelf},"Kitap sayıma kaydedildi."); if(ok){setQuery("");setShelf("");setSelectedBookId(0);}else setOptimisticIds(current=>{const next=new Set(current);next.delete(book.id);return next;}); };
  const countMatches = async () => {
    if(!session||busy||countingRef.current)return;
    const chosen=searchMatches.filter(book=>selectedMatches.has(book.id)&&!countedIds.has(book.id));
    if(!chosen.length)return;
    countingRef.current=true;setCountingMatches(true);
    try {for(const book of chosen) {
      const ok=await act("countInventoryBook",{sessionId:session.id,bookId:book.id,shelf},"Seçili kitap sayıma kaydedildi.");
      if(!ok)break;
      setSelectedMatches(current=>{const next=new Set(current);next.delete(book.id);return next;});
    }}finally{countingRef.current=false;setCountingMatches(false);}
  };
  const comparison = useMemo(() => { const a=Number(compareA),b=Number(compareB); if(!a||!b||a===b)return null; const aa=new Set(entries.filter(x=>x.sessionId===a).map(x=>x.bookId)),bb=new Set(entries.filter(x=>x.sessionId===b).map(x=>x.bookId)); return {onlyA:books.filter(x=>aa.has(x.id)&&!bb.has(x.id)),onlyB:books.filter(x=>bb.has(x.id)&&!aa.has(x.id)),common:books.filter(x=>aa.has(x.id)&&bb.has(x.id))}; }, [compareA,compareB,entries,books]);
  const download = () => {
    if (!comparison) return;
    const rows = [["Durum","DN","ISBN","Kitap","Yazar","Raf"], ...comparison.onlyA.map(x => ["Yalnız ilk sayım",x.inventoryNo,x.isbn,x.title,x.author,x.shelf]), ...comparison.onlyB.map(x => ["Yalnız ikinci sayım",x.inventoryNo,x.isbn,x.title,x.author,x.shelf]), ...comparison.common.map(x => ["Her iki sayımda",x.inventoryNo,x.isbn,x.title,x.author,x.shelf])];
    const csv = rows.map(row => row.map(v => `"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = "sayim-karsilastirma-raporu.csv"; a.click(); URL.revokeObjectURL(url);
  };
  return <section>
    <PageHead title="Kitap Sayımı ve Raf Kontrol" text="Tarihli sayımları kaydedin, yarım kalan sayıma devam edin ve iki sayımı karşılaştırın." action={<button className="primary" onClick={() => setShowNew(true)}>Yeni sayım</button>} />
    {showNew && <Card title="Yeni sayım"><div className="form-grid three"><label>Sayım numarası<input value={countNo} onChange={e=>setCountNo(e.target.value)} placeholder="Örn. 2026-01" /></label><label>Sayım tarihi<input type="date" value={countDate} onChange={e=>setCountDate(e.target.value)} /></label><button className="primary" disabled={busy} onClick={()=>void create()}>Sayımı başlat / devam et</button></div></Card>}
    <div className="grid-2">
      <Card title="Aktif sayım"><div className="form-grid one"><label>Kayıtlı sayım<select disabled={countingMatches} value={session?.id || ""} onChange={e=>{setSessionKey(e.target.value);setOptimisticIds(new Set());setSelectedMatches(new Set());setSelectedBookId(0);}}><option value="">Seçin…</option>{sessions.map(x=><option key={x.id} value={x.id}>#{x.countNo} · {fmt(x.countDate)} · {entries.filter(e=>e.sessionId===x.id).length} kitap</option>)}</select></label><button className="danger" disabled={busy||!session} onClick={()=>void deleteSession()}>Kayıtlı sayımı sil</button><div className="form-grid two"><label>Kategori<select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}><option value="">Tüm kategoriler</option>{categories.map(x=><option key={x}>{x}</option>)}</select></label><label>Raf<select value={shelfFilter} onChange={e=>setShelfFilter(e.target.value)}><option value="">Tüm raflar</option>{shelves.map(x=><option key={x}>{x}</option>)}</select></label></div><label>DN / ISBN / Kitap / Yazar<input disabled={countingMatches} autoFocus value={query} onChange={e=>{setQuery(e.target.value);setSelectedBookId(0);setSelectedMatches(new Set());}} onKeyDown={e=>{if(e.key==="Enter")void countBook(exact);}} placeholder="Okutun veya kitap-yazar adı yazın" /></label>{query.trim()&&searchMatches.length>1&&<fieldset className="inventory-matches" disabled={busy||countingMatches}><legend>Eşleşen kitap</legend><p>Bir veya birden fazla nüshayı işaretleyin. Her nüsha kendi demirbaş numarasıyla sayılır.</p>{searchMatches.map(book=><label className="check-label" key={book.id}><input type="checkbox" disabled={countedIds.has(book.id)} checked={selectedMatches.has(book.id)} onChange={e=>{const checked=e.target.checked;setSelectedBookId(checked?book.id:0);setSelectedMatches(current=>{const next=new Set(current);checked?next.add(book.id):next.delete(book.id);return next;});}}/><span>{book.inventoryNo} · {book.title} · {book.author}{countedIds.has(book.id)?" — Sayıldı":""}</span></label>)}<button type="button" className="primary" disabled={!session||!searchMatches.some(book=>selectedMatches.has(book.id)&&!countedIds.has(book.id))} onClick={()=>void countMatches()}>Seçili kitapları say ({searchMatches.filter(book=>selectedMatches.has(book.id)&&!countedIds.has(book.id)).length})</button></fieldset>}<QrScanner disabled={busy||countingMatches||!session} onScan={value=>{setQuery(value);setSelectedBookId(0);setSelectedMatches(new Set());}}/><div className="shelf-save-field"><span className="shelf-save-heading"><label htmlFor="inventory-new-shelf">Yeni raf (isteğe bağlı)</label>{shelf.trim()&&exact&&shelf.trim()!==exact.shelf&&<button type="button" className="small" disabled={busy||countingMatches} onClick={async()=>{if(await act("saveBookShelf",{bookId:exact.id,shelf},"Kitabın rafı kaydedildi; sayım durumu değişmedi."))setShelf("");}}>Kaydet</button>}</span><input id="inventory-new-shelf" disabled={countingMatches} value={shelf} onChange={e=>setShelf(e.target.value)} placeholder={exact?.shelf||"Mevcut raf korunur"}/></div>{exact&&<p className="muted"><b>{exact.title}</b> · {exact.author} · Raf {exact.shelf||"—"}</p>}{(searchMatches.length<=1||Boolean(exact&&!selectedMatches.size))&&<button className="primary" disabled={busy||countingMatches||!session||!exact||countedIds.has(exact.id)} onClick={()=>void countBook(exact)}>Kitabı say</button>}</div></Card>
      <Card title={`Sayım özeti (${sessionEntries.length}/${books.length})`}><div className="inventory-summary"><span><b>{sessionEntries.length}</b>Sayılan</span><span><b>{Math.max(0, books.length-sessionEntries.length)}</b>Sayılmayan</span><span><b>{sessionEntries.filter(e=>e.shelfBefore!==e.shelfAfter).length}</b>Rafı değişen</span></div><p className="muted">Son işlem: {session ? new Date(session.updatedAt).toLocaleString("tr-TR") : "—"}</p></Card>
    </div>
    <div className="inventory-transfer-grid"><Card title={`Kayıtlı kitaplar - sayılmayı bekleyen (${remainingBooks.length})`}><div className="inventory-book-list">{remainingBooks.slice(0,listLimit).map(book=><article key={book.id}><Photo imageKey={book.coverKey} name={book.title}/><div><strong>{book.title}</strong><small>{book.author} · DN {book.inventoryNo} · Raf {book.shelf||"—"}</small><small>{book.category||"Kategori yok"}</small></div><button className="secondary compact" disabled={busy||!session} onClick={()=>void countBook(book)}>Say</button></article>)}{!remainingBooks.length&&<Empty text="Bu filtrede sayılmayı bekleyen kitap kalmadı."/>}</div></Card><Card title={`Sayımı yapılan kitaplar (${countedBooks.length})`}><div className="inventory-book-list counted">{countedBooks.slice(0,listLimit).map(book=>{const entry=entryByBook.get(book.id);return <article key={book.id}><Photo imageKey={book.coverKey} name={book.title}/><div><strong>{book.title}</strong><small>{book.author} · DN {book.inventoryNo}</small><small>{entry?new Date(entry.countedAt).toLocaleString("tr-TR"):"Kaydediliyor…"}</small>{entry?.source === "loan" && <span className="badge blue">Ödünç işlemi nedeniyle otomatik sayıldı</span>}</div><div className="inventory-counted-actions"><input aria-label={`${book.title} yeni raf`} defaultValue={entry?.shelfAfter||book.shelf} onBlur={e=>{const value=e.target.value.trim();if(entry&&value&&value!==(entry.shelfAfter||book.shelf))void act("updateInventoryShelf",{sessionId:session?.id,bookId:book.id,shelf:value},"Raf bilgisi güncellendi.");}}/><span className={`badge ${activeIds.has(book.id)?"blue":"green"}`}>{activeIds.has(book.id)?"Ödünçte":"Rafta"}</span></div></article>})}{!countedBooks.length&&<Empty text="Sayılan kitaplar bu sütuna taşınacak."/>}</div></Card></div>
    {Math.max(remainingBooks.length,countedBooks.length)>listLimit&&<button className="secondary" onClick={()=>setListLimit(x=>x+100)}>Sonraki 100 kaydı göster</button>}
    <Card title="Sayım günlerini karşılaştır"><div className="form-grid three"><label>İlk sayım<select value={compareA} onChange={e=>setCompareA(e.target.value)}><option value="">Seçin…</option>{sessions.map(x=><option key={x.id} value={x.id}>#{x.countNo} · {fmt(x.countDate)}</option>)}</select></label><label>İkinci sayım<select value={compareB} onChange={e=>setCompareB(e.target.value)}><option value="">Seçin…</option>{sessions.map(x=><option key={x.id} value={x.id}>#{x.countNo} · {fmt(x.countDate)}</option>)}</select></label><button className="secondary" disabled={!comparison} onClick={download}>Karşılaştırma raporunu indir</button></div>{comparison&&<div className="inventory-summary"><span><b>{comparison.onlyA.length}</b>Yalnız ilk sayımda</span><span><b>{comparison.onlyB.length}</b>Yalnız ikinci sayımda</span><span><b>{comparison.common.length}</b>Her ikisinde</span></div>}</Card>
  </section>;
}

function InventoryLegacy({ books, active, busy, act }: { books: Book[]; active: Loan[]; busy: boolean; act: (a: string, p: Record<string, unknown>, s: string) => Promise<boolean> }) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [shelfFilter, setShelfFilter] = useState("");
  const presetCategories = [
    "İNGİLİZ EDEBİYATI",
    "FRANSIZ EDEBİYATI",
    "DENEME MAKALE",
    "TÜRK ROMAN HİKAYE",
  ];
  const categories = [
    ...new Set([...presetCategories, ...books.map((x) => x.category).filter(Boolean)]),
  ].sort((a, b) => a.localeCompare(b, "tr"));
  const shelfLetter = (author: string) =>
    (author.trim().split(/\s+/).at(-1)?.[0] ?? "?").toLocaleUpperCase("tr");
  const shelves = [...new Set(books.map((x) => x.shelf || shelfLetter(x.author)).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr"));
  const groupedBooks = books
    .filter((x) => !categoryFilter || x.category === categoryFilter)
    .filter((x) => !shelfFilter || (x.shelf || shelfLetter(x.author)) === shelfFilter)
    .sort(
      (a, b) =>
        shelfLetter(a.author).localeCompare(shelfLetter(b.author), "tr") ||
        a.author.localeCompare(b.author, "tr"),
    );
  const [rows, setRows] = useState<
    Array<{ query: string; book?: Book; status: string }>
  >([]);
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const check = async () => {
    const needle = query.trim().toLocaleLowerCase("tr");
    if (!needle) return;
    const book = books.find((x) =>
      `${x.title} ${x.inventoryNo} ${x.isbn} ${x.category} ${x.genre} ${x.shelf}`
        .toLocaleLowerCase("tr")
        .includes(needle),
    );
    if (book) {
      setCheckedIds((current) => new Set(current).add(book.id));
      if (book.lost) await act("setBookLost", { id: book.id, lost: false }, "Kayıp görünen kitap bulundu ve yeniden ödünç verilebilir duruma alındı.");
    }
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
  const missingBooks = rows.length ? books.filter((book) => !book.lost && !checkedIds.has(book.id) && !active.some((loan) => loan.bookId === book.id)) : [];
  const lostBooks = books.filter((book) => book.lost);
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
        text="Kitapları kategori, tür ve yazar soyadının ilk harfinden oluşan raf bilgisine göre kontrol edin."
        action={<div className="actions"><button className="secondary" onClick={() => { setRows([]); setCheckedIds(new Set()); }}>Yeni sayım</button><button
            className="secondary"
            disabled={!rows.length}
            onClick={download}
          >
            Raporu indir
          </button></div>}
      />
      <div className="panel inventory-filters">
        <label>
          KATEGORİ
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">Tüm kategoriler</option>
            {categories.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>RAF<select value={shelfFilter} onChange={(e) => setShelfFilter(e.target.value)}><option value="">Tüm raflar</option>{shelves.map((x) => <option key={x}>{x}</option>)}</select></label>
        <div>
          <strong>{groupedBooks.length}</strong>
          <small>Seçili kategoride toplam</small>
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
              <th>Kategori</th>
              <th>Raf</th>
              <th>Yazar</th>
              <th>Kitap</th>
              <th>Rafta</th>
            </tr>
          </thead>
          <tbody>
            {groupedBooks.map((book) => (
              <tr key={book.id} className={checkedIds.has(book.id) ? "inventory-checked-row" : ""}>
                <td>{book.category || "Kategori belirtilmedi"}</td>
                <td>
                  <span className="shelf-letter">
                    {book.shelf || shelfLetter(book.author)}
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
                  if (e.key === "Enter") void check();
                }}
                placeholder="örn. DN-001 veya kitap adı"
              />
            </label>
            <button className="primary" onClick={() => void check()}>
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
                <th>Kategori</th>
                <th>Tür</th>
                <th>Raf</th>
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
                  <td>{x.book?.category || "—"}</td>
                  <td>{x.book?.genre || "—"}</td>
                  <td>{x.book ? x.book.shelf || shelfLetter(x.book.author) : "—"}</td>
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
      <div className="grid-2 inventory-results">{rows.length > 0 && <Card title={`Kontrol sonrası eksik kalanlar (${missingBooks.length})`}><div className="user-list">{missingBooks.map((book) => <span key={book.id}><span className="user-summary"><strong>{book.title || "Kitap adı boş"}</strong><small>{book.inventoryNo} · {book.author || "Yazar boş"} · Raf {book.shelf || "—"}</small></span><button className="danger compact" disabled={busy} onClick={() => void act("setBookLost", { id: book.id, lost: true }, "Kitap kaybedilenler listesine eklendi.")}>Kayıp</button></span>)}</div>{!missingBooks.length && <Empty text="Eksik kitap kalmadı." />}</Card>}<Card title={`Kaybedilenler (${lostBooks.length})`}><div className="user-list">{lostBooks.map((book) => <span key={book.id}><span className="user-summary"><strong>{book.title || "Kitap adı boş"}</strong><small>{book.inventoryNo} · {book.lostAt ? new Date(book.lostAt).toLocaleDateString("tr-TR") : ""}</small></span><button className="secondary compact" disabled={busy} onClick={() => void act("setBookLost", { id: book.id, lost: false }, "Kitap kayıp listesinden çıkarıldı ve ödünç vermeye açıldı.")}>Bulundu</button></span>)}</div>{!lostBooks.length && <Empty text="Kayıp kitap yok." />}</Card></div>
    </section>
  );
}

function AccountSecurity({
  currentUser,
  busy,
  act,
}: {
  currentUser: AppUser | null;
  busy: boolean;
  act: (a: string, p: Record<string, unknown>, s: string) => Promise<boolean>;
}) {
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", password: "", confirmPassword: "" });
  return (
    <section>
      <PageHead title="Hesabım" text="Giriş parolanızı güvenli biçimde oluşturun veya güncelleyin." />
      <div className="grid-2">
        <Card title="Kullanıcı Bilgileri">
          <div className="form-grid one">
            <p><strong>{currentUser?.displayName}</strong></p>
            <p className="muted">{currentUser?.role==='student'?currentUser.phone:currentUser?.email}</p>
            <span className="badge blue">{currentUser?.role === "admin" ? "Yönetici" : currentUser?.role === "staff" ? "Kütüphane sorumlusu" : "Öğrenci"}</span>
          </div>
        </Card>
        <Card title="Parola Oluştur / Güncelle">
          <form className="form-grid one" onSubmit={(event) => {
            event.preventDefault();
            if (passwordForm.password !== passwordForm.confirmPassword) return alert("Yeni parola ve tekrarı eşleşmiyor.");
            void act("setAdminPassword", { currentPassword: passwordForm.currentPassword, password: passwordForm.password }, currentUser?.passwordConfigured ? "Parolanız güncellendi." : "Parolanız oluşturuldu.");
          }}>
            <p className="muted">Parola en az 6 karakter olmalıdır ve güvenli özet olarak saklanır.</p>
            {currentUser?.passwordConfigured && <label>Mevcut parola<input type="password" autoComplete="current-password" required value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} /></label>}
            <label>Yeni parola<input type="password" autoComplete="new-password" minLength={6} required value={passwordForm.password} onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })} /></label>
            <label>Yeni parola tekrar<input type="password" autoComplete="new-password" minLength={6} required value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} /></label>
            <button className="primary" disabled={busy || passwordForm.password.length < 6}>{currentUser?.passwordConfigured ? "Parolayı güncelle" : "Parola oluştur"}</button>
          </form>
        </Card>
      </div>
    </section>
  );
}

function BarcodeMark({ value, height, fontSize }: { value: string; height: number; fontSize: number }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => { if (ref.current) JsBarcode(ref.current, value, { format: "CODE128", displayValue: false, margin: 0, height, width: 2 }); }, [value, height]);
  return <div className="code-mark"><svg ref={ref} aria-label={`Barkod ${value}`} /><strong style={{ fontSize }}>{value}</strong></div>;
}
function QrMark({ value, size, fontSize }: { value: string; size: number; fontSize: number }) {
  const [src, setSrc] = useState("");
  useEffect(() => { void QRCode.toDataURL(value, { width: size, margin: 1, errorCorrectionLevel: "M" }).then(setSrc); }, [value, size]);
  return <div className="code-mark">{src && <img src={src} width={size} height={size} alt={`QR kod ${value}`} />}<strong style={{ fontSize }}>{value}</strong></div>;
}
function BarcodeQrGenerator({ books }: { books: Book[] }) {
  const [kind, setKind] = useState("both"); const [length, setLength] = useState(8); const [quantity, setQuantity] = useState(24);
  const [rows, setRows] = useState(8); const [columns, setColumns] = useState(3); const [rowGap, setRowGap] = useState(2); const [columnGap, setColumnGap] = useState(2); const [margin, setMargin] = useState(6); const [size, setSize] = useState(70); const [fontSize, setFontSize] = useState(12); const [numbers, setNumbers] = useState<string[]>([]);
  const generate = () => {
    const reserved = new Set(books.flatMap(b => [b.inventoryNo.trim(), b.isbn.trim(), b.inventoryNo.replace(/\D/g,""), b.isbn.replace(/\D/g,"")]).filter(Boolean)); const made = new Set<string>();
    while (made.size < Math.min(500, Math.max(1, quantity))) { const bytes = new Uint32Array(1); crypto.getRandomValues(bytes); const min = 10 ** (length - 1); const value = String(min + (bytes[0] % (9 * min))); if (!reserved.has(value)) made.add(value); }
    setNumbers([...made]);
  };
  const perPage = Math.max(1, rows * columns); const pages = Array.from({ length: Math.ceil(numbers.length / perPage) }, (_, i) => numbers.slice(i * perPage, (i + 1) * perPage));
  const print = () => { const content = document.querySelector(".label-pages")?.innerHTML; if (!content) return; const popup = window.open("", "_blank"); if (!popup) return alert("Yazdırma penceresine izin verin."); popup.document.write(`<html><head><title>Barkod ve QR Etiketleri</title><style>@page{size:A4;margin:${margin}mm}body{margin:0;font-family:Arial}.page{width:${210-margin*2}mm;height:${297-margin*2}mm;display:grid;grid-template-columns:repeat(${columns},1fr);grid-template-rows:repeat(${rows},1fr);gap:${rowGap}mm ${columnGap}mm;page-break-after:always}.label{display:flex;align-items:center;justify-content:center;gap:4mm;overflow:hidden;border:1px dashed #bbb;padding:2mm;box-sizing:border-box}.code-mark{display:flex;flex-direction:column;align-items:center;max-width:100%;overflow:hidden}.code-mark svg{max-width:100%;height:auto}.code-mark strong{white-space:nowrap}.code-mark img{max-width:100%;height:auto}</style></head><body>${content}</body></html>`); popup.document.close(); setTimeout(()=>popup.print(),400); };
  return <div className="barcode-builder"><div className="barcode-controls form-grid three"><label>Kod türü<select value={kind} onChange={e=>setKind(e.target.value)}><option value="both">Barkod + QR</option><option value="barcode">Yalnız barkod</option><option value="qr">Yalnız QR</option></select></label><label>Numara hanesi (6–11)<input type="number" min="6" max="11" value={length} onChange={e=>setLength(Math.min(11,Math.max(6,Number(e.target.value))))}/></label><label>Oluşturulacak numara<input type="number" min="1" max="500" value={quantity} onChange={e=>setQuantity(Number(e.target.value))}/></label><label>A4 satır sayısı<input type="number" min="1" max="20" value={rows} onChange={e=>setRows(Math.min(20,Math.max(1,Number(e.target.value))))}/></label><label>A4 sütun sayısı<input type="number" min="1" max="6" value={columns} onChange={e=>setColumns(Number(e.target.value))}/></label><label>Kâğıt kenar boşluğu (mm)<input type="number" min="0" max="25" value={margin} onChange={e=>setMargin(Number(e.target.value))}/></label><label>Satır aralığı (mm)<input type="number" min="0" max="20" value={rowGap} onChange={e=>setRowGap(Number(e.target.value))}/></label><label>Sütun aralığı (mm)<input type="number" min="0" max="20" value={columnGap} onChange={e=>setColumnGap(Number(e.target.value))}/></label><label>Kod boyutu<input type="range" min="35" max="120" value={size} onChange={e=>setSize(Number(e.target.value))}/></label><label>Numara yazı boyutu<input type="range" min="8" max="20" value={fontSize} onChange={e=>setFontSize(Number(e.target.value))}/></label></div><p className="muted">Sayfa başına {perPage} etiket · {numbers.length ? pages.length : Math.ceil(quantity/perPage)} A4. Üretilen numaralar kayıtlı DN ve ISBN değerleriyle çakışmaz.</p><div className="actions"><button className="primary" onClick={generate}>Numaraları oluştur</button><button className="secondary" disabled={!numbers.length} onClick={print}>A4 yazdır / PDF</button></div><div className="label-preview"><div className="label-pages">{pages.map((page,p)=><div className="page" key={p} style={{gridTemplateColumns:`repeat(${columns},1fr)`,gridTemplateRows:`repeat(${rows},1fr)`,gap:`${rowGap}mm ${columnGap}mm`,padding:`${margin}mm`}}>{page.map(value=><div className="label" key={value}>{kind!=="qr"&&<BarcodeMark value={value} height={Math.round(size*.55)} fontSize={fontSize}/>} {kind!=="barcode"&&<QrMark value={value} size={size} fontSize={fontSize}/>}</div>)}</div>)}</div>{!numbers.length&&<Empty text="Ayarları seçip numaraları oluşturduğunuzda A4 ön izlemesi burada görünür."/>}</div></div>;
}

function SpineLabelGenerator({ books }: { books: Book[] }) {
  const [textRows, setTextRows] = useState(3);
  const [labelRows, setLabelRows] = useState(7);
  const capacity = labelRows * 14;
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Book[]>([]);
  const [rowHeights, setRowHeights] = useState([31.5, 15.75, 30]);
  const [columnWidths, setColumnWidths] = useState(Array(14).fill(9.7109375) as number[]);
  const normalize = (value: string) => value.trim().toLocaleUpperCase("tr");
  const surname = (author: string) => author.trim().split(/\s+/).at(-1) || "";
  const labelParts = (book: Book) => {
    const last = surname(book.author).toLocaleUpperCase("tr");
    return [last.slice(0, 1), book.dewey || "—", last.slice(0, 3), book.title, book.inventoryNo, book.category, book.author, book.publisher, book.isbn, book.shelf].slice(0, textRows);
  };
  const matched = books.find((book) => [book.inventoryNo, book.isbn, `${book.inventoryNo} · ${book.title}`].some((value) => value && normalize(value) === normalize(query)));
  const add = () => {
    if (!matched) return alert("Bu ID / DN veya ISBN ile kayıtlı kitap bulunamadı.");
    if (selected.some((book) => book.id === matched.id)) return alert("Bu kitap sırt etiketi listesine zaten eklendi.");
    if (selected.length >= capacity) return alert(`Seçili satır sayısına en fazla ${capacity} etiket sığar.`);
    setSelected((current) => [...current, matched]);
    setQuery("");
  };
  const download = async () => {
    if (!selected.length) return;
    const response = await fetch("/KUTUPHANE-SIRT-ETIKETI.xlsx");
    if (!response.ok) return alert("Sırt etiketi şablonu açılamadı.");
    const XLSX=await import("xlsx");
    const workbook = XLSX.read(await response.arrayBuffer(), { type: "array", cellStyles: true });
    const originalName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[originalName] as WorkSheet & { "!rows"?: Array<{ hpt?: number }>; "!cols"?: Array<{ wch?: number }> };
    workbook.SheetNames.slice(1).forEach((name) => { delete workbook.Sheets[name]; });
    workbook.SheetNames = [originalName];
    workbook.SheetNames[0] = "Sırt Etiketleri";
    workbook.Sheets["Sırt Etiketleri"] = sheet;
    delete workbook.Sheets[originalName];
    const templateCells = { ...sheet };
    for (let r = 0; r < 110; r++) for (let c = 0; c < 14; c++) delete sheet[XLSX.utils.encode_cell({ r, c })];
    for (let index = 0; index < capacity; index += 1) {
      const group = Math.floor(index / 14);
      const column = index % 14;
      const book = index < capacity ? selected[index] : undefined;
      const values = book ? labelParts(book) : Array(textRows).fill("");
      values.forEach((value, offset) => {
        const address = XLSX.utils.encode_cell({ r: group * (textRows + 1) + offset, c: column });
        const previous = templateCells[XLSX.utils.encode_cell({ r: Math.min(offset, 2), c: column })] || {};
        sheet[address] = { ...previous, t: "s", v: value };
        delete sheet[address].f;
      });
    }
    sheet["!rows"] = [];
    sheet["!merges"] = [];
    for (let group = 0; group < labelRows; group += 1) rowHeights.slice(0, textRows).forEach((height, offset) => { sheet["!rows"]![group * (textRows + 1) + offset] = { ...(sheet["!rows"]![group * (textRows + 1) + offset] || {}), hpt: height }; });
    sheet["!cols"] = columnWidths.map((width, index) => ({ ...(sheet["!cols"]?.[index] || {}), wch: width }));
    sheet["!ref"] = `A1:N${labelRows * (textRows + 1) - 1}`;
    XLSX.writeFile(workbook, "kutuphane-sirt-etiketleri.xlsx", { cellStyles: true });
  };
  return <div className="spine-builder">
    <label>Etiket satır sayısı (1–10)<input type="number" min="1" max="10" value={labelRows} onChange={(event) => { const next = Math.min(10, Math.max(1, Math.trunc(Number(event.target.value)) || 1)); if (selected.length > next * 14) return alert("Eklenen etiketleri korumak için önce fazla etiketleri listeden kaldırın."); setLabelRows(next); }} /></label><p className="muted">{labelRows} satır × 14 sütun = {capacity} etiket. 10 satırda etiket boyuna göre birden fazla baskı sayfası gerekebilir.</p><div className="form-grid three"><label>ID / DN veya ISBN<input list="spine-book-options" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder="Numarayı girin veya kitabı seçin" /><datalist id="spine-book-options">{books.map((book) => <option key={book.id} value={`${book.inventoryNo} · ${book.title}`} />)}</datalist></label><button className="primary" onClick={add}>Ekle</button><button className="secondary" disabled={!selected.length} onClick={() => void download()}>Excel dosyasını indir</button></div>
    <label>Etiket içindeki bilgi satırı (3–10)<input type="number" min="3" max="10" value={textRows} onChange={(event) => { const count = Math.min(10, Math.max(3, Math.trunc(Number(event.target.value)) || 3)); setTextRows(count); setRowHeights((current) => Array.from({ length: count }, (_, index) => current[index] ?? 15.75)); }} /></label><p className="muted">İlk üç satır: yazar baş harfi, Dewey ve yazar kodu. Ek satırlar: kitap adı, DN, kategori, yazar, yayınevi, ISBN ve raf.</p><div className="spine-size-controls"><fieldset><legend>Satır yükseklikleri</legend>{rowHeights.map((height, index) => <label key={index}>{index + 1}. satır<input type="number" min="8" max="80" step="0.25" value={height} onChange={(e) => setRowHeights((current) => current.map((value, position) => position === index ? Number(e.target.value) : value))} /></label>)}</fieldset><fieldset><legend>Sütun genişlikleri</legend>{columnWidths.map((width, index) => <label key={index}>{String.fromCharCode(65+index)}<input type="number" min="3" max="30" step="0.1" value={width} onChange={(e) => setColumnWidths((current) => current.map((value, position) => position === index ? Number(e.target.value) : value))} /></label>)}</fieldset></div>
    <div className="spine-preview" style={{ gridTemplateColumns: `repeat(14, minmax(${Math.max(46, columnWidths[0] * 7)}px, 1fr))` }}>{selected.map((book) => { const parts = labelParts(book); return <article key={book.id} title={`${book.inventoryNo} · ${book.title}`}>{parts.map((value, index) => <span key={index} style={{ minHeight: rowHeights[index], display: "block", overflowWrap: "anywhere" }}>{value}</span>)}<button aria-label={`${book.title} etiketini kaldır`} onClick={() => setSelected((current) => current.filter((item) => item.id !== book.id))}>×</button></article>; })}{!selected.length && <p className="empty">Eklenen etiketler burada ön izlenir.</p>}</div>
  </div>;
}

function Settings({
  config,
  students,
  books,
  users,
  currentUser,
  canManageSubscription,
  membershipRequests,
  empty,
  busy,
  act,
}: {
  config: Data["settings"];
  students: Student[];
  books: Book[];
  users: AppUser[];
  currentUser: AppUser | null;
  canManageSubscription: boolean;
  membershipRequests: MembershipRequest[];
  empty: boolean;
  busy: boolean;
  act: (a: string, p: Record<string, unknown>, s: string) => Promise<boolean>;
}) {
  const [form, setForm] = useState({ ...config, uiFont: config.uiFont === "Inter" ? "Arial" : config.uiFont });
  const [settingsModule, setSettingsModule] = useState<
    "account" | "institution" | "users" | "circulation" | "communication" | "appearance" | "data" | "schools" | "catalog" | "labels" | "spine"
  >("institution");
  const [managedSchools, setManagedSchools] = useState<ManagedSchool[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const [schoolsError, setSchoolsError] = useState("");
  const [graduate, setGraduate] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [catalogFilter, setCatalogFilter] = useState({ category: "", genre: "", shelf: "", author: "" });
  const categories = [...new Set(books.map((book) => book.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr"));
  const genres = [...new Set([...form.bookGenres.split(",").map((value) => value.trim()).filter(Boolean), ...books.map((book) => book.genre).filter(Boolean)])].sort((a, b) => a.localeCompare(b, "tr"));
  const shelves = [...new Set(books.map((book) => book.shelf).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr"));
  const authors = [...new Set(books.map((book) => book.author).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr"));
  const [userForm, setUserForm] = useState({
    id: 0,
    username: "",
    displayName: "",
    email: "",
    phone: "",
    password: "",
    role: "student",
    studentId: "",
    permissions: [] as string[],
    active: true,
  });
  const staffModules = [
    ["circulation", "Ödünç / İade"], ["books", "Kitaplar"], ["students", "Öğrenciler"],
    ["overdue", "Geç Kalanlar"], ["inventory", "Kitap Sayımı"], ["reports", "Raporlar"],
    ["requests", "Kitap Talepleri"],
  ];
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    password: "",
    confirmPassword: "",
  });
  const ownUser = users.find((user) => user.id === currentUser?.id);
  const loadManagedSchools = useCallback(async () => {
    if (!canManageSubscription) return;
    setSchoolsLoading(true);
    setSchoolsError("");
    try {
      const response = await fetch("/api/platform", { cache: "no-store" });
      const result = await response.json() as { schools?: ManagedSchool[]; error?: string };
      if (!response.ok) throw new Error(result.error || "Okullar yüklenemedi.");
      setManagedSchools(result.schools || []);
    } catch (error) {
      setSchoolsError(error instanceof Error ? error.message : "Okullar yüklenemedi.");
    } finally {
      setSchoolsLoading(false);
    }
  }, [canManageSubscription]);
  const setSchoolPremium = async (school: ManagedSchool, enabled: boolean) => {
    setSchoolsLoading(true);
    setSchoolsError("");
    try {
      const response = await fetch("/api/platform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setPremium", id: school.id, enabled }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Premium erişim güncellenemedi.");
      await loadManagedSchools();
    } catch (error) {
      setSchoolsError(error instanceof Error ? error.message : "Premium erişim güncellenemedi.");
      setSchoolsLoading(false);
    }
  };
  const grades = [...new Set(students.map((x) => x.grade))].sort((a, b) =>
    a.localeCompare(b, "tr", { numeric: true }),
  );
  const themes = [
    { id: "forest", name: "Orman", hint: "Georgia + Arial" },
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
  const colorOptions = ["#17211b", "#000000", "#334155", "#1e3a5f", "#163b2d", "#1d6649", "#087aa5", "#168579", "#5551a4", "#754a71", "#9b3348", "#b45309", "#f4f6f2", "#ffffff", "#f1f8fb", "#eef6f1", "#f8f4ec", "#faf4f5", "#f6f5fb", "#fbf6f8"];
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
  const changeDashboard = async (file: File) => {
    try {
      await uploadImage(file, "dashboard", "overview");
      await act("noop", {}, "Genel Bakış görseli güncellendi.");
    } catch (error) { alert(error instanceof Error ? error.message : "Görsel yüklenemedi."); }
  };
  return (
    <section>
      <PageHead
        title="Kütüphane Ayarları"
        text="Kurum bilgilerini, görünümü ve ödünç kurallarını düzenleyin."
      />
      <div className="settings-tabs" role="tablist" aria-label="Ayar modülleri">
        {[
          ["account", "Hesabım", "♙"],
          ["institution", "Kurum ve Logo", "⌂"],
          ["users", "Kullanıcılar", "◉"],
          ["circulation", "Ödünç Kuralları", "⇄"],

          ["catalog", "Kitap Ayarları", "▤"],
          ["labels", "Barkod ve QR", "▦"],
          ["spine", "Sırt Etiketi", "▥"],
          ["appearance", "Görünüm", "✦"],
          ["data", "Veri ve Dönem", "▤"],
          ...(canManageSubscription ? [["schools", "Okul Yönetimi", "▦"]] : []),
        ].map(([id, label, icon]) => (
          <button
            key={id}
            role="tab"
            aria-selected={settingsModule === id}
            className={settingsModule === id ? "active" : ""}
            onClick={() => {
              setSettingsModule(id as typeof settingsModule);
              if (id === "schools") void loadManagedSchools();
            }}
          >
            <span>{icon}</span>{label}
          </button>
        ))}
      </div>
      {settingsModule==="account"&&<AccountSecurity currentUser={currentUser} busy={busy} act={act}/>}
      <div className="grid-2 settings-content">
        <Card title="Yeni barkod ve QR numara oluştur" visible={settingsModule === "labels"}><BarcodeQrGenerator books={books} /></Card>
        <Card title="Sırt Etiketi" visible={settingsModule === "spine"}><SpineLabelGenerator books={books} /></Card>
        <Card title="Genel Ayarlar" visible={settingsModule === "institution"}>
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
        <div className="settings-stack" hidden={settingsModule !== "institution"}>
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
        {canManageSubscription && <Card title="Abonelik Bilgileri">
          <div className="form-grid one"><p className="muted">Bu bilgiler yalnızca fsaygif@gmail.com hesabına görünür.</p><label>IBAN<input value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} placeholder="TR00 0000 0000 0000 0000 0000 00" /></label><label>365 günlük üyelik ücreti (₺)<input type="number" min="0" value={form.membershipFee} onChange={(e) => setForm({ ...form, membershipFee: Number(e.target.value) })} /></label><button className="primary" disabled={busy} onClick={() => act("settings", form, "Abonelik bilgileri kaydedildi.")}>Abonelik bilgilerini kaydet</button></div>
        </Card>}
        </div>
        <Card title="Genel Bakış Görseli" visible={settingsModule === "institution"}>
          <div className="logo-settings">
            <img className="dashboard-image-preview" src={config.dashboardImageKey ? mediaUrl(config.dashboardImageKey) : "/reading-hero.png"} alt="Genel Bakış görseli" />
            <div><p className="muted">Görsel oranı bozulmadan ve kırpılmadan gösterilir. JPG, PNG veya WebP yükleyebilirsiniz.</p><label className="import-btn">Görsel seç<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const file = e.target.files?.[0]; if (file) void changeDashboard(file); e.target.value = ""; }} /></label></div>
          </div>
        </Card>
        {canManageSubscription && <Card title={`Süper Admin Okul Yönetimi (${managedSchools.length})`} visible={settingsModule === "schools"}>
          <div className="school-management-head">
            <p className="muted">Sistemdeki tüm okulların deneme ve abonelik durumlarını yönetin. Premium açıldığında erişim 365 gün süreyle etkinleştirilir.</p>
            <button className="secondary small" disabled={schoolsLoading} onClick={() => void loadManagedSchools()}>Listeyi yenile</button>
          </div>
          {schoolsError && <p className="login-error">{schoolsError}</p>}
          <div className="managed-school-list">
            {managedSchools.map((school) => (
              <article key={school.id}>
                <div className="managed-school-main">
                  <strong>{school.name}</strong>
                  <small>{school.city} / {school.district} · Kurum kodu: {school.institutionCode}</small>
                  <small>Kayıt: {new Date(school.createdAt).toLocaleDateString("tr-TR")}</small>
                </div>
                <div className="managed-school-access">
                  <span className={`badge ${school.exempt || school.premium ? "green" : school.trial ? "blue" : "red"}`}>
                    {school.statusLabel}{school.remainingDays !== null ? ` · ${school.remainingDays} gün kaldı` : ""}
                  </span>
                  <label className="premium-switch">
                    <span>365 gün premium</span>
                    <input type="checkbox" role="switch" aria-label={`${school.name} için 365 günlük premium erişim`} checked={school.premium} disabled={schoolsLoading} onChange={(event) => void setSchoolPremium(school, event.target.checked)} />
                  </label>
                </div>
              </article>
            ))}
            {!schoolsLoading && !managedSchools.length && !schoolsError && <p className="empty">Kayıtlı okul bulunamadı.</p>}
            {schoolsLoading && !managedSchools.length && <p className="empty">Okullar yükleniyor…</p>}
          </div>
        </Card>}
        <Card title="Süre Uzatma ve Gecikme" visible={settingsModule === "circulation"}>
          <div className="form-grid one">
            <label>
              Bir öğrencinin aynı anda alabileceği en fazla kitap
              <input
                type="number"
                min="1"
                max="20"
                value={form.maxBooksPerStudent}
                onChange={(e) => setForm({ ...form, maxBooksPerStudent: Number(e.target.value) })}
              />
            </label>
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
        <Card title="Kullanıcı ve Yetki Yönetimi" visible={settingsModule === "users"}>
          <div className="form-grid one">
            <label>
              Kullanıcı adı
              <input autoComplete="off" value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value.toLocaleLowerCase("tr").replace(/\s+/g, "") })} />
            </label>
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
              Geçici parola / yeni parola
              <input type="password" autoComplete="new-password" minLength={6} value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} placeholder="En az 6 karakter" />
            </label>
            {userForm.role!=="student"&&<>
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
            </>}
            <label>
              Cep telefonu
              <input type="tel" inputMode="tel" value={userForm.phone} onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })} placeholder="05xx xxx xx xx" />
            </label>
            <label>
              Yetki
              <select
                value={userForm.role}
                onChange={(e) =>
                  setUserForm({ ...userForm, role: e.target.value, permissions: e.target.value === "staff" && !userForm.permissions.length ? ["circulation", "books", "students", "overdue", "inventory", "reports", "requests"] : e.target.value === "staff" ? userForm.permissions : [] })
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
                  onChange={(e) => {
                    const student = students.find((item) => String(item.id) === e.target.value);
                    setUserForm({ ...userForm, studentId: e.target.value, phone: student?.contact || userForm.phone });
                  }}
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
            {userForm.role === "staff" && (
              <fieldset className="permission-grid">
                <legend>Kullanabileceği modüller</legend>
                {staffModules.map(([id, label]) => (
                  <label key={id} className="permission-option">
                    <input type="checkbox" checked={userForm.permissions.includes(id)} onChange={() => setUserForm({ ...userForm, permissions: userForm.permissions.includes(id) ? userForm.permissions.filter((value) => value !== id) : [...userForm.permissions, id] })} />
                    {label}
                  </label>
                ))}
              </fieldset>
            )}
            <label className="permission-option"><input type="checkbox" checked={userForm.active} onChange={(e) => setUserForm({ ...userForm, active: e.target.checked })} /> Hesap etkin</label>
            <button
              className="primary"
              disabled={busy || !userForm.username || (userForm.role!=="student"&&!userForm.email) || !userForm.displayName || (userForm.password.length > 0 && userForm.password.length < 6)}
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
                  <span className="user-summary">
                    <strong>{user.displayName}</strong>
                    <small>@{user.username || user.email}{user.role!=="student"?` · ${user.email}`:""}{user.phone ? ` · ${user.phone}` : ""} · {user.role}{user.role === "staff" && user.permissions.length ? ` · ${user.permissions.join(", ")}` : ""}</small>
                  </span>
                  <button className="small" disabled={busy} onClick={() => setUserForm({ id:user.id, username: user.username || "", displayName: user.displayName, email: user.email, phone: user.phone || "", password: "", role: user.role, studentId: user.studentId ? String(user.studentId) : "", permissions: user.permissions || [], active: Boolean(user.active) })}>Düzenle</button>
                  {user.role!=="admin"&&<button className="small" disabled={busy||user.id===currentUser?.id} onClick={()=>{if(confirm(`${user.displayName} hesabının giriş üyeliği sıfırlansın mı? Öğrenci, kitap, ödünç ve sayım kayıtları korunur; öğrenci yeniden başvurabilir.`))void act("resetMembership",{id:user.id},"Giriş üyeliği sıfırlandı; kütüphane kayıtları korundu.");}}>Üyeliği sıfırla</button>}
                  <button
                    className="danger compact"
                    disabled={busy || user.id === currentUser?.id}
                    title={user.id === currentUser?.id ? "Açık olan hesap silinemez" : "Kullanıcıyı sil"}
                    onClick={() =>
                      confirm(`${user.displayName} kullanıcısı kalıcı olarak silinsin mi?`) &&
                      act("deleteUser", { id: user.id }, "Kullanıcı silindi.")
                    }
                  >
                    Sil
                  </button>
                </span>
              ))}
            </div>
            <p className="muted">
              Yeni hesap için en az 6 karakterlik geçici parola belirleyin. Bir kullanıcıda Düzenle seçeneğini açıp yeni parola girerek giriş bilgilerini güncelleyebilirsiniz.
            </p>
          </div>
        </Card>
        <div className="settings-stack" hidden={settingsModule !== "users"}>
        <Card title="Yönetici Parolası">
          <form
            className="form-grid one"
            onSubmit={(event) => {
              event.preventDefault();
              if (passwordForm.password !== passwordForm.confirmPassword) {
                alert("Yeni parola ve tekrarı eşleşmiyor.");
                return;
              }
              void act(
                "setAdminPassword",
                {
                  currentPassword: passwordForm.currentPassword,
                  password: passwordForm.password,
                },
                ownUser?.passwordConfigured
                  ? "Yönetici parolası güncellendi."
                  : "Yönetici parolası oluşturuldu.",
              ).then(() =>
                setPasswordForm({ currentPassword: "", password: "", confirmPassword: "" }),
              );
            }}
          >
            <p className="muted password-status">
              <span className={`badge ${ownUser?.passwordConfigured ? "green" : "red"}`}>
                {ownUser?.passwordConfigured ? "Parola oluşturuldu" : "Parola oluşturulmadı"}
              </span>
              Parolanız yalnızca güvenli özet olarak saklanır ve en az 6 karakter olmalıdır.
            </p>
            {ownUser?.passwordConfigured && (
              <label>
                Mevcut parola
                <input
                  type="password"
                  autoComplete="current-password"
                  value={passwordForm.currentPassword}
                  onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })}
                  required
                />
              </label>
            )}
            <label>
              Yeni parola
              <input
                type="password"
                autoComplete="new-password"
                minLength={6}
                value={passwordForm.password}
                onChange={(event) => setPasswordForm({ ...passwordForm, password: event.target.value })}
                required
              />
            </label>
            <label>
              Yeni parola tekrar
              <input
                type="password"
                autoComplete="new-password"
                minLength={6}
                value={passwordForm.confirmPassword}
                onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })}
                required
              />
            </label>
            <button className="primary" disabled={busy || passwordForm.password.length < 6}>
              {ownUser?.passwordConfigured ? "Parolayı güncelle" : "Parola oluştur"}
            </button>
          </form>
        </Card>
        <Card title={`Öğrenci Üyelik Başvuruları (${membershipRequests.filter((x) => x.status === "pending").length})`}>
          <div className="approval-list">
            {membershipRequests.filter((x) => x.status === "pending").map((row) => (
              <article key={row.id}>
                <div><strong>{row.fullName}</strong><small>{row.grade} · No {row.studentNo} · {row.phone}</small><small>{row.city} / {row.district} · {row.schoolName}</small></div>
                <div className="actions"><button className="small" disabled={busy} onClick={() => act("rejectMembership", { id: row.id }, "Başvuru reddedildi.")}>Reddet</button><button className="primary small" disabled={busy} onClick={() => act("approveMembership", { id: row.id }, "Öğrenci hesabı onaylandı.")}>Onayla</button></div>
              </article>
            ))}
            {!membershipRequests.some((x) => x.status === "pending") && <p className="empty">Bekleyen üyelik başvurusu yok.</p>}
          </div>
        </Card>
        </div>
        <Card title="Arayüz Rengi ve Yazı Tipi" visible={settingsModule === "appearance"}>
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
          <div className="form-grid two appearance-controls"><label>Panel yazı tipi<select value={form.uiFont} onChange={(e) => setForm({ ...form, uiFont: e.target.value })}>{["Arial", "Verdana", "Tahoma", "Segoe UI", "Trebuchet MS", "Calibri", "Century Gothic", "Palatino Linotype", "Book Antiqua", "Courier New"].map((font) => <option key={font}>{font}</option>)}</select></label><label>Başlık yazı tipi<select value={form.titleFont} onChange={(e) => setForm({ ...form, titleFont: e.target.value })}>{["Georgia", "Garamond", "Cambria", "Arial", "Verdana", "Trebuchet MS"].map((font) => <option key={font}>{font}</option>)}</select></label><label>Temel yazı boyutu: {form.baseFontSize}px<input type="range" min="11" max="22" value={form.baseFontSize} onChange={(e) => setForm({ ...form, baseFontSize: Number(e.target.value) })} /></label><ColorChoice label="Yazı rengi" value={form.textColor} colors={colorOptions} onChange={(textColor) => setForm({ ...form, textColor })} /><ColorChoice label="Arayüz vurgu rengi" value={form.accentColor} colors={colorOptions} onChange={(accentColor) => setForm({ ...form, accentColor })} /><ColorChoice label="Arayüz arka planı" value={form.surfaceColor} colors={colorOptions} onChange={(surfaceColor) => setForm({ ...form, surfaceColor })} /><button className="primary" disabled={busy} onClick={() => act("settings", form, "Yazı tipi, boyut ve renk ayarları kaydedildi.")}>Görünümü kaydet</button></div>
        </Card>
        <Card title="Kitap Türleri Tanımlama" visible={settingsModule === "catalog"}><div className="form-grid one"><label>Kitap türleri (virgülle ayırın)<textarea value={form.bookGenres} onChange={(e) => setForm({ ...form, bookGenres: e.target.value.toLocaleUpperCase("tr") })} placeholder="ROMAN, HİKAYE, ŞİİR" /></label><button className="primary" disabled={busy} onClick={() => act("settings", form, "Kitap türleri kaydedildi ve düzenleme menüsüne eklendi.")}>Türleri kaydet</button></div></Card>
        <Card title="Kitapları Toplu Sil" visible={settingsModule === "catalog"}><div className="form-grid one"><p className="muted">Kategori, tür, raf ve yazar filtreleri birlikte çalışır. Ödünçteki ve sayımı yapılmış kitaplar bu işlemden korunur. Kayıtlar kalıcı silinmez; yalnızca uygun kitaplar envanterden çıkarılır.</p><label>Kategori<select value={catalogFilter.category} onChange={(e) => setCatalogFilter({ ...catalogFilter, category: e.target.value })}><option value="">Seçin…</option>{categories.map((value) => <option key={value}>{value}</option>)}</select></label><label>Tür<select value={catalogFilter.genre} onChange={(e) => setCatalogFilter({ ...catalogFilter, genre: e.target.value })}><option value="">Seçin…</option>{genres.map((value) => <option key={value}>{value}</option>)}</select></label><label>Raf<select value={catalogFilter.shelf} onChange={(e) => setCatalogFilter({ ...catalogFilter, shelf: e.target.value })}><option value="">Seçin…</option>{shelves.map((value) => <option key={value}>{value}</option>)}</select></label><label>Yazar<select value={catalogFilter.author} onChange={(e) => setCatalogFilter({ ...catalogFilter, author: e.target.value })}><option value="">Seçin…</option>{authors.map((value) => <option key={value}>{value}</option>)}</select></label><label>Yönetici parolanız<input type="password" autoComplete="current-password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} /></label><button className="danger" disabled={busy || !deletePassword || !Object.values(catalogFilter).some(Boolean)} onClick={async () => { if (!confirm("Ödünçteki ve sayımı yapılmış kitaplar korunacak. Diğer eşleşen kitaplar envanterden çıkarılsın mı?")) return; try { await act("bulkDeleteBooks", { ...catalogFilter, adminPassword: deletePassword }, "Uygun kitaplar envanterden çıkarıldı; ödünç ve sayım kayıtları korundu."); } finally { setDeletePassword(""); } }}>Filtreye göre toplu sil</button></div></Card>
        <Card title="Öğretim Yılı İşlemleri" visible={settingsModule === "data"}>
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
              Seçili sınıfı sil
            </button>
          </div>
        </Card>
        <Card title="Başlangıç Verileri" visible={settingsModule === "data"}>
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
        <Card title="Programın Son Sürümü" visible={settingsModule === "data"}>
          <div className="form-grid one"><p className="muted">Programın güncel kaynak kodunu, veritabanı migrasyonlarını, altyapı ve erişim rehberini indirin. Güvenlik için gerçek parolalar ve kişisel veriler bu pakete dahil değildir.</p><a className="primary download-link" href="/downloads/kutuphane-guncel.zip" download>Son sürüm ZIP dosyasını indir</a></div>
        </Card>
      </div>
    </section>
  );
}

function BookForm({
  initial,
  submit,
  onDelete,
  genreOptions,
}: {
  initial: Book | null;
  submit: (p: Record<string, unknown>) => Promise<void>;
  onDelete?: () => Promise<void>;
  genreOptions: string[];
}) {
  const [saving, setSaving] = useState(false);
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
          loanable: true,
        },
  );
  return (
    <form
      id="book-edit-panel"
      className="panel form-grid"
      onSubmit={async (e) => {
        e.preventDefault();
        if (saving) return;
        setSaving(true);
        try { await submit(f); } finally { setSaving(false); }
      }}
    >
      {Object.entries({
        inventoryNo: "Demirbaş No *",
        isbn: "ISBN",
        title: "Kitap Adı",
        author: "Yazar",
        publisher: "Yayınevi",
        category: "Kategori",
        genre: "Tür",
        shelf: "Raf (Yazar soyadının ilk harfi)",
        dewey: "Dewey Kodu",
        pages: "Sayfa Sayısı",
      }).map(([key, label]) => (
        <label key={key}>
          {label}
          <input
            type={key === "pages" ? "number" : "text"}
            list={key === "genre" ? "genre-options" : key === "category" ? "category-options" : undefined}
            value={String(f[key as keyof typeof f] ?? "")}
            onChange={(e) => setF({ ...f, [key]: e.target.value })}
          />
        </label>
      ))}
      <datalist id="genre-options">
        {genreOptions.map((genre) => <option key={genre} value={genre} />)}
      </datalist>
      <datalist id="category-options">
        <option value="İNGİLİZ EDEBİYATI" />
        <option value="FRANSIZ EDEBİYATI" />
        <option value="DENEME MAKALE" />
        <option value="TÜRK ROMAN HİKAYE" />
      </datalist>
      <div className="form-actions">
        <label className="permission-option book-loanable"><input type="checkbox" checked={!Boolean(f.loanable)} onChange={(e) => setF({ ...f, loanable: !e.target.checked })} /> Ödünç Verilmez</label>
        {onDelete && (
          <button
            type="button"
            className="danger"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try { await onDelete(); } finally { setSaving(false); }
            }}
          >
            Kaydı sil
          </button>
        )}
        <button className={`primary ${initial ? "keep-button-size" : ""}`} disabled={saving}>
          {initial ? "Değişiklikleri kaydet" : "Kitabı kaydet"}
        </button>
      </div>
    </form>
  );
}
function StudentForm({
  memberType="student",
  busy,
  initial,
  submit,
  onDelete,
}: {
  memberType?: Student["memberType"];
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
          grade: displayGrade(initial.grade),
          contact: initial.contact,
          ...(initial.memberType!=="student"?{email:initial.email}:{}),
          branch: initial.branch||"",
          memberType: initial.memberType,
          blocked: Boolean(initial.blocked),
          blockReason: initial.blockReason,
        }
      : {
          studentNo: "",
          fullName: "",
          grade: "",
          contact: "",
          branch: "",
          memberType,
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
        branch: "Branşı",
      }).filter(([key])=>f.memberType==="student"?key!=="branch":!["studentNo","grade"].includes(key)).map(([key, label]) => (
        <label key={key}>
          {label}
          <input
            type={key === "email" ? "email" : "text"}
            value={String(f[key as keyof typeof f])}
            required={key==="fullName"||(f.memberType==="student"&&["studentNo","grade"].includes(key))}
            onChange={(e) => setF({ ...f, [key]: key === "grade" ? displayGrade(normalizeGrade(e.target.value)) : e.target.value })}
          />
        </label>
      ))}

      <label>Üye türü<select value={f.memberType} onChange={(e) => setF({ ...f, memberType: e.target.value as Student["memberType"] })}><option value="student">Öğrenci</option><option value="teacher">Öğretmen</option><option value="employee">Diğer çalışan</option></select></label>
      <label className="check-label"><input type="checkbox" checked={f.blocked} onChange={(e) => setF({ ...f, blocked: e.target.checked })} />Bu üyeye kitap verilmesin</label>
      {f.blocked && <label>Engel nedeni<select value={f.blockReason} onChange={(e) => setF({ ...f, blockReason: e.target.value })}><option value="">Neden seçin…</option><option>Çok geç iade</option><option>Kitaba zarar verme</option><option>Uygunsuz davranış</option><option>Ödenmemiş gecikme bedeli</option><option>Yönetici kararı</option></select></label>}
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
        <button className={`primary ${initial ? "keep-button-size" : ""}`} disabled={busy}>
          {initial ? "Değişiklikleri kaydet" : "Üyeyi kaydet"}
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
        onClick={(event) => {event.stopPropagation(); if(src)setLarge(true);}}
        aria-label={src ? `${alt} büyüt` : alt}
      >
        {src ? <img loading="lazy" decoding="async" src={src} alt={alt} /> : <span>{fallback}</span>}
      </button>
      {large && (
        <div
          className="image-modal"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {event.stopPropagation();setLarge(false);}}
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
  showPhotos = false,
  onSelectMember,
  onReturn,
  onRenew,
  onSameDay,
  busy,
}: {
  rows: Loan[];
  showReturn: boolean;
  showPhotos?: boolean;
  onSelectMember?: (loan: Loan) => void;
  onReturn?: (id: number) => void;
  onRenew?: (id: number) => void;
  onSameDay?: (id: number) => void;
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
                {showPhotos && <CirculationPhoto imageKey={x.studentPhotoKey} name={x.studentName} kind="member" />}
                <strong>{x.studentName}</strong>
                <small>{x.grade}</small>
                {onSelectMember && <button className="small" disabled={busy} onClick={() => onSelectMember(x)}>Üzerindeki kitapları göster</button>}
              </td>
              <td>
                {showPhotos && <CirculationPhoto imageKey={x.bookCoverKey} name={x.bookTitle} kind="book" />}
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
                      disabled={busy || Boolean(x.sameDayRequired)}
                      onClick={() => onSameDay?.(x.id)}
                    >
                      {x.sameDayRequired ? "Aynı Gün ✓" : "Aynı Gün"}
                    </button>
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
function Ranking({ rows, onSelect }: { rows: (string | number)[][]; onSelect?: (index: number) => void }) {
  const max = Math.max(1, ...rows.map((x) => Number(x[2])));
  return (
    <div className="ranking">
      {rows.slice(0, 8).map((x, i) => (
        <div key={`${String(x[0])}-${i}`} role={onSelect ? "button" : undefined} tabIndex={onSelect ? 0 : undefined} className={onSelect ? "ranking-clickable" : undefined} onClick={() => onSelect?.(i)} onKeyDown={(event) => { if (onSelect && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onSelect(i); } }} aria-label={onSelect ? `${x[0]} ayrıntılarını göster` : undefined}>
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
function ColorChoice({ label, value, colors, onChange }: { label: string; value: string; colors: string[]; onChange: (value: string) => void }) {
  return (
    <label className="color-choice">
      {label}
      <div className="color-input-row"><input type="color" value={value} onChange={(event) => onChange(event.target.value)} /><code>{value.toUpperCase()}</code></div>
      <div className="color-palette" aria-label={`${label} hazır renkleri`}>
        {colors.map((color) => <button key={color} type="button" className={value.toLowerCase() === color.toLowerCase() ? "selected" : ""} style={{ backgroundColor: color }} aria-label={`${color} rengini seç`} title={color} onClick={() => onChange(color)} />)}
      </div>
    </label>
  );
}

function Card({
  title,
  children,
  action,
  onAction,
  visible,
}: {
  title: string;
  children: React.ReactNode;
  action?: string;
  onAction?: () => void;
  visible?: boolean;
}) {
  return (
    <article className="card" hidden={visible === false}>
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

function downloadCsv(filename:string,rows:Record<string,string>[]) {
 const safe=(value:unknown)=>{const text=String(value??'');return '"'+(/^[=+@\-\t\r]/.test(text)?"'"+text:text).replaceAll('"','""')+'"';};
 const headings=Object.keys(rows[0]||{}),csv=[headings,...rows.map(row=>headings.map(h=>row[h]))].map(row=>row.map(safe).join(';')).join('\r\n');
 downloadBlob(filename,new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));
}

