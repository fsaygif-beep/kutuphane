CREATE TABLE `admin_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`school_id` integer NOT NULL,
	`content` text NOT NULL,
	`done` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_notes_school_id_idx` ON `admin_notes` (`school_id`);