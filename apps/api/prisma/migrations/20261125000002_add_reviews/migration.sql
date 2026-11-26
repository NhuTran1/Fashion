CREATE TABLE `reviews` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `product_id` BIGINT UNSIGNED NOT NULL,
    `order_item_id` BIGINT UNSIGNED NOT NULL,
    `rating` TINYINT UNSIGNED NOT NULL,
    `content` TEXT NOT NULL,
    `status` VARCHAR(24) NOT NULL DEFAULT 'VISIBLE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `reviews_order_item_id_key`(`order_item_id`),
    INDEX `reviews_user_id_idx`(`user_id`),
    INDEX `reviews_product_id_status_created_at_idx`(`product_id`, `status`, `created_at`),
    PRIMARY KEY (`id`),
    CONSTRAINT `reviews_rating_check` CHECK (`rating` BETWEEN 1 AND 5),
    CONSTRAINT `reviews_status_check` CHECK (`status` COLLATE utf8mb4_0900_bin IN ('VISIBLE', 'HIDDEN')),
    CONSTRAINT `reviews_user_id_fkey` FOREIGN KEY (`user_id`)
      REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `reviews_product_id_fkey` FOREIGN KEY (`product_id`)
      REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `reviews_order_item_id_fkey` FOREIGN KEY (`order_item_id`)
      REFERENCES `order_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
