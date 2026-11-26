CREATE TABLE `inventory_movements` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `variant_id` BIGINT UNSIGNED NOT NULL,
    `order_id` BIGINT UNSIGNED NULL,
    `actor_user_id` BIGINT UNSIGNED NOT NULL,
    `delta` INTEGER NOT NULL,
    `reason` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `inventory_movements_variant_id_created_at_id_idx`(`variant_id`, `created_at`, `id`),
    INDEX `inventory_movements_actor_user_id_idx`(`actor_user_id`),
    PRIMARY KEY (`id`),
    CONSTRAINT `inventory_movements_delta_nonzero` CHECK (`delta` <> 0),
    CONSTRAINT `inventory_movements_variant_id_fkey` FOREIGN KEY (`variant_id`)
      REFERENCES `product_variants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `inventory_movements_actor_user_id_fkey` FOREIGN KEY (`actor_user_id`)
      REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
