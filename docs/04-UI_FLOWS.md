# UI Flows v0.2 — Customer + Admin trước, Staff sau

## Guest và Customer MVP A

1. Guest tìm kiếm/lọc catalog ACTIVE, mở chi tiết sản phẩm và xem size/màu. Luồng demo chuyển sang đăng ký/đăng nhập trước giỏ hàng. Giỏ Guest chờ Q03.
2. Customer chọn biến thể và số lượng, mở giỏ, chọn địa chỉ rồi checkout COD mô phỏng. UI xác nhận đơn và cho xem lịch sử/chi tiết đơn của mình.
3. Customer có thể hủy đơn của mình khi PENDING. Sau DELIVERED, Customer có thể đánh giá một lần trên mỗi dòng hàng đã mua.
4. Hồ sơ và địa chỉ giới hạn theo Customer đã đăng nhập. Luồng đăng nhập, hết phiên và lỗi tác vụ được kiểm tra theo AC-03 và AC-13. Chính sách phiên đã chốt trong [ADR-0003](adr/0003-auth-session.md).

COD là luồng P0. Gateway mock/sandbox thuộc P1 và chờ Q05.

### Bàn giao wireframes Customer Android/Web (M1-09)

Android và Web có cùng điểm đến trong luồng mua. Antigravity thiết kế bố cục phù hợp từng nền tảng và hiển thị các trạng thái dưới đây. Tên thao tác trong bảng là `operationId` của [OpenAPI v1.0.0](../contracts/openapi.yaml).

| Màn hình và thao tác | API | Đang tải hoặc gửi | Rỗng và lỗi |
|---|---|---|---|
| Catalog, tìm kiếm, lọc và phân trang | `listCategories`, `listProducts` | Giữ bộ lọc khi tải, hiển thị trạng thái tải lần đầu hoặc tải thêm | Kết quả rỗng cho phép xóa bộ lọc. Lỗi tải cho phép thử lại với truy vấn hiện tại. |
| Chi tiết, chọn size/màu và đọc đánh giá | `getProduct`, `listProductReviews`, `addCartItem` | Tách trạng thái tải chi tiết và đánh giá. Khi thêm giỏ, báo tiến trình của nút | Chưa có đánh giá thì hiện trạng thái rỗng. Biến thể hết tồn bị vô hiệu hóa. `404` chi tiết dẫn về catalog. Khi thêm giỏ trả `OUT_OF_STOCK`, tải lại chi tiết. Guest chuyển sang đăng nhập trước khi thêm. |
| Đăng ký, đăng nhập và hồ sơ | `registerCustomer`, `loginAndroid`, `loginWeb`, `getMe`, `readWebCsrf`, `logout` | Báo đang gửi biểu mẫu và đang tải phiên khi mở trang | Form rỗng chờ nhập. Hiển thị lỗi trường, thông tin đăng nhập không hợp lệ và giới hạn tần suất. Khi phiên hết hạn ở màn hình riêng, chuyển về đăng nhập và giữ đích điều hướng. |
| Địa chỉ và chọn địa chỉ giao | `listAddresses`, `createAddress`, `updateAddress` | Phân biệt tải danh sách với lưu biểu mẫu | Chưa có địa chỉ thì mở luồng thêm địa chỉ. Lỗi lưu giữ dữ liệu nhập. Nếu địa chỉ không còn truy cập được, tải lại danh sách và chọn lại. |
| Giỏ hàng | `getCart`, `setCartItemQuantity`, `removeCartItem` | Chặn gửi lặp thao tác đang chạy trên dòng giỏ | Giỏ rỗng có nút về catalog. Nếu số lượng vượt tồn, giữ số lượng server xác nhận và cho sửa lại. Sau xóa thành công, cập nhật giỏ theo dữ liệu server. |
| Xác nhận checkout COD | `getCart`, `listAddresses`, `checkoutCod` | Hiện tóm tắt địa chỉ, dòng hàng, phí và tổng; ghi rõ COD mô phỏng. Khóa nút đặt hàng khi request đang chạy | Giỏ rỗng quay về giỏ, thiếu địa chỉ chuyển sang thêm địa chỉ. Khi chưa biết kết quả do mất phản hồi, thử lại cùng `Idempotency-Key` và body. `200` replay và `201` đều dẫn đến cùng màn hình xác nhận đơn. Khi `CART_CHANGED` hoặc `OUT_OF_STOCK`, tải lại giỏ để khách xác nhận ý định mới. Khi `IDEMPOTENCY_CONFLICT`, dừng retry key đó và nhắc kiểm tra lịch sử đơn trước khi đặt lại. |
| Lịch sử, chi tiết và hủy đơn | `listMyOrders`, `getMyOrder`, `cancelMyOrder` | Có trạng thái tải lần đầu, tải thêm và đang hủy | Lịch sử rỗng có đường về catalog. `404` chi tiết không tiết lộ thông tin đơn, cho quay lại lịch sử. Chỉ hiển thị thao tác hủy với đơn `PENDING`. Khi `INVALID_ORDER_STATE`, tải lại trạng thái đơn. |
| Đánh giá dòng hàng | `getMyOrder`, `createReview` | Khóa gửi lặp trong lúc gửi và hiện kết quả sau khi nhận phản hồi | Chỉ mở form cho dòng hàng thuộc đơn `DELIVERED`. Form cần điểm nguyên 1–5 và nội dung. `REVIEW_ALREADY_EXISTS` báo dòng hàng đã được đánh giá. `REVIEW_NOT_ELIGIBLE` ngăn gửi lại và cho quay về chi tiết đơn. |

