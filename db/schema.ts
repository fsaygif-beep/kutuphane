import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const schools = sqliteTable("schools", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  city: text("city").notNull(),
  district: text("district").notNull(),
  name: text("name").notNull(),
  institutionCode: text("institution_code").notNull().unique(),
  active: integer("active").notNull().default(1),
  createdAt: text("created_at").notNull(),
  trialStartedAt: text("trial_started_at"),
  trialEndsAt: text("trial_ends_at"),
  premiumUntil: text("premium_until"),
});

export const schoolApplications = sqliteTable("school_applications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  city: text("city").notNull(), district: text("district").notNull(), schoolName: text("school_name").notNull(),
  institutionCode: text("institution_code").notNull().unique(), adminName: text("admin_name").notNull(),
  adminEmail: text("admin_email").notNull(), adminUsername: text("admin_username").notNull(),
  passwordHash: text("password_hash").notNull(), passwordSalt: text("password_salt").notNull(),
  status: text("status").notNull().default("pending"), createdAt: text("created_at").notNull(), reviewedAt: text("reviewed_at"),
});

export const students = sqliteTable("students", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  schoolId: integer("school_id").notNull(),
  studentNo: text("student_no").notNull(),
  fullName: text("full_name").notNull(),
  grade: text("grade").notNull(),
  memberType: text("member_type").notNull().default("student"),
  activeMember: integer("active_member").notNull().default(1),
  contact: text("contact").notNull().default(""),
  email: text("email").notNull().default(""),
  photoKey: text("photo_key").notNull().default(""),
  blocked: integer("blocked").notNull().default(0),
  blockReason: text("block_reason").notNull().default(""),
  createdAt: text("created_at").notNull(),
}, (table) => [uniqueIndex("students_school_no_unique").on(table.schoolId, table.studentNo)]);

export const books = sqliteTable("books", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  schoolId: integer("school_id").notNull(),
  inventoryNo: text("inventory_no").notNull(),
  isbn: text("isbn").notNull().default(""),
  title: text("title").notNull(),
  author: text("author").notNull(),
  publisher: text("publisher").notNull().default(""),
  category: text("category").notNull().default(""),
  genre: text("genre").notNull().default(""),
  shelf: text("shelf").notNull().default(""),
  dewey: text("dewey").notNull().default(""),
  pages: integer("pages").notNull().default(0),
  coverKey: text("cover_key").notNull().default(""),
  activeInventory: integer("active_inventory").notNull().default(1),
  loanable: integer("loanable").notNull().default(1),
  lost: integer("lost").notNull().default(0),
  lostAt: text("lost_at"),
  createdAt: text("created_at").notNull(),
}, (table) => [uniqueIndex("books_school_inventory_unique").on(table.schoolId, table.inventoryNo)]);

export const inventorySessions = sqliteTable("inventory_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  schoolId: integer("school_id").notNull(),
  countNo: text("count_no").notNull(),
  countDate: text("count_date").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("inventory_sessions_school_no_date_unique").on(table.schoolId, table.countNo, table.countDate)]);

export const inventoryEntries = sqliteTable("inventory_entries", {
  source: text("source").notNull().default("manual"),
  id: integer("id").primaryKey({ autoIncrement: true }),
  schoolId: integer("school_id").notNull(),
  sessionId: integer("session_id").notNull(),
  bookId: integer("book_id").notNull(),
  countedAt: text("counted_at").notNull(),
  shelfBefore: text("shelf_before").notNull().default(""),
  shelfAfter: text("shelf_after").notNull().default(""),
}, (table) => [
  uniqueIndex("inventory_entries_session_book_unique").on(table.sessionId, table.bookId),
  index("inventory_entries_school_session_idx").on(table.schoolId, table.sessionId),
]);

