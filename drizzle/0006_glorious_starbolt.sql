CREATE TABLE `membership_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`city` text NOT NULL,
	`district` text NOT NULL,
	`school_name` text NOT NULL,
	`full_name` text NOT NULL,
	`grade` text NOT NULL,
	`student_no` text NOT NULL,
	`matched_student_id` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`reviewed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `membership_requests_email_unique` ON `membership_requests` (`email`);--> statement-breakpoint
ALTER TABLE `settings` ADD `city` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `district` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `school_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `institution_code` text DEFAULT '' NOT NULL;