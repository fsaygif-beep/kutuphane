ALTER TABLE `app_users` ADD `phone` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `loanable` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `loans` ADD `same_day_required` integer DEFAULT 0 NOT NULL;