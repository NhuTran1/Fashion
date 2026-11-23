# ADR-0004 — Ảnh sản phẩm lưu local và COD mô phỏng

**Trạng thái ACCEPTED.** Chủ dự án nghiệm thu M1-11 ngày 2026-11-20. [Bằng chứng nghiệm thu](../../tracking/WORKLOG.md#2026-11-20--m1-11--nghiệm-thu).

## Bối cảnh

MVP A ưu tiên demo local với ngân sách 0 đồng. Admin cần quản lý ảnh catalog, còn Customer cần checkout và theo dõi thanh toán. [PRD v1](../01-PRD.md) đặt COD mô phỏng ở P0 và gateway mock/sandbox ở P1. [Architecture v1](../02-ARCHITECTURE.md) đã dành interface `ImageStorage` cho ảnh sản phẩm.

## Q08 — Lưu ảnh sản phẩm

- Dùng filesystem local qua `ImageStorage` cho dev/demo. Thư mục dữ liệu được cấu hình riêng khỏi thư mục build và giữ qua lần khởi động lại. Nếu chạy trong container, dùng volume bền vững cho thư mục này. MySQL lưu `storageKey` và metadata, ảnh nằm trên filesystem.
- Backend phục vụ ảnh công khai qua URL của API có thể truy cập từ Android/Web. Dùng khóa do server sinh và chỉ phục vụ file thuộc vùng lưu cấu hình. Ảnh được công bố theo chính sách hiển thị catalog. Dữ liệu ảnh thử đồ riêng tư nằm ngoài ADR này.
- Khi có luồng upload, chỉ cho vai trò có quyền tương ứng. Kiểm tra nội dung file thật và kích thước trước khi lưu. Danh sách định dạng, giới hạn dung lượng và contract upload phải được duyệt trước tích hợp. OpenAPI v1.0.0 hiện nhận `storageKey` của ảnh đã có. Demo có thể dùng bộ ảnh mẫu có quyền sử dụng, được chuẩn bị sẵn.
- Hệ quả: triển khai local đơn giản, nhưng sao lưu cần giữ cả file và metadata. Khi cần chia sẻ ảnh giữa nhiều instance hoặc deploy công khai, xem xét object storage và duyệt phương án riêng.

## Q05 — Thanh toán MVP A

- MVP A chỉ hỗ trợ **COD mô phỏng**. Checkout tạo đơn và bản ghi COD `UNPAID`. Admin xác nhận giao thành công và thu tiền mô phỏng qua `confirmDeliveryAndCod`. Đơn chuyển từ `SHIPPING` sang `DELIVERED`, thanh toán chuyển `PAID` trong cùng giao dịch. Đơn hủy trước khi thu vẫn `UNPAID`. Gửi lại xác nhận đã thành công giữ nguyên kết quả.
- UI ghi rõ COD mô phỏng. MVP A không thu tiền thật, thông tin thẻ hay tích hợp callback gateway. Gateway mock/sandbox nằm ở P1 và cần quyết định riêng trước khi chọn provider hoặc chốt callback.

## Bằng chứng cần thu khi triển khai

| Phạm vi | Ca kiểm chứng dự kiến |
|---|---|
| Storage local | Seed ảnh và mở từ Android/Web. Khởi động lại backend hoặc container, ảnh vẫn đọc được. Kiểm tra key không hợp lệ, ảnh không tồn tại và ảnh chưa công bố. Khi có upload, kiểm tra quyền và từ chối file sai loại hoặc vượt giới hạn đã duyệt. |
| COD mô phỏng | Checkout tạo COD `UNPAID`. Admin giao thành công chuyển `DELIVERED` và `PAID`. Thử lỗi giữa chừng để kiểm tra rollback, xác nhận lặp để kiểm tra một lần ghi nhận, và hủy trước thu để kiểm tra trạng thái `UNPAID`. |

ADR là thiết kế. Kiểm thử upload, MySQL, Android/Web và ứng dụng **NOT RUN**.
