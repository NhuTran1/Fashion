# ADR-0001 — Stack + chiến lược single-vendor

**Date:** 2026-11-19. **Status:** Core stack & product direction ACCEPTED by user; implementation details pending.

## Context
Nhóm 2 người nhưng giai đoạn đầu một người làm chính; ngân sách local 0 đồng; MySQL đã quen, mong học NestJS và AI try-on; tránh marketplace phức tạp.

## Decision
- Expo React Native + TS, NestJS TS (modular monolith), MySQL/InnoDB.
- **Single-vendor**, **MVP A Customer + Admin** đầy đủ e-commerce, **MVP B Staff** được thêm từ operational capabilities hiện có. Không SELLER/multi-shop.
- AI riêng Python/FastAPI, pretrained model trên Colab nghiên cứu, không chặn checkout/không bắt buộc GPU.

## Consequences
Ưu: ít transaction/payout và ownership liên shop hơn marketplace, giảm rủi ro solo, học RBAC/transaction/reviews/payment. Nhược: cần thiết kế policy Staff từ đầu và tăng UI quản trị; payment sandbox có thể có điều kiện đăng ký/giới hạn.

## ADR liên quan và quyết định còn mở
ORM đã được chốt trong [ADR-0002](0002-orm.md). Còn mở: auth token strategy, image storage, COD vs sandbox provider, order cancellation/restock, roles policy mapping, deployment. Ghi quyết định sau khi xác nhận, không tự mặc định.
