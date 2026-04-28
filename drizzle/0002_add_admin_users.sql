CREATE TABLE `AdminInvite` (
	`id` text PRIMARY KEY NOT NULL,
	`createdBy` text NOT NULL,
	`used` integer DEFAULT false NOT NULL,
	`expiresAt` text NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`createdBy`) REFERENCES `AdminUser`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `AdminUser` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`passwordHash` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'admin' NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `AdminUser_email_key` ON `AdminUser` (`email`);--> statement-breakpoint
ALTER TABLE `Event` ADD `adminUserId` text REFERENCES AdminUser(id);--> statement-breakpoint
CREATE INDEX `Event_adminUserId_idx` ON `Event` (`adminUserId`);--> statement-breakpoint
ALTER TABLE `TimeSlot` ADD `title` text;