ALTER TABLE `products` ADD COLUMN `nameNormalized` varchar(255) NULL AFTER `name`;
UPDATE `products` SET `nameNormalized` = LOWER(TRIM(`name`)) WHERE `nameNormalized` IS NULL;
ALTER TABLE `products` MODIFY `nameNormalized` varchar(255) NOT NULL;
CREATE UNIQUE INDEX `idx_products_userId_nameNormalized` ON `products` (`userId`, `nameNormalized`);