export const loans = sqliteTable("loans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  schoolId: integer("school_id").notNull(),
  studentId: integer("student_id").notNull(),
  bookId: integer("book_id").notNull(),
  loanedAt: text("loaned_at").notNull(),
  dueAt: text("due_at").notNull(),
  returnedAt: text("returned_at"),
  schoolYear: text("school_year").notNull(),
  renewalCount: integer("renewal_count").notNull().default(0),
  sameDayRequired: integer("same_day_required").notNull().default(0),
});

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  schoolId: integer("school_id").notNull().unique(),
  city: text("city").notNull().default(""),
  district: text("district").notNull().default(""),
  schoolName: text("school_name").notNull().default(""),
  institutionCode: text("institution_code").notNull().default(""),
  libraryName: text("library_name").notNull(),
  schoolYear: text("school_year").notNull(),
  loanDays: integer("loan_days").notNull().default(15),
  maxBooksPerStudent: integer("max_books_per_student").notNull().default(3),
  theme: text("theme").notNull().default("forest"),
  senderName: text("sender_name").notNull().default("Okul Kütüphanesi"),
  senderEmail: text("sender_email").notNull().default(""),
  extensionDays: integer("extension_days").notNull().default(7),
  maxRenewals: integer("max_renewals").notNull().default(1),
  dailyFine: integer("daily_fine").notNull().default(0),
  logoKey: text("logo_key").notNull().default(""),
  dashboardImageKey: text("dashboard_image_key").notNull().default(""),
  iban: text("iban").notNull().default(""),
  membershipFee: integer("membership_fee").notNull().default(0),
  driveAccountEmail: text("drive_account_email").notNull().default(""),
  driveFolderUrl: text("drive_folder_url").notNull().default(""),
  bookGenres: text("book_genres").notNull().default("ROMAN,HİKAYE,ŞİİR,DENEME,MAKALE,BİYOGRAFİ"),
  uiFont: text("ui_font").notNull().default("Arial"),
  titleFont: text("title_font").notNull().default("Georgia"),
  baseFontSize: integer("base_font_size").notNull().default(14),
  textColor: text("text_color").notNull().default("#17211b"),
  accentColor: text("accent_color").notNull().default("#1d6649"),
  surfaceColor: text("surface_color").notNull().default("#f4f6f2"),
});

export const membershipRequests = sqliteTable("membership_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  schoolId: integer("school_id").notNull(),
  username: text("username").notNull().default(""),
  email: text("email").notNull(),
  city: text("city").notNull(),
  district: text("district").notNull(),
  schoolName: text("school_name").notNull(),
  fullName: text("full_name").notNull(),
  grade: text("grade").notNull(),
  studentNo: text("student_no").notNull(),
  matchedStudentId: integer("matched_student_id").notNull(),
  passwordHash: text("password_hash").notNull().default(""),
  passwordSalt: text("password_salt").notNull().default(""),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").notNull(),
  reviewedAt: text("reviewed_at"),
}, (table) => [uniqueIndex("membership_school_email_unique").on(table.schoolId, table.email)]);

export const appUsers = sqliteTable("app_users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  schoolId: integer("school_id"),
  username: text("username"),
  email: text("email").notNull(),
  phone: text("phone").notNull().default(""),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("student"),
  permissions: text("permissions").notNull().default(""),
  studentId: integer("student_id"),
  active: integer("active").notNull().default(1),
  passwordHash: text("password_hash").notNull().default(""),
  passwordSalt: text("password_salt").notNull().default(""),
  passwordUpdatedAt: text("password_updated_at"),
  createdAt: text("created_at").notNull(),
}, (table) => [uniqueIndex("users_school_username_unique").on(table.schoolId, table.username), uniqueIndex("users_school_email_unique").on(table.schoolId, table.email)]);

export const appSessions = sqliteTable("app_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tokenHash: text("token_hash").notNull().unique(),
  userId: integer("user_id").notNull(),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
});

export const bookRequests = sqliteTable("book_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  schoolId: integer("school_id").notNull(),
  studentId: integer("student_id").notNull(),
  title: text("title").notNull(),
  author: text("author").notNull().default(""),
  note: text("note").notNull().default(""),
  status: text("status").notNull().default("new"),
  createdAt: text("created_at").notNull(),
});

export const studentChanges = sqliteTable("student_changes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  schoolId: integer("school_id").notNull(),
  studentId: integer("student_id").notNull(),
  studentNo: text("student_no").notNull(),
  field: text("field").notNull(),
  oldValue: text("old_value").notNull().default(""),
  newValue: text("new_value").notNull().default(""),
  source: text("source").notNull().default("manual"),
  changedAt: text("changed_at").notNull(),
});

export const emailLogs = sqliteTable("email_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  schoolId: integer("school_id").notNull(),
  studentId: integer("student_id").notNull(),
  recipient: text("recipient").notNull(),
  subject: text("subject").notNull(),
  status: text("status").notNull(),
  detail: text("detail").notNull().default(""),
  sentAt: text("sent_at").notNull(),
});

export const adminNotes = sqliteTable("admin_notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  schoolId: integer("school_id").notNull(),
  content: text("content").notNull(),
  done: integer("done").notNull().default(0),
  createdAt: text("created_at").notNull(),
}, (table) => [index("admin_notes_school_id_idx").on(table.schoolId)]);
