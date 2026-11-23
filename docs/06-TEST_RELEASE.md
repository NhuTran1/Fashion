# Test / Security / Release Plan v0.2 (chưa chạy)

## Điều kiện Done
- Task có acceptance rõ ràng, test thực chạy hoặc lý do NOT RUN, review diff/secret, evidence ghi WORKLOG.
- Milestone gate có demo + test log + user approval.
- Không tự ghi PASS/benchmark khi chưa chạy.

## Ma trận nghiệm thu AC-01 đến AC-14

Các ca dưới đây là đặc tả chờ triển khai. Dùng dữ liệu demo giả. Bằng chứng nêu trong bảng được thu khi kiểm thử ứng dụng.

| AC | Điều kiện đầu vào | Thao tác | Kết quả mong đợi | Bằng chứng cần thu |
|---|---|---|---|---|
| AC-01 | Catalog có sản phẩm ACTIVE, không ACTIVE và đủ dữ liệu phân trang | Mở catalog với vai trò Guest/Customer, lọc qua nhiều trang, thử kết quả rỗng và lỗi tải | Chỉ ACTIVE xuất hiện trong catalog công khai. Kết quả đúng bộ lọc/trang. UI có loading, empty và error | Kết quả API và ảnh các trạng thái UI |
| AC-02 | Customer đăng nhập, sản phẩm có nhiều SKU và tồn đã biết | Thêm một size/màu hợp lệ. Thử số lượng 0, quá tồn và gửi giá client khác giá catalog trong kiểm thử API | Cart lưu đúng SKU và số lượng hợp lệ. Server từ chối số lượng sai và dùng giá catalog | Kết quả API, cart và dữ liệu catalog đối chiếu |
| AC-03 | Hai Customer, mỗi người có hồ sơ và địa chỉ riêng | Đăng ký/đăng nhập, mở hồ sơ, thử phiên hết hạn và kiểm tra chính sách truy cập chéo trong integration test | Mật khẩu lưu hash. Phiên hết hạn và truy cập chéo bị từ chối. Hồ sơ/địa chỉ người khác giữ nguyên | Kết quả kiểm thử auth, ownership và phép kiểm tra hash đã che dữ liệu |
| AC-04 | Giá server biết trước, phí giao 0 đồng, có đơn nhiều SKU | Checkout, thử lặp cùng yêu cầu/key, rồi thử checkout có SKU thiếu tồn | Snapshot đúng giá server. Lặp tạo một đơn. Checkout thiếu tồn không lưu đơn/dòng hàng hay thay đổi tồn | Kết quả integration test và đối chiếu trước/sau các bản ghi |
| AC-05 | Một SKU còn đúng một sản phẩm, hai Customer có checkout hợp lệ | Gửi hai checkout đồng thời | Đúng một đơn thành công, tồn cuối bằng 0 | Kết quả test đồng thời, số đơn và tồn cuối |
| AC-06 | Hai đơn COD chưa thu. Sandbox callback chỉ có khi Q05 được duyệt | Admin giao và xác nhận thu mô phỏng đơn thứ nhất, hủy hợp lệ đơn thứ hai. Nếu có sandbox callback, kiểm tra chữ ký và callback lặp | Đơn giao và thu thành PAID, đơn hủy giữ UNPAID. Callback không hợp lệ bị từ chối, callback lặp không ghi nhận thêm | Trạng thái order/payment và log kiểm thử callback nếu áp dụng |
| AC-07 | Đơn ở PENDING, CONFIRMED, PACKING và SHIPPING, có hai Customer | Kiểm tra đọc/hủy theo chủ đơn, Admin hủy trước SHIPPING, thử chuyển sai bước, hủy lặp và hủy cạnh tranh chuyển SHIPPING | Áp đúng vai trò và trạng thái. Hủy thành công chỉ hoàn tồn một lần và có bản ghi biến động | Kết quả kiểm thử quyền, trạng thái cuối và số lần hoàn tồn |
| AC-08 | Admin và Customer, một SKU đã tồn tại | Admin CRUD catalog, thử SKU trùng và điều chỉnh tồn có lý do. Kiểm tra Customer bị từ chối thao tác quản trị | CRUD hợp lệ thành công, SKU trùng bị từ chối. Điều chỉnh hợp lệ có inventory movement và lý do | Kết quả API, SKU và bản ghi biến động tồn |
| AC-09 | Dòng mua đã giao, dòng chưa giao và dòng của Customer khác | Tạo review hợp lệ, thử review trùng, sai chủ, sai sản phẩm và điểm ngoài 1–5 | Mỗi dòng hợp lệ có tối đa một review. Các trường hợp sai bị từ chối | Kết quả kiểm thử và số review theo order_item |
| AC-10 | Có review công khai và Admin có quyền kiểm duyệt | Admin ẩn rồi hiện lại review | Hiển thị đổi đúng, nội dung gốc giữ nguyên, có audit người thao tác, hành động và thời điểm | Kết quả API/ảnh UI và hai bản ghi audit |
| AC-11 | Có luồng đăng ký công khai và Admin có quyền quản lý trạng thái tài khoản | Kiểm tra quy tắc chỉ tạo tài khoản Customer qua đăng ký. Admin đổi trạng thái một tài khoản demo | Đăng ký công khai không cấp quyền Admin. Thay đổi quản trị hợp lệ có audit | Kết quả kiểm thử quyền và bản ghi audit |
| AC-12 | MVP B, Staff chỉ được cấp quyền xử lý đơn | Staff xử lý đơn trong phạm vi được cấp. Kiểm thử từ chối điều chỉnh tồn, quản lý tài khoản/quyền và thao tác ngoài phạm vi tài nguyên | Tác vụ được cấp và trong phạm vi được phép. Tác vụ thiếu quyền trả 403. Thao tác ngoài phạm vi bị từ chối theo contract | Log kiểm thử ủy quyền và trạng thái đơn/tồn |
| AC-13 | Customer Android và Web theo Q02, Admin Web, có SKU đủ tồn | Trên từng nền tảng, duyệt catalog, thêm giỏ, checkout COD, xem đơn sau cập nhật của Admin. Mô phỏng lỗi API ở UI | Luồng thành công ở cả nền tảng dự kiến. UI hiện lỗi và cho thử lại ở bước phù hợp | Video/ảnh hoặc kết quả E2E theo nền tảng |
| AC-14 | TRYON_ENABLED=false và dịch vụ AI không chạy | Chạy luồng catalog, cart, checkout COD và Admin cập nhật đơn | Luồng cốt lõi hoạt động, checkout hoàn tất mà không gọi dịch vụ AI | Kết quả E2E và dấu vết request đã che dữ liệu |