**Quy ước chung.** Web dùng cookie và CSRF theo ADR-0003. Android dùng bearer. Khi Web nhận `CSRF_INVALID`, lấy lại CSRF token và để người dùng chủ động thử lại. Với checkout chưa rõ kết quả, giữ nguyên key và body. Khi thiếu quyền, hiển thị thông báo phù hợp và giữ dữ liệu riêng tư. Dùng `code` để phân nhánh, giữ `requestId` khi cần hỗ trợ.

**Giới hạn contract cần thể hiện trên wireframe.** `getMyOrder` không cung cấp cờ đã đánh giá cho từng dòng. UI có thể nhớ kết quả tạo thành công trong phiên hiện tại. Sau reload, server vẫn quyết định và có thể trả `REVIEW_ALREADY_EXISTS`. Nếu cần ẩn nút đánh giá chính xác ngay khi mở lại đơn, cần duyệt thay đổi contract riêng. Q03 về giỏ Guest vẫn mở.

**Kiểm tra khi nhận wireframes.** Antigravity bàn giao bản Android và Web theo bảng trên, kèm màn hình hoặc frame thể hiện trạng thái đang tải, rỗng và lỗi khi áp dụng. Đối chiếu riêng ba ca dễ bỏ sót: checkout mất phản hồi, trạng thái đơn đổi trước khi hủy và gửi review trùng.

## Admin MVP A

1. Admin đăng nhập bằng tài khoản được tạo theo quy trình nội bộ, sau đó quản lý danh mục, sản phẩm, biến thể và ảnh.
2. Admin điều chỉnh tồn với lý do và mở hàng đợi đơn. Admin xử lý theo trạng thái cho đến khi giao thành công và xác nhận thu COD mô phỏng. Admin có thể hủy trước SHIPPING, kèm lý do.
3. Admin ẩn hoặc hiện lại đánh giá, kiểm tra audit, và quản lý trạng thái tài khoản.

Danh sách sản phẩm, tồn kho, đơn hàng, đánh giá và tài khoản đủ cho luồng P0. Dashboard thuộc P1, chờ đối chiếu rubric Q02/Q15.

## Staff MVP B

Admin tạo tài khoản và cấp quyền → Staff đăng nhập → xử lý đơn hoặc điều chỉnh tồn nếu có quyền tương ứng. Tác vụ thiếu quyền bị từ chối. Quản lý tài khoản và cấp quyền vẫn thuộc Admin. Theo Q10 đã chốt, Staff chỉ sửa mô tả hoặc ảnh khi được cấp quyền. Tạo, xóa, xuất bản và đổi giá thuộc Admin.

### Handoff wireframes Admin Web-first và Staff tương lai (M1-10)

Tên thao tác Admin dưới đây là `operationId` trong [OpenAPI MVP A](../contracts/openapi.yaml). Wireframes ưu tiên Web. Việc dùng chung Expo Web hay tách ứng dụng quản trị vẫn theo Q14.

