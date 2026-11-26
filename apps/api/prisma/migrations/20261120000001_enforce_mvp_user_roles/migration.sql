-- Giới hạn role và status của tài khoản MVP A, kể cả khi ghi trực tiếp vào MySQL.
-- So sánh theo byte để chuỗi sai chữ hoa/thường hoặc chứa khoảng trắng bị từ chối.
ALTER TABLE `users`
    ADD CONSTRAINT `users_mvp_role_check`
        CHECK (CAST(`role` AS BINARY) IN ('CUSTOMER', 'ADMIN')),
    ADD CONSTRAINT `users_status_check`
        CHECK (CAST(`status` AS BINARY) IN ('ACTIVE', 'DISABLED'));
