CREATE TABLE `cart_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `cart_id` BIGINT UNSIGNED NOT NULL,
    `variant_id` BIGINT UNSIGNED NOT NULL,
    `quantity` INTEGER NOT NULL,

    UNIQUE INDEX `cart_items_cart_id_variant_id_key`(`cart_id`, `variant_id`),
    INDEX `cart_items_variant_id_idx`(`variant_id`),
    PRIMARY KEY (`id`),
    CONSTRAINT `cart_items_quantity_positive` CHECK (`quantity` > 0),
    CONSTRAINT `cart_items_cart_id_fkey` FOREIGN KEY (`cart_id`)
      REFERENCES `carts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `cart_items_variant_id_fkey` FOREIGN KEY (`variant_id`)
      REFERENCES `product_variants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
