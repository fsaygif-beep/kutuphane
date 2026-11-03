ALTER TABLE `app_users` ADD `permissions` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `membership_requests` ADD `username` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `membership_requests` ADD `password_hash` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `membership_requests` ADD `password_salt` text DEFAULT '' NOT NULL;