## Test matrix (API + Android + Web)
| Case | Mốc | Kỳ vọng |
|---|---|---|
| Customer register/login/logout, token invalid | M3 | 200/401/validation đúng |
| Customer cố gọi admin | M3 | 403 |
| IDOR địa chỉ/order | M3/M5 | Không đọc/sửa tài nguyên người khác |
| Admin tạo category, product SKU/variant | M4 | Validation/unique/visibility đúng |
| Lọc, pagination, ảnh lỗi | M4 | Kết quả & UI đúng |
| Cart client giả mạo giá | M5 | Server vẫn tính giá từ DB |
| Hai checkout hợp lệ đồng thời, cùng SKU còn 1 sản phẩm | M5 / AC-05 | Một đơn thành công, tồn còn 0, không tạo đơn thứ hai |
| Checkout nhiều SKU và một SKU thiếu hàng | M5 / AC-04 | Không lưu đơn hoặc dòng hàng, tồn ban đầu của mọi SKU được giữ nguyên |
| Customer gửi lặp cùng checkout và idempotency key | M5 / AC-04 | Một đơn, một lần trừ tồn, snapshot tổng tiền dùng giá server và phí giao 0 đồng |
| COD từ checkout tới giao thành công | M5/M6 / AC-06 | UNPAID cho tới khi Admin xác nhận giao và thu mô phỏng. Khi đó PAID, không có giao dịch thật |
| Hủy COD trước khi thu tiền | M6 / AC-06/07 | Đơn CANCELLED, thanh toán vẫn UNPAID, tồn được hoàn một lần |
| Phân quyền hủy và chuyển trạng thái | M6 / AC-07 | Customer chỉ hủy đơn mình ở PENDING. Admin hủy được trước SHIPPING khi có lý do. Từ chối bỏ bước hoặc chuyển đơn đã kết thúc |
| Hủy lặp hoặc đồng thời với bước chuyển sang SHIPPING | M6 / AC-07 | Hủy thành công chỉ hoàn tồn một lần. Từ PACKING, nếu SHIPPING thắng thì hủy bị từ chối và tồn không tăng. Nếu hủy thắng thì xử lý SHIPPING bị từ chối |
| Review hợp lệ và gửi đánh giá thứ hai cho cùng order_item | M6 / AC-09 | Đánh giá thứ nhất hợp lệ được lưu. Đánh giá thứ hai bị từ chối |
| Review khi chưa DELIVERED, sai Customer, sai sản phẩm hoặc điểm ngoài 1–5 | M6 / AC-09 | Từ chối và không lưu review |
| Admin ẩn rồi hiện lại review | M6 / AC-10 | Hiển thị thay đổi đúng, nội dung được giữ, có audit người thao tác/hành động/thời điểm cho từng lần |
| Staff xử lý đơn/tồn kho | M7 | Đúng permission |
| Staff cố đổi giá/user role/config | M7 | 403, audit theo chính sách |
| Disable AI branch | M6/M8 | Core commerce và checkout không đổi |

