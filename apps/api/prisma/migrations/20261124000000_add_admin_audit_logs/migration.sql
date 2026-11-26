CREATE TABLE `admin_audit_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `actor_user_id` BIGINT UNSIGNED NOT NULL,
    `action` VARCHAR(64) NOT NULL,
    `target_type` VARCHAR(48) NOT NULL,
    `target_id` BIGINT UNSIGNED NOT NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `admin_audit_logs_actor_user_id_idx`(`actor_user_id`),
    PRIMARY KEY (`id`),
    CONSTRAINT `admin_audit_logs_actor_user_id_fkey` FOREIGN KEY (`actor_user_id`)
      REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
