CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`name_ja` text,
	`slug` text NOT NULL,
	`parent_id` integer,
	`icon` text,
	`display_order` integer DEFAULT 0
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE TABLE `destinations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`name_ja` text,
	`slug` text NOT NULL,
	`parent_id` integer,
	`level` text NOT NULL,
	`country` text DEFAULT 'Japan',
	`region` text,
	`latitude` real,
	`longitude` real,
	`description` text,
	`description_ja` text,
	`hero_image_url` text,
	`thumbnail_url` text,
	`image_credit` text,
	`experience_count` integer DEFAULT 0,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `destinations_slug_unique` ON `destinations` (`slug`);--> statement-breakpoint
CREATE TABLE `experience_categories` (
	`experience_id` integer NOT NULL,
	`category_id` integer NOT NULL,
	FOREIGN KEY (`experience_id`) REFERENCES `experiences`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `experience_themes` (
	`experience_id` integer NOT NULL,
	`theme_id` integer NOT NULL,
	FOREIGN KEY (`experience_id`) REFERENCES `experiences`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`theme_id`) REFERENCES `themes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `experiences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`title_ja` text,
	`description` text,
	`description_ja` text,
	`short_description` text,
	`destination_id` integer,
	`duration_minutes` integer,
	`duration_text` text,
	`max_group_size` integer,
	`min_age` integer,
	`languages` text,
	`meeting_point` text,
	`highlights` text,
	`includes` text,
	`excludes` text,
	`min_price` real,
	`max_price` real,
	`currency` text DEFAULT 'USD',
	`price_display` text,
	`avg_rating` real,
	`total_review_count` integer DEFAULT 0,
	`listing_count` integer DEFAULT 0,
	`platform_names` text,
	`platform_slugs` text,
	`hero_image_url` text,
	`hero_image_alt` text,
	`status` text DEFAULT 'published',
	`is_popular` integer DEFAULT false,
	`is_featured` integer DEFAULT false,
	`popularity_score` integer DEFAULT 0,
	`is_private_tour` integer,
	`is_group_tour` integer,
	`has_food_included` integer,
	`has_transport` integer,
	`is_wheelchair_accessible` integer,
	`time_of_day` text,
	`best_for` text,
	`difficulty_level` text,
	`indoor_outdoor` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`destination_id`) REFERENCES `destinations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `experiences_slug_unique` ON `experiences` (`slug`);--> statement-breakpoint
CREATE TABLE `images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`experience_id` integer,
	`destination_id` integer,
	`listing_id` integer,
	`url` text NOT NULL,
	`alt_text` text,
	`width` integer,
	`height` integer,
	`source_platform_id` integer,
	`photographer` text,
	`license` text,
	`display_order` integer DEFAULT 0,
	`is_hero` integer DEFAULT false,
	`image_type` text DEFAULT 'tour',
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`experience_id`) REFERENCES `experiences`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`destination_id`) REFERENCES `destinations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_platform_id`) REFERENCES `platforms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `listings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`experience_id` integer NOT NULL,
	`platform_id` integer NOT NULL,
	`external_id` text NOT NULL,
	`external_url` text NOT NULL,
	`affiliate_url` text,
	`title` text,
	`description` text,
	`price` real,
	`original_price` real,
	`currency` text DEFAULT 'USD',
	`price_type` text DEFAULT 'per_person',
	`has_discount` integer DEFAULT false,
	`discount_percent` integer,
	`rating` real,
	`review_count` integer DEFAULT 0,
	`cancellation_policy` text,
	`instant_confirmation` integer,
	`skip_the_line` integer,
	`thumbnail_url` text,
	`images` text,
	`last_scraped_at` text,
	`scrape_status` text DEFAULT 'success',
	`is_active` integer DEFAULT true,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`experience_id`) REFERENCES `experiences`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`platform_id`) REFERENCES `platforms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `platforms` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`display_name` text NOT NULL,
	`base_url` text NOT NULL,
	`logo_url` text,
	`api_type` text NOT NULL,
	`commission_rate` real,
	`is_active` integer DEFAULT true,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `platforms_name_unique` ON `platforms` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `platforms_slug_unique` ON `platforms` (`slug`);--> statement-breakpoint
CREATE TABLE `price_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`listing_id` integer NOT NULL,
	`price` real NOT NULL,
	`currency` text DEFAULT 'USD',
	`recorded_at` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`experience_id` integer NOT NULL,
	`listing_id` integer,
	`platform_id` integer NOT NULL,
	`external_review_id` text,
	`author_name` text,
	`author_country` text,
	`rating` real NOT NULL,
	`title` text,
	`content` text,
	`review_date` text,
	`traveler_type` text,
	`verified_booking` integer DEFAULT false,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`experience_id`) REFERENCES `experiences`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`platform_id`) REFERENCES `platforms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `scrape_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`platform_id` integer NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`status` text DEFAULT 'running',
	`items_found` integer DEFAULT 0,
	`items_new` integer DEFAULT 0,
	`items_updated` integer DEFAULT 0,
	`items_failed` integer DEFAULT 0,
	`error_message` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`platform_id`) REFERENCES `platforms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `themes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`name_ja` text,
	`slug` text NOT NULL,
	`description` text,
	`icon` text,
	`color` text,
	`keywords` text,
	`display_order` integer DEFAULT 0,
	`experience_count` integer DEFAULT 0,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `themes_slug_unique` ON `themes` (`slug`);