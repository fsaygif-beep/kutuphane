CREATE TABLE `member_message_receipts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`school_id` integer NOT NULL,
	`message_id` integer NOT NULL,
	`student_id` integer NOT NULL,
	`read_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_receipts_unique` ON `member_message_receipts` (`message_id`,`student_id`);--> statement-breakpoint
CREATE INDEX `member_receipts_student_idx` ON `member_message_receipts` (`school_id`,`student_id`,`message_id`);--> statement-breakpoint
CREATE TABLE `member_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`school_id` integer NOT NULL,
	`sender_id` integer NOT NULL,
	`subject` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recommendation_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`school_id` integer NOT NULL,
	`list_id` integer NOT NULL,
	`book_id` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recommendation_items_unique` ON `recommendation_items` (`list_id`,`book_id`);--> statement-breakpoint
CREATE TABLE `recommendation_lists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`school_id` integer NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `recommendation_school_idx` ON `recommendation_lists` (`school_id`,`id`);--> statement-breakpoint
CREATE TABLE `recommendation_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`school_id` integer NOT NULL,
	`student_id` integer NOT NULL,
	`book_id` integer NOT NULL,
	`status` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recommendation_progress_unique` ON `recommendation_progress` (`school_id`,`student_id`,`book_id`);--> statement-breakpoint
ALTER TABLE `students` ADD `branch` text DEFAULT '' NOT NULL;