| Màn hình Admin MVP A | API | Điều hướng và trạng thái cần thể hiện |
|---|---|---|
| Đăng nhập và vào khu vực quản trị | `loginWeb`, `getMe`, `readWebCsrf`, `logout` | Khi vào trực tiếp URL quản trị, chờ xác minh phiên và vai trò trước khi tải dữ liệu. Hết phiên chuyển về đăng nhập. Customer đã đăng nhập thấy thông báo từ chối và đường về khu Customer. |
| Catalog và chi tiết sản phẩm | `listAdminCategorys`, `listAdminProducts`, `listAdminVariants`, `listAdminImages` | Có trạng thái tải, rỗng, lỗi và thử lại. Form danh mục, sản phẩm, biến thể và ảnh dùng các thao tác CRUD tương ứng. Ảnh dùng `storageKey` hiện có. Upload chưa có contract được duyệt. |
| Tồn kho theo biến thể | `listInventoryAdjustments`, `adjustInventory` | Thể hiện lịch sử rỗng và lỗi tải riêng với lỗi ghi. Điều chỉnh yêu cầu số lượng thay đổi và lý do. Nếu server từ chối, giữ dữ liệu nhập và tải lại tồn trước khi người dùng thử lại. |
| Danh sách và chi tiết đơn | `listAdminOrders`, `getAdminOrder`, `advanceAdminOrder`, `cancelAdminOrder`, `confirmDeliveryAndCod` | Chỉ hiện thao tác hợp lệ theo trạng thái hiện có. Hủy trước SHIPPING và yêu cầu lý do. Từ SHIPPING, xác nhận giao và thu COD mô phỏng. Nếu trạng thái đã đổi trên server, tải lại đơn. |
| Kiểm duyệt đánh giá | `listAdminReviews`, `moderateReview` | Có bộ lọc hiển thị/ẩn và trạng thái danh sách rỗng. Xác nhận thay đổi, giữ nguyên nội dung đánh giá và làm rõ backend ghi audit. |
| Trạng thái tài khoản | `listAdminUsers`, `setAccountStatus` | MVP A cho phép quản lý trạng thái Customer. Thể hiện bước xác nhận và lỗi thao tác. Quy trình nội bộ tạo Admin nằm ngoài màn hình này. |

**Quy tắc điều hướng.** Khi mở URL trực tiếp hoặc tải lại trang, UI kiểm tra phiên và quyền trước khi hiển thị nội dung. Với `401`, quay về đăng nhập và kiểm tra lại quyền trước khi mở đích cũ. Với `403 FORBIDDEN`, dừng thao tác và đưa người dùng về khu vực được phép. Với `CSRF_INVALID`, lấy lại token và cho người dùng chủ động thử lại. Backend kiểm tra quyền ở mọi request, kể cả request gửi trực tiếp.

| Wireframe Staff MVP B | Quyền theo RBAC v1 | Tình huống cần review |
|---|---|---|
| Danh sách và chi tiết đơn | `orders.read` | Tài khoản chỉ có `orders.process` không được mở danh sách hoặc chi tiết. Chỉ trả dữ liệu giao hàng cần cho tác vụ được cấp. |
| Xử lý trạng thái đơn | `orders.process` | Có quyền đọc chưa đủ để cập nhật. Tài khoản chỉ được xử lý đơn chỉ thấy tác vụ được cấp khi có đầu vào từ luồng MVP B được duyệt. |
| Điều chỉnh tồn | `inventory.adjust` | Yêu cầu lý do. Nếu vừa bị thu hồi quyền, request kế tiếp bị từ chối và UI bỏ hành động tương ứng. |
| Nội dung catalog | `catalog.content.edit` | Chỉ sửa mô tả và ảnh. Đổi giá, tạo, xóa và xuất bản dành cho Admin. |
| Tài khoản, cấp quyền và kiểm duyệt | Admin | URL trực tiếp của Staff phải dẫn tới trạng thái bị từ chối. |

Staff là wireframe tương lai. Dùng tên quyền để mô tả, vì OpenAPI v1.0.0 chỉ bao phủ MVP A. Khi nhận bản vẽ, review riêng URL trực tiếp, phiên hết hạn, sai vai trò và quyền vừa thu hồi.

## State design checklist
- [ ] Loading/empty/error/retry cho list/detail.
- [ ] Image placeholders/lazy loading và media size giới hạn.
- [ ] Disabled out-of-stock variant; checkout revalidates server.
- [ ] Session expired/403 → hướng dẫn thích hợp, không rò thông tin.
- [ ] Double-tap checkout an toàn cả client và server.
- [ ] COD hiển thị rõ là mô phỏng. Gateway mock/sandbox cũng có nhãn mô phỏng nếu được duyệt.
- [ ] Error reviews khi chưa đủ điều kiện DELIVERED.
- [ ] AI `TRYON_ENABLED=false`: giấu tính năng/coming soon trung thực.
- [ ] Demo Customer trên Android và Web theo phạm vi dự kiến. Đối chiếu nền tảng và yêu cầu iOS với Q02.

## Phân chia nền tảng
Customer mobile-first Android/Web. Admin và Staff Web-first nhưng ưu tiên cùng codebase Expo nếu spike xác nhận đáp ứng tương tác quản lý. Nếu tách admin web về sau cần ADR + phê duyệt; không tự thêm framework.
