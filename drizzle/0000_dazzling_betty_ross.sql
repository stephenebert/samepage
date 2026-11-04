CREATE TABLE `judge_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`state` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `judge_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_hash` text NOT NULL,
	`revision` integer NOT NULL,
	`state` text NOT NULL,
	`updated_at` text NOT NULL
);
