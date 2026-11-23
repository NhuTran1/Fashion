# RBAC & Authorization v1 — Customer / Staff / Admin

> Tình trạng **APPROVED**, đã nghiệm thu M1-04 ngày 2026-11-20. MVP A có tài khoản **Customer + Admin** và khách chưa đăng nhập (**Guest**). MVP B bổ sung tài khoản **Staff** với quyền do Admin cấp.

## Phạm vi
- `GUEST` (MVP A): xem catalog ACTIVE công khai khi chưa đăng nhập. Giỏ hàng cho Guest chờ quyết định Q03.
- `CUSTOMER` (MVP A): đăng ký công khai, mua hàng và truy cập giỏ hàng, địa chỉ, đơn hàng, đánh giá của chính mình theo quy tắc nghiệp vụ.
- `ADMIN` (MVP A): tài khoản khởi tạo theo quy trình nội bộ có kiểm soát. Admin quản lý catalog, tồn kho, đơn hàng, trạng thái tài khoản và kiểm duyệt đánh giá của cửa hàng.
- `STAFF` (MVP B): tài khoản do Admin tạo và cấp quyền. Staff chỉ thực hiện tác vụ vận hành đã được cấp và bị chặn quyền quản lý tài khoản hoặc phân quyền. Phạm vi catalog theo Q10 được ghi trong ma trận dưới đây.
- Single-vendor: **không có SELLER**, không có shop ownership hoặc multi-tenant isolation. Quan hệ owner chỉ dùng cho tài nguyên khách (orders, addresses, carts, reviews).

## Ma trận quyền

Staff chỉ hoạt động ở MVP B. Mỗi quyền Staff phải do Admin cấp riêng cho tài khoản. Thao tác không được cấp bị từ chối mặc định.

| Thao tác | Guest | Customer | Staff MVP B | Admin |
|---|---|---|---|---|
| Xem catalog ACTIVE | Có | Có | Có | Có |
| Giỏ hàng và checkout | Giỏ chờ Q03 | Của mình | — | — |
| Hồ sơ, địa chỉ, đơn hàng và đánh giá cá nhân | — | Của mình, theo quy tắc nghiệp vụ | — | — |
| Sửa mô tả hoặc ảnh | — | — | catalog.content.edit | Có |
| Tạo, xóa, xuất bản sản phẩm hoặc đổi giá | — | — | — | Có |
| Xem đơn cửa hàng | — | — | orders.read | Có |
| Xử lý trạng thái đơn | — | — | orders.process | Có |
| Điều chỉnh tồn có lý do và audit | — | — | inventory.adjust | Có |
| Kiểm duyệt đánh giá | — | — | — | Có |
| Quản lý tài khoản, cấp và thu hồi quyền Staff | — | — | — | Có |
| Tạo Admin | — | — | — | Quy trình nội bộ có kiểm soát |
| Cấu hình thanh toán/cửa hàng | — | — | — | Có |
| Dashboard P1 | — | — | — | Theo phạm vi P1 |

Quyền xử lý đơn không tự cấp quyền đọc danh sách hoặc chi tiết đơn. Khi tác vụ được phép cần dữ liệu giao hàng, chỉ trả các trường cần thiết và ghi audit truy cập. Trả lời đánh giá nằm ngoài bộ quyền Staff cơ sở này và cần duyệt riêng nếu triển khai.

## Thực thi

- Backend định nghĩa danh sách quyền cố định, lưu quyền được cấp theo từng Staff. Kiểm tra phiên theo ADR-0003 và đọc quyền hiện hành khi xử lý request. Thu hồi quyền có hiệu lực ở request kế tiếp.
- Guard/policy kiểm tra quyền thao tác. Service kiểm tra ownership của tài nguyên Customer, giới hạn trường dữ liệu và thực thi các quy tắc trạng thái đơn/tồn. Admin và Staff dùng chung service nghiệp vụ theo quyền.
- Ghi audit cho cấp/thu hồi quyền, chỉnh tồn, thao tác quản trị và truy cập thông tin giao hàng của Staff. Thiết kế bảng và API thuộc M1-05/M1-08.

## Ca kiểm thử dự kiến

| Tình huống | Kỳ vọng |
|---|---|
| Guest truy cập API riêng | 401 |
| Customer gọi thao tác Admin hoặc gửi trường role trong đăng ký | Từ chối thao tác quản trị, không cấp quyền qua đăng ký |
| Customer A đọc đơn hoặc địa chỉ của Customer B | Từ chối theo contract, không trả dữ liệu |
| Staff chỉ có orders.process xử lý đơn hợp lệ rồi thử chỉnh tồn hoặc xem danh sách đơn | Xử lý hợp lệ thành công. Hai thao tác thiếu quyền trả 403 |
| Staff có catalog.content.edit thử sửa mô tả/ảnh, đổi giá hoặc xuất bản | Sửa mô tả/ảnh hợp lệ thành công. Thao tác vượt quyền bị từ chối, dữ liệu giữ nguyên |
| Staff thử quản lý tài khoản hoặc cấp quyền | 403, không có thay đổi quyền |
| Admin thu hồi inventory.adjust rồi Staff gửi request chỉnh tồn | Request kế tiếp trả 403, tồn kho giữ nguyên |
| Admin hoặc Staff có quyền chỉnh tồn | Thay đổi hợp lệ có lý do và audit |

Các ca trên đang NOT RUN.
