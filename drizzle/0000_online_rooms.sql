CREATE TABLE `online_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`data` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `online_rooms_expires` ON `online_rooms` (`expires`);