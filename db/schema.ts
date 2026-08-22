import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const students = sqliteTable("students", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentNo: text("student_no").notNull().unique(),
  fullName: text("full_name").notNull(),
  grade: text("grade").notNull(),
  contact: text("contact").notNull().default(""),
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
});

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  libraryName: text("library_name").notNull(),
  schoolYear: text("school_year").notNull(),
  loanDays: integer("loan_days").notNull().default(15),
});
