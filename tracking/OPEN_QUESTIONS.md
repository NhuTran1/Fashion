# OPEN_QUESTIONS — quyết định trước implementation

Không cần trả lời mọi câu cùng lúc; ưu tiên các câu ảnh hưởng M0 và gateway. Ô trạng thái dùng OPEN cho câu hỏi còn mở và RESOLVED cho quyết định đã có xác nhận.

| ID | Vấn đề cần duyệt | Đề xuất hoặc quyết định đã duyệt | Status |
|---|---|---|---|
| Q01 | Deadline bảo vệ, giờ làm/tuần? | Mục tiêu nội bộ là hoàn thành phần cơ bản vào ngày 27, khoảng 10 giờ/ngày và có thể linh hoạt. Hạn chính thức chưa có. [Quyết định tiếp tục M1](WORKLOG.md#2026-11-20--m0-07--phê-duyệt-prd-v1-và-m0-gate). | OPEN |
| Q02 | Rubric yêu cầu Android/Web/iOS và AI tới mức nào? | Android + Web là phạm vi demo tạm thời đã được duyệt. Rubric và yêu cầu chính thức về nền tảng hoặc AI còn chờ. [Phê duyệt M0 gate](WORKLOG.md#2026-11-20--m0-07--phê-duyệt-prd-v1-và-m0-gate). | OPEN |
| Q03 | Guest có giỏ hàng không? | Guest browse only, login để cart/checkout | OPEN |
| Q04 | Hủy đơn, hoàn tồn, phí giao hàng, COD và hoàn tiền? | Customer hủy đơn mình ở PENDING, Admin hủy trước SHIPPING kèm lý do. Hoàn tồn đúng một lần trong giao dịch hủy. Phí giao demo 0 đồng. COD chuyển PAID khi Admin xác nhận giao và thu tiền mô phỏng, hủy trước thu giữ UNPAID. Trả hàng/hoàn tiền sau P0. Nguồn: [phê duyệt M0-05](WORKLOG.md#2026-11-20--m0-05--quy-tắc-đơn-hàng-và-đánh-giá). | RESOLVED |
| Q05 | Thanh toán sandbox của provider nào/có đủ điều kiện đăng ký? | Chốt COD mô phỏng duy nhất cho MVP A. Mock/sandbox thuộc P1, chờ quyết định riêng. [ADR-0004](../docs/adr/0004-image-storage-and-payment.md) đã nghiệm thu. | RESOLVED |
| Q06 | ORM NestJS + MySQL? | Chủ dự án đã chọn Prisma ORM 7 + MySQL InnoDB, migration có phiên bản. [ADR-0002](../docs/adr/0002-orm.md) đã được [nghiệm thu](WORKLOG.md#2026-11-20--m1-02--nghiệm-thu). | RESOLVED |
| Q07 | Auth mobile/web, refresh/session/cookie? | Chủ dự án chọn phiên lưu phía server, Android dùng bearer qua SecureStore, Web dùng cookie HttpOnly và bảo vệ CSRF. [ADR-0003](../docs/adr/0003-auth-session.md) đã nghiệm thu. | RESOLVED |
| Q08 | Ảnh upload local/demo/cloud? | Chốt filesystem local qua ImageStorage cho dev/demo. MySQL lưu storageKey và metadata. Contract upload sẽ được duyệt riêng. [ADR-0004](../docs/adr/0004-image-storage-and-payment.md) đã nghiệm thu. | RESOLVED |
| Q09 | Chính sách đánh giá? | Một review 1–5 trên mỗi order_item của Customer khi đơn DELIVERED. Customer tạo review ở P0, sửa/xóa sau P0. Admin ẩn/hiện lại có audit. Nguồn: [phê duyệt M0-05](WORKLOG.md#2026-11-20--m0-05--quy-tắc-đơn-hàng-và-đánh-giá). | RESOLVED |
| Q10 | Staff CRUD product đến đâu, đổi giá hay không? | Phương án đã duyệt: quyền đơn/tồn cấp riêng, catalog chỉ sửa mô tả và ảnh khi được cấp quyền. Tạo, xóa, xuất bản và đổi giá thuộc Admin. [RBAC v1](../docs/06-RBAC.md) đã nghiệm thu | RESOLVED |
| Q11 | Demo có bắt buộc public internet? | Local+test devices trước, không mặc định free hosting | OPEN |
| Q12 | Thành viên thứ hai nhận việc ở milestone nào? | Solo-first; phân tách sau khi có API contract | OPEN |
| Q13 | Dữ liệu thật, chính sách bảo mật/privacy? | Demo synthetic data, ảnh AI có consent/retention | OPEN |
| Q14 | Admin/Staff UI Expo Web hay web app riêng? | Expo Web-first để giảm số codebase; spike usability | OPEN |
| Q15 | Dashboard và wishlist là P0 hay P1 theo rubric? | Dashboard nhẹ P1, wishlist P1 | OPEN |

**Xác nhận từ người dùng (không cần hỏi lại):** Expo + NestJS + MySQL; single-vendor; Customer + Admin trước, Staff sau; AI tương lai FastAPI/Colab; free/local, solo-first.
