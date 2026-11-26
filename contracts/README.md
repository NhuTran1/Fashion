# API contract MVP A

[OpenAPI 3.0.3](openapi.yaml) v1.1.0 bổ sung upload và đọc ảnh đã duyệt ở M4-06 trên contract v1.0.0 của M1-08. File dùng cú pháp JSON tương thích YAML.

- Admin upload một trường multipart `file` qua `POST /admin/products/{productId}/images/upload`. JPEG/PNG tối đa 5 MiB và 16 megapixel. Dùng `Image.url` trong response để hiển thị hoặc xem trước. Cấu hình `PRODUCT_IMAGE_DIR` trỏ tới kho file local.

- Web đăng nhập qua `POST /auth/web/login`, nhận cookie phiên và CSRF token. Sau reload, gọi `GET /auth/csrf`. Gửi `X-CSRF-Token` trên các thao tác ghi có cookie. Customer Android dùng `POST /auth/login`, sau đó gửi opaque bearer token. Hết phiên thì đăng nhập lại.
- ID là chuỗi số, tiền là chuỗi Decimal hai chữ số thập phân. Danh sách phân trang dùng `items/page/pageSize/total`. API công khai chỉ trả tài nguyên hiển thị theo chính sách.
- Dùng `Idempotency-Key` và giữ nguyên body khi gửi lại checkout. `201` là tạo đơn, `200` là replay, `409` cho xung đột. Giá và tổng do server tính.
- Lỗi chung gồm `code`, `message`, `requestId` và `details` tùy chọn. Client phân nhánh dựa trên `code`. Phiên thiếu/hết hạn trả `401`; thiếu quyền hoặc CSRF sai trả `403`; tài nguyên riêng không thuộc người gọi trả `404`.
- Antigravity dùng contract sau khi được duyệt để dựng client, kiểu và mock. Các ví dụ login, checkout, replay và moderation nằm trong OpenAPI. Mỗi màn hình cần kiểm thử các trạng thái loading, rỗng và lỗi phù hợp. Q03 và Q08 còn mở; tài liệu chưa chốt guest cart hay cơ chế upload.

## Handoff M1-09 — Customer Android/Web

[Bảng màn hình, API và trạng thái](../docs/04-UI_FLOWS.md#bàn-giao-wireframes-customer-androidweb-m1-09) là đầu vào cho wireframes Antigravity. Dùng các `operationId` của OpenAPI v1.0.0 cho mock. Bàn giao cả hai nền tảng với các trạng thái loading, rỗng và lỗi tương ứng. Chờ wireframes để review theo checklist M1-09.

## Handoff M1-10 — Admin Web-first và Staff tương lai

[Bảng màn hình và điều hướng theo quyền](../docs/04-UI_FLOWS.md#handoff-wireframes-admin-web-first-và-staff-tương-lai-m1-10) là đầu vào wireframes Antigravity. Admin dùng OpenAPI v1.0.0. Staff MVP B dùng các tên quyền trong [RBAC v1](../docs/06-RBAC.md) để thiết kế wireframes, chờ contract API cho MVP B. Khi bàn giao, kèm ca truy cập URL trực tiếp, hết phiên, sai vai trò và quyền vừa thu hồi.

## Handoff M2-01 — Shell Expo TypeScript

Antigravity phụ trách scaffold Expo TypeScript trong `apps/mobile`, đăng ký package trong npm workspace `apps/*` và khai báo script `start` để root chạy `npm run start --workspace apps/mobile`. Dùng cùng package manager và cập nhật `package-lock.json` tại root khi thêm dependency của app. Ghi riêng bằng chứng Expo/Metro khởi động và kết quả mở shell trên Android hoặc Web nếu đã thử.

M2-01 chỉ yêu cầu shell khởi động. Kết nối API client là M2-08. Để kiểm tra kết nối API, gọi `GET /api/v1/health` trên API origin của môi trường. Route công khai trả HTTP `200` với `{"status":"ok"}` khi tiến trình NestJS phản hồi. MySQL có healthcheck Docker riêng. OpenAPI v1.0.0 tiếp tục là contract cho các route nghiệp vụ.
