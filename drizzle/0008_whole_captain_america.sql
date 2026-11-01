CREATE TABLE `app_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token_hash` text NOT NULL,
	`user_id` integer NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_sessions_token_hash_unique` ON `app_sessions` (`token_hash`);--> statement-breakpoint
ALTER TABLE `app_users` ADD `username` text;--> statement-breakpoint
UPDATE `app_users` SET `username` = lower(`email`) WHERE `username` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `app_users_username_unique` ON `app_users` (`username`);
