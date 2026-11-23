# Learning / Interview Journal

Mỗi feature được làm, **tự diễn giải** vì sao chọn giải pháp; đừng dùng AI viết thay trải nghiệm. Không tự ghi điểm benchmark không có test.

## Template
```md
### YYYY-MM-DD — Task ID — Chủ đề
- Tôi hiểu vấn đề nghiệp vụ như thế nào:
- Thiết kế đã chọn và 1 phương án thay thế:
- Các file/SQL/API thực sự đã đụng tới:
- Lỗi đã tái hiện và cách khắc phục:
- Test thật đã chạy, output/commit:
- Nếu phỏng vấn hỏi "vì sao?" tôi sẽ trả lời:
- Điều tôi muốn tự làm lại từ đầu:
```

## Lộ trình kiến thức theo milestone
- M3: NestJS module/controller/service/DI, JWT/session, 401/403, authorization policies, IDOR.
- M4: MySQL schema/index/EXPLAIN, relation variants, pagination, API DTO.
- M5: ACID, locking, race condition, idempotency, order price snapshots, payment callbacks.
- M6: verified purchase, review moderation, state machine, audits.
- M7: least privilege, capability mapping, tests truy cập trái phép.
- M8: Docker, migrations, backup restore, integration/E2E, performance p95.
- AI: inference worker/queue, privacy, GPU VRAM/latency, retry, async APIs.

## Câu hỏi phỏng vấn mục tiêu
- Vì sao chọn single-vendor thay vì marketplace và modular monolith thay vì microservices?
- Vì sao MySQL InnoDB và DECIMAL? Làm sao chống overselling?
- Vì sao server tính giá và snapshot order? Idempotency xử lý double submit thế nào?
- RBAC khác resource ownership? Staff không được đổi giá được thực thi ở đâu?
- Khi p95 tăng, bạn đo gì trước khi thêm Redis hoặc tách service?
