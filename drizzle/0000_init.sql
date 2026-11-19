CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`concept` text NOT NULL,
	`category` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`method` text DEFAULT 'efectivo' NOT NULL,
	`spent_on` text NOT NULL,
	`created_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `expenses_spent_on_idx` ON `expenses` (`spent_on`);--> statement-breakpoint
CREATE TABLE `inquiries` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`check_in` text NOT NULL,
	`check_out` text NOT NULL,
	`guests` integer DEFAULT 1 NOT NULL,
	`room_ids` text DEFAULT '[]' NOT NULL,
	`extras` text DEFAULT '[]' NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`quoted_total_cents` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'nueva' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `inquiries_status_idx` ON `inquiries` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`reservation_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`method` text NOT NULL,
	`kind` text DEFAULT 'adelanto' NOT NULL,
	`paid_on` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`reservation_id`) REFERENCES `reservations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `payments_reservation_idx` ON `payments` (`reservation_id`);--> statement-breakpoint
CREATE INDEX `payments_paid_on_idx` ON `payments` (`paid_on`);--> statement-breakpoint
CREATE TABLE `reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`seq` integer NOT NULL,
	`guest_name` text NOT NULL,
	`guest_document` text DEFAULT '' NOT NULL,
	`guest_phone` text DEFAULT '' NOT NULL,
	`guest_email` text DEFAULT '' NOT NULL,
	`guests` integer DEFAULT 1 NOT NULL,
	`room_id` text NOT NULL,
	`check_in` text NOT NULL,
	`check_out` text NOT NULL,
	`nights` integer NOT NULL,
	`nightly_rate_cents` integer NOT NULL,
	`discount_pct` integer DEFAULT 0 NOT NULL,
	`extras` text DEFAULT '[]' NOT NULL,
	`subtotal_cents` integer NOT NULL,
	`discount_cents` integer DEFAULT 0 NOT NULL,
	`extras_cents` integer DEFAULT 0 NOT NULL,
	`total_cents` integer NOT NULL,
	`status` text DEFAULT 'confirmada' NOT NULL,
	`source` text DEFAULT 'directa' NOT NULL,
	`inquiry_id` text,
	`notes` text DEFAULT '' NOT NULL,
	`created_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reservations_seq_unique` ON `reservations` (`seq`);--> statement-breakpoint
CREATE INDEX `reservations_room_dates_idx` ON `reservations` (`room_id`,`check_in`,`check_out`);--> statement-breakpoint
CREATE INDEX `reservations_check_in_idx` ON `reservations` (`check_in`);--> statement-breakpoint
CREATE INDEX `reservations_status_idx` ON `reservations` (`status`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`floor` integer DEFAULT 1 NOT NULL,
	`type` text NOT NULL,
	`capacity` integer DEFAULT 2 NOT NULL,
	`price_cents` integer NOT NULL,
	`amenities` text DEFAULT '[]' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`image` text DEFAULT 'room-simple' NOT NULL,
	`published` integer DEFAULT true NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rooms_number_unique` ON `rooms` (`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `rooms_slug_unique` ON `rooms` (`slug`);--> statement-breakpoint
CREATE INDEX `rooms_active_idx` ON `rooms` (`active`,`sort_order`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'staff' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);