CREATE TABLE `school_applications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`city` text NOT NULL,
	`district` text NOT NULL,
	`school_name` text NOT NULL,
	`institution_code` text NOT NULL,
	`admin_name` text NOT NULL,
	`admin_email` text NOT NULL,
	`admin_username` text NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`reviewed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `school_applications_institution_code_unique` ON `school_applications` (`institution_code`);--> statement-breakpoint
CREATE TABLE `schools` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`city` text NOT NULL,
	`district` text NOT NULL,
	`name` text NOT NULL,
	`institution_code` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `schools_institution_code_unique` ON `schools` (`institution_code`);--> statement-breakpoint
DROP INDEX `app_users_username_unique`;--> statement-breakpoint
DROP INDEX `app_users_email_unique`;--> statement-breakpoint
ALTER TABLE `app_users` ADD `school_id` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `users_school_username_unique` ON `app_users` (`school_id`,`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_school_email_unique` ON `app_users` (`school_id`,`email`);--> statement-breakpoint
DROP INDEX `books_inventory_no_unique`;--> statement-breakpoint
ALTER TABLE `books` ADD `school_id` integer NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `books_school_inventory_unique` ON `books` (`school_id`,`inventory_no`);--> statement-breakpoint
DROP INDEX `membership_requests_email_unique`;--> statement-breakpoint
ALTER TABLE `membership_requests` ADD `school_id` integer NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `membership_school_email_unique` ON `membership_requests` (`school_id`,`email`);--> statement-breakpoint
DROP INDEX `students_student_no_unique`;--> statement-breakpoint
ALTER TABLE `students` ADD `school_id` integer NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `students_school_no_unique` ON `students` (`school_id`,`student_no`);--> statement-breakpoint
ALTER TABLE `book_requests` ADD `school_id` integer NOT NULL;--> statement-breakpoint
ALTER TABLE `email_logs` ADD `school_id` integer NOT NULL;--> statement-breakpoint
ALTER TABLE `loans` ADD `school_id` integer NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `school_id` integer NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `settings_school_id_unique` ON `settings` (`school_id`);--> statement-breakpoint
ALTER TABLE `student_changes` ADD `school_id` integer NOT NULL;