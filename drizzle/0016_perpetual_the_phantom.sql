CREATE TABLE `inventory_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`school_id` integer NOT NULL,
	`session_id` integer NOT NULL,
	`book_id` integer NOT NULL,
	`counted_at` text NOT NULL,
	`shelf_before` text DEFAULT '' NOT NULL,
	`shelf_after` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_entries_session_book_unique` ON `inventory_entries` (`session_id`,`book_id`);--> statement-breakpoint
CREATE INDEX `inventory_entries_school_session_idx` ON `inventory_entries` (`school_id`,`session_id`);--> statement-breakpoint
CREATE TABLE `inventory_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`school_id` integer NOT NULL,
	`count_no` text NOT NULL,
	`count_date` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_sessions_school_no_date_unique` ON `inventory_sessions` (`school_id`,`count_no`,`count_date`);