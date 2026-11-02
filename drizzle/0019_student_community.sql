CREATE TABLE `book_reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`school_id` integer NOT NULL,
	`student_id` integer NOT NULL,
	`book_id` integer NOT NULL,
	`content` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`reviewed_at` text
);
--> statement-breakpoint
CREATE INDEX `reviews_school_book_status_idx` ON `book_reviews` (`school_id`,`book_id`,`status`);--> statement-breakpoint
CREATE TABLE `complaints` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`school_id` integer NOT NULL,
	`student_id` integer NOT NULL,
	`book_id` integer,
	`category` text NOT NULL,
	`page` text DEFAULT '' NOT NULL,
	`content` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `complaints_school_idx` ON `complaints` (`school_id`,`status`);--> statement-breakpoint
CREATE TABLE `reading_list_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`school_id` integer NOT NULL,
	`list_id` integer NOT NULL,
	`book_id` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reading_items_unique` ON `reading_list_items` (`list_id`,`book_id`);--> statement-breakpoint
CREATE TABLE `reading_lists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`school_id` integer NOT NULL,
	`student_id` integer NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reading_lists_owner_idx` ON `reading_lists` (`school_id`,`student_id`);--> statement-breakpoint
ALTER TABLE `membership_requests` ADD `phone` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `books_school_active_title_idx` ON `books` (`school_id`,`active_inventory`,`title`);--> statement-breakpoint
CREATE INDEX `sessions_school_open_date_idx` ON `inventory_sessions` (`school_id`,`status`,`count_date`);--> statement-breakpoint
CREATE INDEX `loans_school_active_book_idx` ON `loans` (`school_id`,`book_id`,`returned_at`);--> statement-breakpoint
CREATE INDEX `loans_school_student_idx` ON `loans` (`school_id`,`student_id`,`returned_at`);