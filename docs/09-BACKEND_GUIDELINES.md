# Backend coding guidelines — NestJS + MySQL (DRAFT)

## Mục tiêu
Hoàn thành MVP A `Customer + Admin` trước; MVP B tách `Staff` qua quyền vận hành có sẵn. Một cửa hàng, không Seller/Shop/multi-vendor. AI FastAPI tách riêng sau, không chặn đơn hàng. **Chưa khởi tạo code.**

## Trước lần code đầu
- [ ] Duyệt PRD/M0 và thông tin rubric ảnh hưởng scope (`tracking/OPEN_QUESTIONS.md`).
- [ ] Duyệt architecture/ERD/RBAC/API contract tối thiểu ở M1.
- [ ] Chọn ORM (Prisma hoặc TypeORM), phiên bản Node/Nest và auth strategy; ghi ADR.
- [ ] Xác nhận tên task M2 tương ứng và phê duyệt phạm vi scaffold.
- [ ] Thiết lập MySQL local + Docker nếu có điều kiện; cấu hình `.env` local riêng, **không commit secret**.

## Phong cách code
- Chia module theo nghiệp vụ (`auth`, `users`, `catalog`, `inventory`, `cart`, `orders`, `payments`, `reviews`, `admin`). Đây là tên **dự kiến**, không phải file đã tồn tại.
- Tách Controller (HTTP) → DTO/validation → Service (business rule) → persistence/ORM; không nhét nghiệp vụ vào controller.
- Global prefix, validation, error format, time zone, money representation thống nhất theo contract.
- Cập nhật price/stock/order ở server; transaction MySQL InnoDB, unique/FK/index, chống overselling và idempotency.
- Quyền backend kiểm tra server-side; customer không xem/sửa đơn của người khác; staff chỉ hoạt động sau MVP B.
- Unit/integration test khi triển khai feature; có test lỗi, quyền, transaction cho tác vụ nhạy cảm.
- Không tự thêm Redis, queue, microservices, cloud payments, công cụ trả phí nếu chưa có nhu cầu/approval.

## Mỗi lần Codex code
**Trước:** nêu task ID, acceptance, kiến thức, file dự kiến tạo/sửa, config/ORM/migration/test, rủi ro và chờ xác nhận.

**Sau:** dùng Git và đọc file thật; phân loại CREATED / MODIFIED / RELATED_UNCHANGED / CONFIG / MIGRATION / TEST, truy vết request, ghi API/MySQL/exception/test; cập nhật `learning/features/<TASK-ID>.md`, `FEATURE_MAP.md`, `KNOWLEDGE_INDEX.md` (mức học do người dùng xác nhận). Ghi các câu hỏi phỏng vấn và một bài tập nhỏ.

**Bàn giao:** `tracking/WORKLOG.md` + `CURRENT_STATE.md`; chỉ tick TASKS khi đủ acceptance và evidence. Không tự chuyển task hoặc tuyên bố đã triển khai.
