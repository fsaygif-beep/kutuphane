CREATE TABLE `email_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` integer NOT NULL,
	`recipient` text NOT NULL,
	`subject` text NOT NULL,
	`status` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`sent_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `student_changes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` integer NOT NULL,
	`student_no` text NOT NULL,
	`field` text NOT NULL,
	`old_value` text DEFAULT '' NOT NULL,
	`new_value` text DEFAULT '' NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`changed_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `books` ADD `cover_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `sender_name` text DEFAULT 'Okul Kütüphanesi' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `sender_email` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `students` ADD `email` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `students` ADD `photo_key` text DEFAULT '' NOT NULL;