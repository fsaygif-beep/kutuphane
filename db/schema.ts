import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const students = sqliteTable("students", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentNo: text("student_no").notNull().unique(),
  fullName: text("full_name").notNull(),
  grade: text("grade").notNull(),
  contact: text("contact").notNull().default(""),
  email: text("email").notNull().default(""),
  photoKey: text("photo_key").notNull().default(""),
  blocked: integer("blocked").notNull().default(0),
  blockReason: text("block_reason").notNull().default(""),
  createdAt: text("created_at").notNull(),
});

export const books = sqliteTable("books", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  inventoryNo: text("inventory_no").notNull().unique(),
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
  createdAt: text("created_at").notNull(),
});

export const loans = sqliteTable("loans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id").notNull(),
  bookId: integer("book_id").notNull(),
  loanedAt: text("loaned_at").notNull(),
  dueAt: text("due_at").notNull(),
  returnedAt: text("returned_at"),
  schoolYear: text("school_year").notNull(),
  renewalCount: integer("renewal_count").notNull().default(0),
});

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  libraryName: text("library_name").notNull(),
  schoolYear: text("school_year").notNull(),
  loanDays: integer("loan_days").notNull().default(15),
  theme: text("theme").notNull().default("forest"),
  senderName: text("sender_name").notNull().default("Okul Kütüphanesi"),
  senderEmail: text("sender_email").notNull().default(""),
  extensionDays: integer("extension_days").notNull().default(7),
  maxRenewals: integer("max_renewals").notNull().default(1),
  dailyFine: integer("daily_fine").notNull().default(0),
});

export const appUsers = sqliteTable("app_users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("student"),
  studentId: integer("student_id"),
  active: integer("active").notNull().default(1),
  createdAt: text("created_at").notNull(),
});

export const bookRequests = sqliteTable("book_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id").notNull(),
  title: text("title").notNull(),
  author: text("author").notNull().default(""),
  note: text("note").notNull().default(""),
  status: text("status").notNull().default("new"),
  createdAt: text("created_at").notNull(),
});

export const studentChanges = sqliteTable("student_changes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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
  studentId: integer("student_id").notNull(),
  recipient: text("recipient").notNull(),
  subject: text("subject").notNull(),
  status: text("status").notNull(),
  detail: text("detail").notNull().default(""),
  sentAt: text("sent_at").notNull(),
});
