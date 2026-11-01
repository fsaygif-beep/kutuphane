ALTER TABLE `books` ADD `active_inventory` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `lost` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `lost_at` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `book_genres` text DEFAULT 'ROMAN,HİKAYE,ŞİİR,DENEME,MAKALE,BİYOGRAFİ' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `ui_font` text DEFAULT 'Inter' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `title_font` text DEFAULT 'Georgia' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `base_font_size` integer DEFAULT 14 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `text_color` text DEFAULT '#17211b' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `accent_color` text DEFAULT '#1d6649' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `surface_color` text DEFAULT '#f4f6f2' NOT NULL;--> statement-breakpoint
ALTER TABLE `students` ADD `member_type` text DEFAULT 'student' NOT NULL;--> statement-breakpoint
ALTER TABLE `students` ADD `active_member` integer DEFAULT 1 NOT NULL;