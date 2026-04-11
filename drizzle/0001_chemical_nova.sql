CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`category` varchar(100) NOT NULL,
	`reference` varchar(50) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_reference_unique` UNIQUE(`reference`)
);
