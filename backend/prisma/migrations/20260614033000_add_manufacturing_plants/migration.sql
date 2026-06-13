CREATE TABLE `ManufacturingPlant` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `address` VARCHAR(191) NOT NULL,
  `city` VARCHAR(191) NOT NULL,
  `lat` DOUBLE NOT NULL,
  `lng` DOUBLE NOT NULL,
  `capacity` INTEGER NOT NULL DEFAULT 0,
  `status` VARCHAR(191) NOT NULL DEFAULT 'Active',
  `notes` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ManufacturingPlant_code_key`(`code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `ManufacturingPlant` (`id`, `name`, `code`, `address`, `city`, `lat`, `lng`, `capacity`, `status`, `notes`, `createdAt`, `updatedAt`)
VALUES ('plant_default_mfg', 'Shiv Furniture Works', 'MFG', 'Pune Industrial Area, Pune, Maharashtra, India', 'Pune', 18.5204, 73.8567, 120, 'Active', 'Default manufacturing plant used by the live supply chain map.', NOW(3), NOW(3));
