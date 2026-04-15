CREATE TABLE `Event` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`date` text NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Reservation` (
	`id` text PRIMARY KEY NOT NULL,
	`timeSlotId` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`partySize` integer DEFAULT 1 NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`timeSlotId`) REFERENCES `TimeSlot`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Reservation_timeSlotId_email_key` ON `Reservation` (`timeSlotId`,`email`);--> statement-breakpoint
CREATE INDEX `Reservation_timeSlotId_idx` ON `Reservation` (`timeSlotId`);--> statement-breakpoint
CREATE TABLE `TimeSlot` (
	`id` text PRIMARY KEY NOT NULL,
	`eventId` text NOT NULL,
	`startTime` text NOT NULL,
	`endTime` text NOT NULL,
	`capacity` integer NOT NULL,
	`sortOrder` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `TimeSlot_eventId_idx` ON `TimeSlot` (`eventId`);