CREATE TABLE `payment_records` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `order_id` BIGINT UNSIGNED NOT NULL,
    `method` VARCHAR(24) NOT NULL,
    `status` VARCHAR(24) NOT NULL,
    `provider_reference` VARCHAR(191) NULL,
    `idempotency_key` VARCHAR(128) COLLATE utf8mb4_0900_bin NOT NULL,

    UNIQUE INDEX `payment_records_order_id_key`(`order_id`),
    UNIQUE INDEX `payment_records_provider_reference_key`(`provider_reference`),
    PRIMARY KEY (`id`),
    CONSTRAINT `payment_records_method_check` CHECK (`method` COLLATE utf8mb4_0900_bin = 'COD'),
    CONSTRAINT `payment_records_status_check` CHECK (`status` COLLATE utf8mb4_0900_bin IN ('UNPAID', 'PAID')),
    CONSTRAINT `payment_records_order_id_fkey` FOREIGN KEY (`order_id`)
      REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `payment_records` (`order_id`, `method`, `status`, `idempotency_key`)
SELECT `id`, 'COD', 'UNPAID', `idempotency_key`
FROM `orders`
WHERE `status` COLLATE utf8mb4_0900_bin = 'PENDING';