## Ca kiểm chứng giao dịch M1-06

| Ca | Kết quả mong đợi |
|---|---|
| Hai Customer tranh một biến thể tồn 1 | Một đơn commit, tồn 0, một biến động trừ. Đơn thua không để lại dòng đơn, thanh toán hay biến động. |
| Trừ SKU đầu thành công rồi SKU cuối thiếu tồn | Mọi tồn trở về giá trị ban đầu. Đơn, dòng đơn, COD, key và biến động của giao dịch không được lưu. |
| Hai request đồng thời cùng Customer, key và fingerprint | Cùng nhận một ID đơn. Chỉ một lần trừ tồn và một tập biến động. |
| Phản hồi sau commit bị mất, rồi giỏ thay đổi | Gửi lại đầu vào ban đầu với cùng key trả đơn đã commit. Tồn và biến động không đổi. |
| Cùng Customer và key nhưng fingerprint khác | Trả xung đột, không đổi đơn, tồn hoặc biến động. |
| Hủy lặp hoặc hai yêu cầu hủy chạy đồng thời | Đơn CANCELLED, mỗi biến thể hoàn đúng số lượng đã mua và có đúng một biến động hoàn tương ứng. |
| Hủy cạnh tranh với chuyển PACKING sang SHIPPING | Nếu hủy thắng thì CANCELLED và hoàn tồn một lần. Nếu SHIPPING thắng thì không hoàn tồn. |
| Lỗi giữa chừng sau chuyển CANCELLED hoặc sau khi hoàn SKU đầu | Rollback về trạng thái trước khi hủy, tồn các SKU giữ nguyên và không có biến động hoàn. |
| Lỗi cạnh tranh có thể thử lại | Retry cả giao dịch có giới hạn. Tồn, số đơn và log biến động chỉ phản ánh giao dịch đã commit. |

Các ca trên là đặc tả và đang NOT RUN.

## Ca kiểm chứng đánh giá và kiểm duyệt M1-07

