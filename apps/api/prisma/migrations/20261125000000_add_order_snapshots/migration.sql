CREATE TABLE `orders` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `status` VARCHAR(24) NOT NULL,
    `subtotal` DECIMAL(12, 2) NOT NULL,
    `shipping_fee` DECIMAL(12, 2) NOT NULL,
    `total` DECIMAL(12, 2) NOT NULL,
    `address_snapshot` JSON NOT NULL,
    `idempotency_key` VARCHAR(128) COLLATE utf8mb4_0900_bin NOT NULL,
    `request_fingerprint` CHAR(64) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `orders_user_id_idempotency_key_key`(`user_id`, `idempotency_key`),
    INDEX `orders_user_id_created_at_id_idx`(`user_id`, `created_at`, `id`),
    PRIMARY KEY (`id`),
    CONSTRAINT `orders_amounts_nonnegative` CHECK (
        `subtotal` >= 0 AND `shipping_fee` >= 0 AND `total` >= 0
    ),
    CONSTRAINT `orders_user_id_fkey` FOREIGN KEY (`user_id`)
      REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `order_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `order_id` BIGINT UNSIGNED NOT NULL,
    `variant_id` BIGINT UNSIGNED NOT NULL,
    `sku_snapshot` VARCHAR(128) NOT NULL,
    `name_snapshot` VARCHAR(191) NOT NULL,
    `size_snapshot` VARCHAR(48) NOT NULL,
    `color_snapshot` VARCHAR(80) NOT NULL,
    `unit_price` DECIMAL(12, 2) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `line_total` DECIMAL(12, 2) NOT NULL,

    INDEX `order_items_order_id_idx`(`order_id`),
    INDEX `order_items_variant_id_idx`(`variant_id`),
    PRIMARY KEY (`id`),
    CONSTRAINT `order_items_amounts_nonnegative` CHECK (`unit_price` >= 0 AND `line_total` >= 0),
    CONSTRAINT `order_items_quantity_positive` CHECK (`quantity` > 0),
    CONSTRAINT `order_items_order_id_fkey` FOREIGN KEY (`order_id`)
      REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `order_items_variant_id_fkey` FOREIGN KEY (`variant_id`)
      REFERENCES `product_variants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `inventory_movements`
    ADD INDEX `inventory_movements_order_id_idx`(`order_id`),
    ADD CONSTRAINT `inventory_movements_order_id_fkey` FOREIGN KEY (`order_id`)
      REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
