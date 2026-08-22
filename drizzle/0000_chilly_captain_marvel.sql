CREATE TABLE `books` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`inventory_no` text NOT NULL,
	`isbn` text DEFAULT '' NOT NULL,
	`title` text NOT NULL,
	`author` text NOT NULL,
	`publisher` text DEFAULT '' NOT NULL,
	`shelf` text DEFAULT '' NOT NULL,
	`dewey` text DEFAULT '' NOT NULL,
	`pages` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `books_inventory_no_unique` ON `books` (`inventory_no`);--> statement-breakpoint
CREATE TABLE `loans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` integer NOT NULL,
	`book_id` integer NOT NULL,
	`loaned_at` text NOT NULL,
	`due_at` text NOT NULL,
	`returned_at` text,
	`school_year` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`library_name` text NOT NULL,
	`school_year` text NOT NULL,
	`loan_days` integer DEFAULT 15 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `students` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_no` text NOT NULL,
	`full_name` text NOT NULL,
	`grade` text NOT NULL,
	`contact` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `students_student_no_unique` ON `students` (`student_no`);