| Ca | Kết quả mong đợi |
|---|---|
| Customer đánh giá dòng hàng của mình đã DELIVERED, điểm nguyên 1–5 | Tạo một đánh giá hiển thị, gắn đúng Customer và sản phẩm. |
| Dòng hàng thuộc người khác hoặc đơn chưa DELIVERED | Từ chối, không tạo hàng review. |
| Product ID không khớp dòng mua hoặc điểm ngoài 1–5, không nguyên | Từ chối, không tạo review. |
| Hai request đồng thời cho cùng order_item, hoặc tạo lại sau khi review bị ẩn | Tối đa một bản ghi theo UNIQUE(order_item_id). |
| Staff hoặc Customer thử ẩn hoặc hiện lại | Từ chối, trạng thái và audit giữ nguyên. |
| Admin ẩn rồi hiện lại, kể cả gửi lặp lệnh cùng đích | Danh sách công khai phản ánh trạng thái mới, giữ nội dung gốc, một audit cho mỗi thay đổi thực tế. |
| Lỗi khi ghi audit sau cập nhật trạng thái | Rollback trạng thái, audit và danh sách công khai giữ theo trạng thái trước đó. |

Các ca trên là đặc tả và đang NOT RUN.

## Performance & operations
- Seed giả có kích thước được ghi rõ. Đo 10/25/50 virtual users **nếu máy cho phép**: p50/p95/p99, error rate, RPS, CPU/RAM/DB connections, cấu hình server, dataset; không so sánh thiếu điều kiện.
- Mục tiêu khám phá API p95 catalog<500ms, cart<500ms, checkout<1000ms **không phải bảo đảm**.
- Kiểm tra index bằng EXPLAIN, không thêm cache theo cảm giác.
- Kiểm tra migration up trên DB disposable, backup→restore thực nghiệm, xử lý mất mạng và DB unavailable.

## Security / Privacy checklist
- [ ] Password hash; token storage; no secret in logs/commits.
- [ ] DTO validation, input limits, rate limiting, no unsafe SQL concatenation.
- [ ] Authorization/IDOR/mass assignment tests cho Customer/Admin/Staff.
- [ ] HTTPS/public deployment; CORS/CSRF thích hợp với auth strategy.
- [ ] Order total authoritative; payment webhook verify signature/idempotency nếu tích hợp.
- [ ] Reviews moderation & audit; inventory adjustment reason/audit.
- [ ] Không thu dữ liệu thẻ; dữ liệu demo giả; ảnh khách dùng cho AI phải có consent/retention.
- [ ] Dependency audit, minimal DB privileges, backup plan.

## Demo script GATE A (MVP Customer + Admin)
1. Admin login, tạo category/product, size/color/stock, cập nhật giá/ảnh.
2. Guest tìm kiếm và xem biến thể. Customer đăng nhập, thêm đúng biến thể vào giỏ và chọn địa chỉ.
3. Customer checkout COD và xem đơn. Admin xử lý đơn, xác nhận giao thành công và thu COD mô phỏng.
4. Customer thấy đơn DELIVERED và gửi đánh giá 1–5 sao cho dòng hàng. Admin ẩn rồi hiện lại đánh giá và đối chiếu audit.
5. Chạy evidence concurrency stock=1 + order IDOR; tắt AI và vẫn checkout được.

## Demo script GATE B (Staff)
6. Admin tạo/cấp Staff permissions; Staff login và xử lý đơn/tồn kho theo quyền.
7. Staff thiếu quyền bị từ chối thao tác tương ứng. Kiểm tra quản lý tài khoản và cấp quyền chỉ dành cho Admin, sau đó chạy hồi quy MVP A. Các ca về quyền catalog/giá theo quyết định Q10.

## Release runbook (chỉ khi được duyệt)
Backup DB → ghi commit/tag → lint/typecheck/unit/integration/E2E smoke → review migration và rollback → cấu hình secrets bên ngoài repo → deploy → smoke live → giám sát → rollback application nếu lỗi. Database rollback cần kế hoạch riêng, không tự drop schema có dữ liệu.
