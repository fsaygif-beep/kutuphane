ALTER TABLE `schools` ADD `trial_started_at` text;--> statement-breakpoint
ALTER TABLE `schools` ADD `trial_ends_at` text;--> statement-breakpoint
ALTER TABLE `schools` ADD `premium_until` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `dashboard_image_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `iban` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `membership_fee` integer DEFAULT 0 NOT NULL;