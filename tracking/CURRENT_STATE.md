# CURRENT_STATE — snapshot ngắn cho AI

**Updated:** 2026-11-25 (đã đối chiếu hồ sơ nghiệm thu M6-10, chờ bằng chứng Expo).

**10-step process:** Chuẩn bị nền tảng triển khai. **PRD v1, M0 và M1 gate đã được phê duyệt.**  
**Product:** MVP A Customer + Admin → MVP B Staff → AI image try-on độc lập.  
**Milestone active:** Backend M6-01, M6-02, M6-04, M6-06 và M6-07 đã nghiệm thu theo BACKEND FIRST. M6-09 đang WAITING_FRONTEND. M5 gate mở, M5-02 đến M5-07 đã nghiệm thu, M5-01 đang REVIEW, M5-09 và M5-10 đang WAITING_FRONTEND. Gate M4 vẫn mở, M4-03/M4-07/M4-08/M4-10 đang WAITING_FRONTEND và M4-09 đang REVIEW. M2 và M3 gate vẫn mở, chờ bằng chứng Expo Android/Web và phê duyệt.

**Ưu tiên triển khai:** BACKEND FIRST. Codex thực hiện backend khi đủ dependency và được giao, duyệt PLAN. Antigravity phụ trách frontend. Các gate tích hợp vẫn cần bằng chứng theo acceptance.

**Current tasks:** M3-06 và M3-07 — WAITING_FRONTEND, người B phụ trách. M3-06 chờ Admin Login UI/Auth Guard trên Expo Web. Ca backend Customer nhận 403 đã PASS trong M4-04. M3-07 chờ Customer Auth UI và smoke test đăng nhập Android/Web. Các API auth và GET /me đã có.

**M6-10 — Hồ sơ Gate A:** WAITING_FRONTEND. Chủ dự án đã duyệt PLAN ngày 2026-11-25. Gate A chờ nghiệm thu. Phạm vi P0 gồm AC-01 đến AC-11 và AC-13 đến AC-14 theo [PRD](../docs/01-PRD.md#6-điều-kiện-nghiệm-thu-theo-mốc). AC-12 thuộc MVP B. COD mô phỏng thuộc P0. Gateway sandbox và dashboard đang DEFERRED ở P1.

| AC | Bằng chứng backend hiện có | Bằng chứng demo còn cần |
|---|---|---|
| AC-01 | `catalog` PASS bộ lọc, phân trang và chỉ sản phẩm công khai | Catalog Android/Web, gồm loading, rỗng và lỗi tải |
| AC-02 | `cart` PASS đúng SKU, validation số lượng, kiểm tra tồn và giá server | Customer Android/Web chọn size, màu và thêm đúng SKU |
| AC-03 | `auth` PASS hash, hạn phiên và ownership địa chỉ | Đăng nhập và xem hồ sơ/địa chỉ trên Android/Web |
| AC-04 | `order-snapshot`, `checkout-transaction`, `checkout-idempotency` PASS snapshot, replay và rollback | Đối chiếu tổng và snapshot trên đơn demo |
| AC-05 | `checkout-cod` và `checkout-transaction` PASS hai Customer tranh SKU tồn 1, chỉ một đơn commit và tồn cuối bằng 0 | Dùng kết quả hồi quy trong hồ sơ demo |
| AC-06 | `checkout-cod` và `order-lifecycle` PASS COD từ UNPAID sang PAID khi giao và giữ UNPAID khi hủy | Admin Web giao và xác nhận thu COD mô phỏng. Customer thấy trạng thái mới |
| AC-07 | `order-lifecycle` PASS ownership, chuyển trạng thái và hoàn tồn đúng một lần | Customer và Admin xem cùng đơn demo sau cập nhật |
| AC-08 | `admin-catalog`, `product-images`, `inventory` PASS CRUD, phân quyền và audit điều chỉnh tồn | Admin Web tạo/sửa sản phẩm, cập nhật ảnh và điều chỉnh tồn có lý do |
| AC-09 | `reviews` PASS đánh giá mua hàng đã giao, sai chủ, trùng và điểm ngoài phạm vi | Customer Android/Web gửi đánh giá từ đơn đã giao |
| AC-10 | `reviews` PASS ẩn/hiện, giữ nội dung gốc và ghi audit | Admin Web ẩn/hiện, đối chiếu hiển thị công khai và audit |
| AC-11 | `auth` và `admin-users` PASS đăng ký Customer, từ chối leo thang quyền, thu hồi phiên và ghi audit | Admin Web khóa/mở khóa Customer demo |
| AC-13 | HTTP/MySQL PASS các luồng liên quan | Customer Android, Customer Web và Admin Web qua API thật, gồm UI báo lỗi và thử lại |
| AC-14 | Hồi quy core commerce backend PASS | Demo với AI tắt và dấu vết request đã che dữ liệu cho thấy luồng mua hàng hoàn tất |

**Dependency M6-10:** M2-10 BLOCKED, M3-08 REVIEW, M4-10 và M5-10 WAITING_FRONTEND. M5-01 đang REVIEW và còn trong điều kiện phê duyệt M5 gate. M6-09 WAITING_FRONTEND, E2E ba luồng NOT RUN do workspace chưa có bản Expo tích hợp. Chủ dự án xác nhận nghiệm thu MVP A sau khi đủ bằng chứng và hoàn tất các dependency. Lượt đối chiếu này dùng lại kết quả M6-09.

**M6-09:** WAITING_FRONTEND. Hồi quy backend ngày 2026-11-25 trên Windows, Node v24.14.1, Prisma 7.10.1, MySQL 8.0.41 InnoDB test riêng. `npm run db:migrate --workspace apps/api` PASS, áp dụng 8 migration hiện có vào 13 schema test mới. `npm test --workspace apps/api` PASS 13/13, gồm generate/build, unit, HTTP smoke và health qua tiến trình API thật. Lint, typecheck và format:check PASS. Đã dọn MySQL test.

**Hồi quy HTTP/MySQL M6-09:** `node --test --test-reporter=spec apps/api/test/<suite>.integration.cjs` PASS 95/95 qua 13 suite. Auth 9/9, admin-users 6/6, admin-catalog 4/4, catalog 6/6, product-images 4/4, inventory 4/4, cart 15/15, order-snapshot 5/5, checkout-transaction 6/6, checkout-idempotency 7/7, checkout-cod 8/8, order-lifecycle 11/11 và reviews 10/10. Hai checkout tranh SKU tồn 1 chỉ commit một đơn đầy đủ. Replays giữ cùng ID đơn và không trừ tồn thêm. Ca lỗi giữa transaction rollback. Test hủy lặp/đồng thời kiểm chứng hoàn tồn đúng một lần. Các suite xác thực và đơn hàng kiểm chứng từ chối truy cập chéo và thao tác ngoài quyền.

**Bàn giao E2E M6-09:** Workspace chưa có `apps/mobile/package.json`. Antigravity cần bản Expo kết nối cùng API và dữ liệu demo giả. Thực hiện [kịch bản Gate A](../docs/06-TEST_RELEASE.md#demo-script-gate-a-mvp-customer--admin) với AI tắt và ghi bằng chứng theo nền tảng.

| Nền tảng | Kết quả | Bằng chứng còn cần |
|---|---|---|
| Customer Android | NOT RUN | Đăng nhập, tìm và chọn đúng SKU, giỏ và địa chỉ, checkout COD, xem đơn sau cập nhật Admin, gửi review, UI báo lỗi API và cho thử lại. |
| Customer Web | NOT RUN | Cùng luồng Customer qua Web, kèm kiểm chứng phiên Web và xử lý lỗi API. |
| Admin Web | NOT RUN | Đăng nhập, tạo sản phẩm và điều chỉnh tồn có lý do, xử lý đơn tới DELIVERED/PAID, ẩn/hiện review và khóa/mở khóa Customer. Đối chiếu tồn, trạng thái và audit theo dữ liệu demo. |

Ghi phiên bản Expo/API, thiết bị hoặc trình duyệt, SKU/ID đơn demo, kết quả từng bước và ảnh, video hoặc log đã che thông tin nhạy cảm. Chỉ trình nghiệm thu M6-09 khi có kết quả đầy đủ trên các nền tảng. Phê duyệt MVP A thuộc M6-10.

**Xác nhận M6-09:** Chủ dự án gửi yêu cầu nghiệm thu ngày 2026-11-25. Đã kiểm tra lại workspace, chưa có bản Expo tích hợp hoặc bằng chứng demo ba luồng. M6-09 vẫn WAITING_FRONTEND, chờ bằng chứng để đóng checklist.

**M6-08:** DEFERRED, chủ dự án duyệt ngày 2026-11-25. Dashboard cơ bản thuộc P1 theo PRD đã duyệt. Rà lại khi có rubric Q02/Q15 hoặc khi chủ dự án duyệt triển khai P1. Kiểm thử dashboard NOT RUN do task đã hoãn. M6-09 vẫn theo tiêu chí demo Customer/Admin trên Android và Web.

**M6-07:** DONE, chủ dự án nghiệm thu ngày 2026-11-25. `GET /api/v1/admin/users` phân trang Customer theo ID giảm dần và lọc ACTIVE/DISABLED. `PATCH /api/v1/admin/users/:userId/status` chỉ nhận trường status, yêu cầu phiên Admin Web, Origin và CSRF. Tài khoản Admin trả 409 ACCOUNT_STATUS_CONFLICT, PATCH lặp cùng trạng thái trả 200 và giữ nguyên audit. `AdminUsersService.setStatus` cập nhật Customer, thu hồi phiên Android/Web khi khóa và ghi audit SET_ACCOUNT_STATUS trong một transaction. `AuthService.login` kiểm tra lại trạng thái và thông tin đã xác minh dưới cùng khóa dòng trước khi cấp phiên. Phiên đã thu hồi vẫn hết hiệu lực sau mở khóa. Dùng schema và OpenAPI hiện có.

**Kiểm tra M6-07:** Windows, Node v24.14.1, Prisma 7.10.1 và MySQL 8.0.41 InnoDB test riêng. `npm run db:migrate --workspace apps/api` PASS (8 migration hiện có). `node --test --test-reporter=spec apps/api/test/admin-users.integration.cjs` PASS 6/6, gồm phân quyền và chặn payload role, bảo vệ Admin, khóa/mở khóa và thu hồi phiên, hai PATCH đồng thời, cả hai thứ tự cạnh tranh giữa đăng nhập và khóa, rollback khi lỗi thu hồi hoặc audit. Hồi quy cùng lệnh theo suite PASS auth 9/9, admin-catalog 4/4, reviews 10/10 và order-lifecycle 11/11. `npm test --workspace apps/api` PASS 13/13. Build, lint, typecheck và format:check PASS. Đã dọn MySQL test. Manual và Expo NOT RUN.

**M6-06:** DONE, chủ dự án nghiệm thu ngày 2026-11-25. `GET /api/v1/admin/reviews` phân trang và lọc VISIBLE/HIDDEN. `PATCH /api/v1/admin/reviews/:reviewId/visibility` kiểm tra phiên Admin Web, Origin và CSRF. `ReviewsService.moderate` khóa review, đổi trạng thái và ghi audit `MODERATE_REVIEW` với Admin, review, thời điểm và trạng thái trước/sau trong cùng transaction MySQL. PATCH lặp cùng trạng thái trả 200 với audit giữ nguyên. Lỗi audit rollback thay đổi. Danh sách và tổng công khai dùng cùng bộ lọc VISIBLE. API dùng schema và OpenAPI hiện có.

**Kiểm tra M6-06:** Windows, Node v24.14.1, Prisma 7.10.1 và MySQL 8.0.41 InnoDB test riêng. `npm run db:migrate --workspace apps/api` PASS (8 migration hiện có). `node --test --test-reporter=spec apps/api/test/reviews.integration.cjs` PASS 10/10, gồm phân quyền, Origin/CSRF, validation, ẩn/hiện, tổng công khai, audit khi gọi lặp/đồng thời và rollback khi lỗi audit. Hồi quy cùng lệnh theo suite PASS auth 9/9, catalog 6/6, admin-catalog 4/4 và order-lifecycle 11/11. `npm test --workspace apps/api` PASS 13/13. Build, lint, typecheck, format:check PASS. Đã dọn MySQL test. Manual và Expo NOT RUN.

**M6-04:** DONE, chủ dự án nghiệm thu ngày 2026-11-25. Migration `20261125000002_add_reviews` thêm bảng `reviews`, ba FK RESTRICT, CHECK điểm 1–5 và trạng thái VISIBLE/HIDDEN, UNIQUE theo dòng đơn và index đọc theo sản phẩm/trạng thái/thời gian. `POST /api/v1/reviews` lấy chủ từ phiên, suy ra sản phẩm từ dòng đơn và chỉ tạo review khi đơn DELIVERED. Dòng vắng hoặc khác chủ trả 404, chưa giao trả 409 REVIEW_NOT_ELIGIBLE, trùng dòng trả 409 REVIEW_ALREADY_EXISTS. Review HIDDEN giữ lượt đã dùng. `GET /api/v1/products/:productId/reviews` dùng điều kiện hiển thị catalog, phân trang review VISIBLE theo createdAt và ID giảm dần, tổng dùng cùng bộ lọc. UI thuộc M6-05, kiểm duyệt và audit thuộc M6-06.

**Kiểm tra M6-04:** Windows, Node v24.14.1, Prisma 7.10.1 và MySQL 8.0.41 InnoDB test riêng. `db:validate`, `db:migrate` và `prisma migrate diff` PASS. Cài mới 8 migration và nâng cấp từ 7 với dữ liệu cũ khớp trước/sau. `npm run test:prepare --workspace apps/api` PASS. `node --test --test-reporter=spec apps/api/test/reviews.integration.cjs` PASS 6/6, gồm checkout và giao COD qua HTTP trước khi review, đơn chưa giao/khác chủ, hai request cùng chờ InnoDB trả một 201 và một 409, review HIDDEN, phân trang, DTO/CSRF và ràng buộc MySQL. Hồi quy cùng lệnh theo suite PASS catalog 6/6, order-lifecycle 11/11 và auth 9/9. `npm test --workspace apps/api` PASS 13/13. Build, lint, typecheck, format:check PASS. Đã dọn MySQL test. Manual và Expo NOT RUN.

**M6-02:** DONE, chủ dự án nghiệm thu ngày 2026-11-25. Customer hủy đơn của mình ở PENDING qua `POST /api/v1/orders/:orderId/cancel`. Admin Web hủy ở PENDING, CONFIRMED hoặc PACKING qua `POST /api/v1/admin/orders/:orderId/cancel`, có lý do và audit. `OrdersService.cancel` khóa hàng đơn trước khi cập nhật có điều kiện. Chỉ lượt hủy thắng mới gọi `InventoryService.restoreForCancellation` hoàn từ snapshot theo thứ tự ID biến thể và ghi biến động dương cùng transaction. Hủy lặp trả 200 với cùng đơn CANCELLED/UNPAID. Hủy cạnh tranh chuyển PACKING → SHIPPING chỉ một thao tác thắng. Hai luồng checkout/hủy dùng chung retry giới hạn cho xung đột ghi đã rollback.

**Kiểm tra M6-02:** Windows, Node v24.14.1, Prisma 7.10.1 và MySQL 8.0.41 InnoDB test riêng. `npm run db:migrate --workspace apps/api` PASS (7 migration hiện có), `npm run test:prepare --workspace apps/api` PASS. `node --test --test-reporter=spec apps/api/test/order-lifecycle.integration.cjs` PASS 11/11, gồm hủy đơn COD thật hai lần, hoàn SKU đã ngừng bán, hủy đồng thời, quyền sở hữu/CSRF/lý do Admin, hai thứ tự tranh khóa với SHIPPING, rollback khi lỗi biến động SKU thứ hai, vượt miền tồn hoặc lỗi audit. Hồi quy cùng lệnh theo suite PASS checkout-cod 8/8, checkout-transaction 6/6, checkout-idempotency 7/7, inventory 4/4, auth 9/9. `npm test --workspace apps/api` PASS 13/13. Build, lint, typecheck, format:check PASS. Đã dọn MySQL test. Manual và Expo NOT RUN.

**M6-01:** DONE, chủ dự án nghiệm thu ngày 2026-11-25. Customer đọc lịch sử và chi tiết đơn của mình qua `GET /api/v1/orders/me` và `GET /api/v1/orders/:orderId`. Admin Web đọc qua `GET /api/v1/admin/orders` và `GET /api/v1/admin/orders/:orderId`, hỗ trợ lọc trạng thái. Danh sách sắp `createdAt DESC, id DESC`. `OrdersService` đọc snapshot đơn và thanh toán nhất quán từ MySQL. Admin Web dùng Origin/CSRF để PATCH trạng thái theo từng bước PENDING, CONFIRMED, PACKING, SHIPPING. POST deliver chuyển SHIPPING/UNPAID sang DELIVERED/PAID cùng audit trong một transaction. Giao lặp trả 200 với snapshot hiện tại và chỉ có một audit xác nhận giao. Hủy/hoàn tồn thuộc M6-02, UI quản lý đơn thuộc M6-03.

**Kiểm tra M6-01:** Windows, Node v24.14.1, Prisma 7.10.1 và MySQL 8.0.41 InnoDB test riêng. `npm run db:migrate --workspace apps/api` PASS (7 migration hiện có) và `npm run test:prepare --workspace apps/api` PASS. `node --test --test-reporter=spec apps/api/test/order-lifecycle.integration.cjs` PASS 6/6 gồm ownership, phân trang, lọc, CSRF, bước hợp lệ/sai, hai request chờ cùng khóa và rollback COD/audit. Hai PATCH đồng thời trả một 200, một 409 và ghi một audit. Hai POST deliver đồng thời cùng trả 200 với DELIVERED/PAID và ghi một audit. Hồi quy cùng lệnh theo suite PASS checkout-cod 8/8, order-snapshot 5/5, checkout-transaction 6/6, checkout-idempotency 7/7, auth 9/9 và admin-catalog 4/4. `npm test --workspace apps/api` PASS 13/13. Build, lint, typecheck, format:check PASS. Đã dọn MySQL test. Manual và Expo NOT RUN.

**M5-10:** WAITING_FRONTEND, backend gate PASS. Hai Customer dùng phiên Android và Web gọi `POST /api/v1/orders` với giỏ riêng và cùng SKU tồn 1. InnoDB ghi nhận cả hai request chờ khóa. Sau khi nhả khóa, một request trả `201`, một trả `409 OUT_OF_STOCK`, tồn cuối 0, DB có đúng một đơn, một dòng đơn, một COD UNPAID và một biến động -1 cho ca này. Checkout nhiều SKU với SKU thứ hai thiếu tồn hoặc với lỗi khi ghi COD hoàn tác toàn bộ tồn, đơn, dòng đơn, thanh toán và biến động. Đối chiếu toàn schema checkout test có 6 đơn, 8 dòng, 6 thanh toán, 8 biến động, 0 tồn âm, 0 đơn dở dang và 0 bản ghi con mồ côi.

**Kiểm tra M5-10:** Windows, Node v24.14.1, Prisma 7.10.1 và MySQL 8.0.41 InnoDB test riêng. `npm run db:migrate --workspace apps/api` PASS (7 migration trên 10 schema độc lập). `node --test --test-reporter=spec apps/api/test/<suite>.integration.cjs` PASS 68/68 gồm checkout-cod 8/8, order-snapshot 5/5, checkout-transaction 6/6, checkout-idempotency 7/7, cart 15/15, auth 9/9, catalog 6/6, admin-catalog 4/4, product-images 4/4 và inventory 4/4. `npm test --workspace apps/api` PASS 13/13, kèm sinh Prisma client và build. Typecheck, lint, format:check và đối chiếu SQL PASS. Đã dừng và dọn MySQL test. Manual và smoke Expo Android/Web NOT RUN. M5 gate còn chờ nghiệm thu M5-01, bằng chứng Expo từ M5-09 và phê duyệt của chủ dự án.

**M5-09:** WAITING_FRONTEND. Backend bàn giao theo OpenAPI hiện hành. Antigravity tích hợp Expo từ M2-01/M2-08 và phiên Customer từ M3-07. Workspace kiểm tra ngày 2026-11-25 chưa có `apps/mobile/package.json`. M5-09 và M5 gate còn mở đến khi có luồng thành công qua API thật trên cả Android và Web.

- **Giỏ và địa chỉ:** Dùng `GET /api/v1/cart`, `POST /api/v1/cart/items`, `PATCH/DELETE /api/v1/cart/items/:variantId`; sau `DELETE 204` đọc lại giỏ. Hiển thị số lượng và tiền server trả. Dùng `GET/POST /api/v1/me/addresses` và `PATCH /api/v1/me/addresses/:addressId` để thêm/sửa/chọn địa chỉ. Android dùng Bearer. Web dùng HTTPS cùng origin, cookie phiên và CSRF cho thao tác ghi.
- **Checkout và xác nhận:** `POST /api/v1/orders` nhận `addressId`, `method: "COD"`, các cặp `variantId`/`quantity` và `Idempotency-Key`. Khóa nút khi đang gửi. Nếu mất phản hồi, dùng lại cùng key và body; `201` tạo mới và `200` replay đều mở màn xác nhận từ snapshot `Order`, trạng thái ban đầu `PENDING / UNPAID`. Với `CART_CHANGED` hoặc `OUT_OF_STOCK`, tải lại giỏ và cho khách xác nhận lại. Với `IDEMPOTENCY_CONFLICT`, dừng thử lại key đó. Checkout hiện giữ các dòng giỏ; khi quay lại đọc `GET /api/v1/cart`. Lịch sử và chi tiết đơn thuộc M6-01.
- **Bằng chứng cần thu:** Trên từng nền tảng, đăng nhập Customer, thêm/cập nhật SKU, chọn địa chỉ, đặt COD và mở xác nhận với ID đơn, tổng và trạng thái thanh toán. Mô phỏng mất phản hồi rồi gửi lại cùng key/body, xác nhận cùng ID và chỉ một đơn. Ghi phiên bản app, môi trường, SKU, ID đơn và kết quả của từng bước; che thông tin phiên và địa chỉ cá nhân trong bằng chứng.

**Kiểm tra backend M5-09:** Windows, Node v24.14.1, Prisma 7.10.1 và MySQL 8.0.41 InnoDB test riêng. `npm run db:migrate --workspace apps/api` PASS (7 migration trên ba schema test) và `npm run test:prepare --workspace apps/api` PASS. `node --test --test-reporter=spec apps/api/test/<suite>.integration.cjs` PASS auth 9/9, cart 15/15 và checkout-cod 7/7. MySQL test đã dọn. Expo Android/Web NOT RUN, cần chạy trên app thật để nghiệm thu.

**M5-08:** DEFERRED, chủ dự án duyệt ngày 2026-11-25. Q05 và ADR-0004 chốt COD mô phỏng cho P0 của MVP A. Gateway mock/sandbox thuộc P1, mở lại khi provider và phạm vi demo được phê duyệt. M5-09 tiếp tục tích hợp checkout COD. Kiểm thử gateway NOT RUN do task đã hoãn.

**M5-07:** DONE, chủ dự án nghiệm thu ngày 2026-11-25. Migration `20261125000001_add_cod_payment_records` tạo `payment_records` với một bản ghi mỗi đơn, FK RESTRICT, phương thức COD, hai trạng thái UNPAID/PAID và `provider_reference` nullable. Migration bổ sung COD UNPAID cho đơn PENDING có sẵn và giữ nguyên bản ghi đơn. `POST /api/v1/orders` dùng phiên Customer Android hoặc Web với Origin/CSRF, chỉ nhận COD mô phỏng. Checkout tạo đơn, dòng đơn, trừ tồn, biến động và thanh toán UNPAID trong cùng transaction. API trả `201` khi tạo và `200` khi replay với trạng thái từ bản ghi thanh toán đã lưu. Thao tác Admin xác nhận giao và thu COD ở M6.

**Kiểm tra M5-07:** Windows, Node v24.14.1, Prisma 7.10.1, MySQL 8.0.41 InnoDB test riêng. `db:validate`, `db:migrate` và `prisma migrate diff` PASS khi cài mới 7 migration và nâng cấp từ 6 migration có đơn cũ. `npm run test:prepare --workspace apps/api` PASS. `node --test apps/api/test/checkout-cod.integration.cjs` PASS 7/7 trên HTTP thật, gồm phiên Android/Web, double-tap 201/200, DTO/key, 401/403/404/409, ràng buộc MySQL và rollback khi ghi thanh toán lỗi. Ca replay trả PAID dùng fixture mô phỏng trạng thái đã lưu sau M6. `node --test --test-reporter=spec apps/api/test/<suite>.integration.cjs` PASS checkout-idempotency 7/7, checkout-transaction 6/6, order-snapshot 5/5, cart 15/15, inventory 4/4 và auth 9/9. `npm test --workspace apps/api` PASS 13/13. Build, typecheck, lint, format:check PASS. Đã dọn MySQL test. Manual và smoke Expo NOT RUN. Migration chờ áp dụng vào DB dev khi tích hợp M5-09.

**M5-06:** DONE, chủ dự án nghiệm thu ngày 2026-11-25. `CheckoutService.createOrder` kiểm tra key 1–128 ký tự, từ chối key chỉ chứa khoảng trắng và tính fingerprint SHA-256 từ ID địa chỉ, COD và danh sách biến thể/số lượng theo thứ tự ID. Tra đơn theo Customer/key trước khi đối chiếu giỏ. Fingerprint khớp trả đơn đã lưu với `replayed: true`, khác trả `409 IDEMPOTENCY_CONFLICT`. Nếu va chạm đúng chỉ mục unique của Customer/key, đọc lại đơn sau rollback. Khi hai checkout cùng key thực sự chờ khóa Customer, MySQL chỉ commit một đơn và một lần trừ tồn, hai lượt nhận cùng ID. `POST /api/v1/orders` chờ bản ghi COD UNPAID và nối HTTP ở M5-07.

**Kiểm tra M5-06:** Windows, Node v24.14.1, Prisma 7.10.1 và MySQL 8.0.41 InnoDB test riêng. `npm run db:migrate --workspace apps/api` PASS với 6 migration hiện có và `npm run test:prepare --workspace apps/api` PASS. `node --test apps/api/test/checkout-idempotency.integration.cjs` PASS 7/7, gồm double-tap, replay khi đảo thứ tự dòng và dữ liệu nguồn thay đổi, xung đột, key độc lập giữa Customer, độ dài key, dùng lại key sau rollback và va chạm unique thật trong fixture mô phỏng lần tra đầu bỏ sót đơn. `node --test --test-reporter=spec apps/api/test/<suite>.integration.cjs` PASS checkout-transaction 6/6, order-snapshot 5/5, cart 15/15, inventory 4/4. `npm test --workspace apps/api` PASS 13/13. Typecheck, lint và format:check PASS. Lượt build đầu dùng `toSorted` ngoài lib TypeScript đang cấu hình, đã đổi sang sắp xếp bản sao và chạy lại PASS. MySQL test đã dọn. Manual, HTTP checkout và Expo NOT RUN.

**M5-05:** DONE, chủ dự án nghiệm thu ngày 2026-11-25. `CheckoutService.createOrder` mở transaction Prisma ReadCommitted, dùng chung khóa chủ giỏ với cart, xác minh địa chỉ và giỏ, trừ tồn theo thứ tự ID biến thể, lưu snapshot và biến động `CHECKOUT` gắn đơn. `InventoryService.decrementForCheckout` chỉ cập nhật SKU còn bán và đủ tồn. Một lỗi làm rollback cả đơn, dòng đơn, tồn và biến động. Checkout thử lại toàn bộ transaction tối đa 3 lần thực hiện khi Prisma xác nhận xung đột ghi hoặc adapter trả deadlock MySQL 1213. Endpoint `POST /api/v1/orders` chờ replay M5-06 và COD UNPAID M5-07.

**Kiểm tra M5-05:** Windows, Node v24.14.1, Prisma 7.10.1, MySQL 8.0.41 InnoDB test riêng. `npm run db:migrate --workspace apps/api` (6 migration hiện có) và `npm run test:prepare --workspace apps/api` PASS. `node --test apps/api/test/checkout-transaction.integration.cjs` PASS 6/6. InnoDB xác nhận hai checkout thực sự chờ khóa cùng SKU tồn 1, sau đó một checkout commit, một trả `409 OUT_OF_STOCK`, tồn cuối 0. Các ca nhiều SKU, SKU thứ hai thiếu tồn, catalog ngừng bán và lỗi ghi biến động PASS. Ca deadlock thật xác nhận thử lại từ đầu, chỉ lưu một đơn và trừ tồn một lần. Lượt đầu cần chỉnh fixture gây deadlock và nhận diện mã 1213 trong metadata lỗi `P2010` của adapter. Regression `node --test apps/api/test/<suite>.integration.cjs` PASS order-snapshot 5/5, cart 15/15, inventory 4/4. `npm test --workspace apps/api` PASS 13/13. Build, typecheck, lint và format:check PASS. Đã dừng và dọn MySQL test. Manual, HTTP checkout và Expo NOT RUN.

**M5-04:** DONE, chủ dự án nghiệm thu ngày 2026-11-25. Migration `20261125000000_add_order_snapshots` tạo `orders`, `order_items` và FK nullable từ `inventory_movements.order_id`. Key là duy nhất theo Customer và so khớp phân biệt hoa thường. `OrderSnapshotService.create` dùng Prisma transaction client do caller truyền vào để đọc địa chỉ đúng chủ, đối chiếu biến thể/số lượng giỏ, tính Decimal từ giá catalog với phí giao `0.00` và ghi đơn PENDING cùng các dòng snapshot. Đọc lại đơn sau khi đổi địa chỉ, thông tin biến thể, giá và giỏ trả đúng snapshot đã lưu. `POST /api/v1/orders` sẽ nối sau khi checkout có trừ tồn atomic, replay và bản ghi COD UNPAID theo M5-05 đến M5-07.

**Kiểm tra M5-04:** Windows, Node v24.14.1, Prisma 7.10.1 và MySQL 8.0.41 InnoDB test riêng. `npm run db:validate --workspace apps/api` PASS. `npm run db:migrate --workspace apps/api` PASS khi cài mới 6 migration và khi nâng cấp từ 5 migration với dữ liệu mẫu. Các bản ghi user, địa chỉ, catalog, giỏ và biến động tồn cũ khớp trước/sau, bao gồm biến động có `order_id = NULL`. `prisma migrate diff` giữa DB đã nâng cấp và schema không phát hiện khác biệt. `npm run test:prepare --workspace apps/api` và `node --test apps/api/test/order-snapshot.integration.cjs` PASS 5/5. Ca kiểm tra xác nhận địa chỉ ngoài quyền, giỏ lệch, tiền vượt miền, JSON snapshot bất biến, rollback do MySQL từ chối dòng thứ hai, CHECK, UNIQUE và FK. `npm run test:cart --workspace apps/api` PASS 15/15, `node --test apps/api/test/inventory.integration.cjs` PASS 4/4, `npm test --workspace apps/api` PASS 13/13. Lint, typecheck, format:check PASS. Đã dừng và dọn MySQL test. Manual, HTTP checkout và Expo NOT RUN. Migration chờ áp dụng vào DB dev khi tích hợp.

**M5-03:** DONE, chủ dự án nghiệm thu ngày 2026-11-25. Suite giỏ xác nhận POST/PATCH trả `400 VALIDATION_ERROR` với từng trường `price`, `unitPrice`, `lineTotal` và `subtotal`. Giỏ qua GET và bản ghi MySQL giữ nguyên sau các request lỗi. Khi giá catalog đổi, GET, POST và PATCH dùng giá mới cho mọi dòng và trả số tiền Decimal đúng hai chữ số thập phân. Kiểm thử dùng logic giỏ hiện có.

**Kiểm tra M5-03:** Windows, Node v24.14.1, Prisma 7.10.1, MySQL 8.0.41 InnoDB test riêng. `npm run db:migrate --workspace apps/api` PASS với 5 migration hiện có. `npm run test:cart --workspace apps/api` PASS 15/15. `npm test --workspace apps/api` PASS 13/13. Build và `npm run format:check --workspace apps/api` PASS. Đã dừng và dọn DB test. Manual và Expo NOT RUN. Tích hợp Expo thuộc M5-09.

**M5-02:** DONE, chủ dự án nghiệm thu ngày 2026-11-25. Customer Web/Android thêm và cộng số lượng qua `POST /api/v1/cart/items`, đặt số lượng tuyệt đối qua `PATCH /api/v1/cart/items/:variantId` và xóa qua `DELETE` cùng đường dẫn. Thao tác ghi dùng chủ giỏ từ phiên, Web yêu cầu Origin/CSRF. POST/PATCH kiểm tra số lượng, tồn và trạng thái bán, rồi trả Cart với giá từ DB. Transaction tuần tự hóa ghi theo Customer, kể cả khi tạo giỏ lần đầu, và rollback nếu tổng vượt miền tiền. DELETE trả 204 và cho phép gỡ SKU hết hàng hoặc ngừng bán. Giỏ dùng schema và contract hiện có.

**Kiểm tra M5-02:** Windows, Node v24.14.1, Prisma 7.10.1 và MySQL 8.0.41 InnoDB trên loopback. `npm run db:migrate --workspace apps/api` PASS với 5 migration hiện có trên các schema test riêng. `npm run test:cart --workspace apps/api` PASS 13/13 gồm CRUD, validation số lượng/tồn, thất bại rollback, ownership và CSRF. Hai POST đồng thời vào cùng giỏ khi tồn bằng 1 trả một 200 và một 409, MySQL có đúng một dòng số lượng 1 và tồn vẫn là 1. `npm test --workspace apps/api` PASS 13/13. `node --test --test-reporter=spec apps/api/test/<suite>.integration.cjs` PASS auth 9/9, catalog 6/6, inventory 4/4, admin-catalog 4/4 và product-images 4/4. Build, lint, typecheck và format:check PASS. Lượt đầu suite cart gặp giới hạn đăng nhập, đã dùng lại phiên theo tài khoản/kênh. Suite chung được chạy lại tuần tự sau lỗi thiếu module trong lúc build chồng nhau. Đã dừng và dọn MySQL test. Manual và Expo NOT RUN, chờ chủ dự án nghiệm thu API và tích hợp UI ở M5-09.

**M5-01:** REVIEW. Migration `20261124000002_add_cart_items` thêm `cart_items` với khóa duy nhất theo giỏ/biến thể, số lượng dương và FK CASCADE/RESTRICT theo data model. `GET /api/v1/cart` chỉ đọc theo `userId` từ phiên Customer Web hoặc Android. Đọc giỏ chưa tồn tại trả `items: []` và `subtotal: "0.00"` mà không tạo bản ghi. Giá lấy từ biến thể và tính bằng Decimal. Tổng vượt miền giá của OpenAPI trả `500 INTERNAL_ERROR`. Q03 vẫn OPEN. Ghi item và tái kiểm tra tổng thuộc M5-02/M5-03.

**Kiểm tra M5-01:** Windows, Node v24.14.1, Prisma 7.10.1 và MySQL 8.0.41 InnoDB tách biệt. `npm run db:migrate --workspace apps/api` PASS cả nâng cấp từ 4 migration có giỏ cũ và cài mới 5 migration. Ca nâng cấp giữ nguyên ID, chủ sở hữu và `updated_at` của giỏ cũ. `npm run test:cart --workspace apps/api` PASS 7/7, gồm A/B trên Web và Android, ID của B trong request A, 401/403, giỏ rỗng, ràng buộc DB, xóa biến thể được tham chiếu trả 409 và tổng vượt miền. `npm test --workspace apps/api` PASS 13/13. `node --test --test-reporter=dot apps/api/test/<suite>.integration.cjs` PASS auth 9/9, admin-catalog 4/4, catalog 6/6 và inventory 4/4. Build, lint, typecheck và format:check PASS. Đã dọn DB test. Manual và Expo NOT RUN. Migration chưa chạy trên DB dev.

**M4-10:** WAITING_FRONTEND. Qua HTTP thật, Admin đăng nhập Web, lấy CSRF token, tạo danh mục, sản phẩm và biến thể ACTIVE, sau đó tăng tồn từ 0 lên 5 và đọc lại lịch sử điều chỉnh. Phiên Customer riêng tìm `q=m410-gate-tee` và mở chi tiết, cả hai trả đúng `productId=2`, `variantId=3`, SKU `M410-TEE-M-BLACK`, size `M`, màu `Black` và tồn 5. Customer ghi API quản trị trả 403, sản phẩm chuyển INACTIVE biến mất khỏi danh sách và chi tiết trả 404. ID trên thuộc database test tạm.

**Kiểm tra M4-10:** Windows, Node v24.14.1, Prisma 7.10.1 và MySQL 8.0.41 InnoDB trên loopback, schema riêng cho từng suite. `npm run db:migrate --workspace apps/api` PASS (4 migration), `npm test --workspace apps/api` PASS 13/13 (gồm build). `node --test --test-reporter=dot apps/api/test/<suite>.integration.cjs` PASS auth 9/9, catalog 6/6, admin-catalog 4/4, inventory 4/4 và product-images 4/4. Lượt đầu admin-catalog dừng ở trigger kiểm thử rollback (MySQL 1419 do bật binary logging). Chạy lại toàn bộ trên instance test mới với `--skip-log-bin` PASS. Đã dọn dữ liệu và instance test. Manual và Expo Web/Android NOT RUN do workspace chưa có app Expo.

**M4-09:** REVIEW. Đo `EXPLAIN FORMAT=JSON` và `EXPLAIN ANALYZE` cho 21 câu SELECT thu từ catalog và inventory trên MySQL 8.0.41 InnoDB tạm. Docker MySQL dev đang dừng. Quy mô thực đo 2.400 sản phẩm, 9.600 biến thể, 1.600 metadata ảnh và 12.000 biến động. Các truy vấn xếp hạng catalog dùng filesort/bảng tạm. Lịch sử tồn đọc ngược index ghép. Ghi truy vấn, tham số, key, ước lượng và kết quả đo ở [Baseline M4-09](../docs/06-TEST_RELEASE.md#m4-09--baseline-explain-catalog-và-lịch-sử-tồn).

**Kiểm tra M4-09:** `npm run db:migrate --workspace apps/api` và `npm run test:prepare --workspace apps/api` PASS trên DB tạm, seed cuối và 21 plan PASS, đã dọn instance. Hai lượt chuẩn bị trước đó dừng ở seed bảng tạm và phát lại kiểu bind LIMIT/OFFSET, đã sửa harness và chạy lại. Kiểm thử API, Expo và đo tải HTTP NOT RUN trong task baseline SQL.

**M4-07:** WAITING_FRONTEND, đã duyệt triển khai frontend ngày 2026-11-24. Người B phụ trách catalog/search/detail trên Expo Android/Web. API `GET /api/v1/products`, `GET /api/v1/products/:productId` và URL ảnh công khai đã có. Bộ lọc danh mục còn chờ API public `GET /api/v1/categories`. Chờ chứng cứ loading/empty/error trên hai nền tảng và kiểm chứng chọn đúng `variant.id`, khóa mua khi biến thể hết tồn để bổ sung M4-03. Smoke Expo NOT RUN vì workspace chưa có app Expo.

**M4-08:** WAITING_FRONTEND, PLAN FAST đã duyệt ngày 2026-11-24. Người B tích hợp giao diện Admin Web bằng API danh mục/sản phẩm/biến thể, upload ảnh và điều chỉnh/xem lịch sử tồn từ OpenAPI v1.1.0. Chờ Expo Web từ M2-01/M2-08 và phiên Admin từ M3-06 để kiểm chứng luồng tạo sản phẩm, sửa sản phẩm, điều chỉnh tồn theo SKU có lý do và đối chiếu lịch sử sau reload. Smoke Expo Web NOT RUN vì workspace chưa có Expo app.

**M4-06:** Đã nghiệm thu. API Admin Web upload JPEG/PNG và CRUD metadata ảnh, có preview Admin và URL công khai theo trạng thái catalog. Lưu filesystem local qua `LocalImageStorage`, dùng `PRODUCT_IMAGE_DIR` (mặc định `storage/local/product-images`) và storageKey do server sinh. File giới hạn 5 MiB và 16 megapixel, kiểm tra MIME, đuôi, tên, nội dung giải mã. Metadata và audit cùng transaction, file mới được dọn khi DB xác nhận không còn tham chiếu sau lỗi. Schema DB giữ nguyên. OpenAPI v1.1.0 thêm 3 route ảnh, giữ nguyên route/schema có trước.

**Kiểm tra M4-06:** Windows, Node v24.14.1, Prisma 7.10.1, MySQL 8.0.41 InnoDB và thư mục ảnh tạm. `npm run test:product-images --workspace apps/api` PASS 4/4 (JPEG/PNG, đọc sau restart, metadata và visibility, từ chối upload sai, audit rollback và dọn file). Regression `node --test apps/api/test/<suite>.integration.cjs` PASS catalog 6/6, auth 9/9, admin-catalog 4/4 và inventory 4/4. `npm test --workspace apps/api` PASS 13/13. `db:migrate`, build, lint, typecheck, format:check PASS. Lint lần đầu báo regex nhận diện ký tự điều khiển, đã giới hạn ngoại lệ ngay tại regex và chạy lại PASS. Đã dọn MySQL và thư mục ảnh tạm. Manual/Expo Android/Web NOT RUN.

**M4-05:** Đã nghiệm thu. Admin Web có thể POST delta/lý do và GET lịch sử phân trang tại `/api/v1/admin/inventory/:variantId/adjustments`. Migration `20261124000001_add_inventory_movements` thêm lịch sử có FK đến biến thể và actor. `order_id` nullable cho điều chỉnh thủ công, bổ sung FK khi có bảng đơn. Điều chỉnh tồn, movement và audit cùng transaction. Tồn 1 với hai request trừ 1 trả một 201 và một 409, tồn cuối 0 và đúng một movement/audit. Audit lỗi rollback cả tồn và movement.

**Kiểm tra M4-05:** Windows, Node v24.14.1, Prisma 7.10.1 và MySQL 8.0.41 InnoDB tạm. `npm run db:migrate --workspace apps/api` PASS (4 migration), build PASS qua `test:prepare`. Lệnh `node --test apps/api/test/<suite>.integration.cjs`: inventory PASS 4/4, catalog PASS 6/6, admin-catalog PASS 4/4 và auth PASS 9/9. `npm test --workspace apps/api` PASS 13/13. Lint, typecheck và format:check PASS. Đã dọn MySQL tạm. Manual và Expo NOT RUN. Migration mới chưa áp dụng vào DB dev.

**M4-04:** Đã nghiệm thu. CRUD danh mục, sản phẩm và biến thể trong `/api/v1/admin` dùng phiên Admin Web và Origin/CSRF cho thao tác ghi. Migration `20261124000000_add_admin_audit_logs` bổ sung bảng audit theo Data Model. Ghi CRUD và audit trong cùng transaction. Biến thể khởi tạo tồn 0. FK và unique của catalog được giữ nguyên.

**Kiểm tra M4-04:** Windows, Node v24.14.1, Prisma 7.10.1 và MySQL 8.0.41 InnoDB tạm. `db:migrate` PASS (3 migration), `npm run test:admin-catalog --workspace apps/api` PASS 4/4, `node --test apps/api/test/catalog.integration.cjs` PASS 6/6 và `node --test apps/api/test/auth.integration.cjs` PASS 9/9. `npm test --workspace apps/api` PASS 13/13. Build, lint, typecheck và format:check PASS. Ca rollback đã kiểm chứng bằng trigger MySQL trên DB tạm. Lần đầu tạo trigger qua prepared statement trả 1295, đã chuyển sang text protocol trong test và chạy lại PASS. Đã dọn instance tạm. Manual và Expo NOT RUN. Migration mới đã kiểm chứng trên DB tạm, chờ chạy trên DB dev khi tích hợp.

**M4-03:** WAITING_FRONTEND. `GET /api/v1/products/:productId` trả toàn bộ biến thể ACTIVE của sản phẩm công khai, gồm SKU hết hàng và giá/tồn kho theo từng biến thể. ID sai hoặc sản phẩm không công khai trả 404. M4-07 bàn giao bằng chứng chọn đúng `variant.id` theo size/màu và khóa mua khi hết tồn. `images` đã có URL phục vụ ảnh từ M4-06.

**Kiểm tra M4-03:** Windows, Node v24.14.1, Prisma 7.10.1 và MySQL 8.0.41 InnoDB tạm. `db:migrate` PASS, `npm run test:catalog --workspace apps/api` PASS 6/6, `npm test --workspace apps/api` PASS 13/13. Build, lint, typecheck và format:check PASS. Đã dọn MySQL tạm. Manual và smoke Expo Android/Web NOT RUN vì chưa có bằng chứng UI.

**M4-02:** Đã nghiệm thu. `GET /api/v1/products` lọc danh mục/sản phẩm/biến thể ACTIVE, tìm theo tên/slug, lọc size và màu trên cùng biến thể, sắp theo giá thấp nhất khớp bộ lọc và phân trang theo sản phẩm. Auth và catalog dùng chung Prisma Client. Schema và migration hiện có được giữ nguyên. `images` đã có URL phục vụ ảnh từ M4-06.

**Kiểm tra M4-02:** Windows, Node v24.14.1, Prisma 7.10.1, MySQL 8.0.41 InnoDB tạm. `db:migrate` PASS, `npm run test:catalog --workspace apps/api` PASS 4/4, `node --test apps/api/test/auth.integration.cjs` PASS 9/9, `npm test --workspace apps/api` PASS 13/13. Build, lint, typecheck và format:check PASS. Đã dọn MySQL tạm. Manual và Expo Android/Web NOT RUN.

**M4-01:** Đã nghiệm thu. Đã kiểm chứng schema catalog hiện có trên Windows, Node v24.14.1, npm 11.11.0, Prisma 7.10.1 và MySQL 8.0.41 InnoDB tạm trên loopback, SQL strict mode. `db:validate`, `db:migrate` (2 migration) và `test:prepare` PASS. Qua Prisma tạo và đọc đúng quan hệ category → product → variant/image, giữ nguyên chính xác `179000.01` và `9999999999.99` với `DECIMAL(12,2)`. MySQL từ chối ba FK sai (1452), hai ca xóa cha có tham chiếu (1451), SKU trùng giữa hai sản phẩm (1062), giá vượt miền (1264), giá âm và tồn kho âm (3819). Đã dọn MySQL tạm. Kiểm thử API NOT RUN vì task chỉ kiểm chứng schema hiện có.

**M3-08:** REVIEW ma trận backend. Integration test M4-04 đã bổ sung ca Admin nhận 200 và Customer nhận 403 trên cùng route `GET /api/v1/admin/categories`. M3 gate còn mở, chờ bằng chứng frontend và phê duyệt.

| Ca M3-08 | Kết quả |
| --- | --- |
| 401: `GET /me` thiếu hoặc hết phiên, phiên logout không dùng lại được | PASS trong `test:auth` |
| 403: Web ghi thiếu/sai CSRF, Admin gọi API địa chỉ Customer | PASS trong `test:auth` |
| IDOR địa chỉ: A không thấy địa chỉ B và PATCH chéo trả 404 | PASS. Bản ghi B giữ nguyên |
| 403: Customer gọi API quản trị và Admin gọi thành công trên cùng route | PASS trong `test:admin-catalog`. `GET /api/v1/admin/categories` trả 403 cho Customer và 200 cho Admin Web |
| Smoke Admin Web và Customer Expo Android/Web | NOT RUN. Chờ triển khai frontend M3-06/M3-07 |

**Kiểm tra M3-08:** Windows, Node v24.14.1, npm 11.11.0, Prisma 7.10.1, MySQL 8.0.41 InnoDB tạm. `db:migrate` PASS, `test:auth` PASS 9/9, `npm test` PASS 13/13. Build, lint, typecheck và format:check PASS. Đã dọn instance và DB tạm.

**M3-05 đã nghiệm thu.** Đã triển khai `GET /api/v1/me` và `GET/POST /api/v1/me/addresses`, `PATCH /api/v1/me/addresses/:addressId` theo contract, dùng Bearer Android hoặc cookie Web. Ghi Web kiểm tra Origin và CSRF. PATCH giới hạn theo ID địa chỉ và ID Customer trong phiên.

**Kiểm tra M3-05:** Windows, Node v24.14.1, npm 11.11.0, Prisma 7.10.1 và MySQL 8.0.41 InnoDB tạm trên loopback. `db:migrate`, build, lint, typecheck và format:check PASS. `test:auth` PASS 9/9 (Customer A không thấy địa chỉ B, PATCH chéo trả 404 và địa chỉ B giữ nguyên, xác thực Android/Web, Admin bị từ chối ở địa chỉ, CSRF và DTO). `npm test` PASS 13/13. Đã dọn instance MySQL tạm. Expo, trình duyệt thực và manual test của chủ dự án NOT RUN.

**M3-04 đã nghiệm thu.** Seed Admin nội bộ báo lỗi và rollback khi email Admin demo đã thuộc tài khoản khác vai trò. Seed lặp giữ nguyên Admin hiện có. Đăng ký công khai tiếp tục chỉ tạo Customer.

**Kiểm tra M3-04:** Windows, Node v24.14.1, npm 11.11.0, MySQL 8.0.41 InnoDB tạm trên loopback. `db:migrate`, `db:seed`, build, lint, typecheck và format:check PASS. `test:auth` PASS 8/8 (seed mới và seed lặp, xung đột email không nâng quyền, đăng ký chặn trường role, Admin đăng nhập Web và bị từ chối trên Android API). `npm test` PASS 13/13. Đã dọn instance và dữ liệu DB tạm. Expo, trình duyệt thực và manual test của chủ dự án NOT RUN.

**M3-03 đã nghiệm thu.** Đã triển khai `GET /api/v1/auth/csrf` theo contract và dùng chung kiểm tra phiên với logout.

**Kiểm tra M3-03:** Windows, Node v24.14.1, npm 11.11.0 và MySQL 8.0.41 InnoDB tạm trên loopback. `db:migrate` PASS (2 migration hiện có), `test:auth` PASS 7/7 (Argon2id, digest phiên, Origin/CSRF, hạn, thu hồi, trạng thái tài khoản và kiểm tra lộ credential), `npm test` PASS 13/13. Build, lint, typecheck và format:check PASS. Đã dọn instance và dữ liệu DB tạm. Expo, trình duyệt thực và manual test của chủ dự án NOT RUN.

**Bằng chứng M3-02 đã nghiệm thu:** M3-01 cũng đã nghiệm thu. Windows/Node v24.14.1, MySQL 8.4.13 tạm: db:migrate PASS, test:auth PASS 6/6 cho đăng ký, Argon2id, Android/Web, Origin/CSRF, hạn và thu hồi phiên, giới hạn thử và log NestJS. npm test PASS 13/13. Build, lint, typecheck và format:check PASS. Container test đã dọn. Expo và trình duyệt thực NOT RUN. M2-10 vẫn BLOCKED. M2-02, M2-03, M2-04 và M2-09 vẫn REVIEW. M1-09/M1-10 theo dõi riêng.

**Repository code:** Có `apps/api` và lockfile ở root. Chưa có `apps/mobile/package.json` tại thời điểm kiểm tra. Git ở nhánh `main`, chưa có commit.

## Quyết định người dùng đã xác nhận
- Single-vendor fashion e-commerce, không Seller/multi-vendor.
- MVP đầu **Customer + Admin** và các nghiệp vụ mua/bán, tồn kho, đơn, đánh giá, thanh toán demo.
- MVP hoàn chỉnh mở role **Staff** từ quyền vận hành của Admin, reuse services.
- Expo + NestJS + MySQL. AI sau: Python/FastAPI + Colab thử pretrained VTON, không GPU mạnh/không ngân sách trả phí.
- Nhóm 2, solo-first; hướng học để phỏng vấn; phải theo dõi tiến trình bằng file.

- Android + Web là phạm vi demo tạm thời. Chủ dự án cho phép thiết kế M1 khi Q01/Q02 còn mở.

## Hiện đã thực hiện
- Đã **soạn/cập nhật hồ sơ kế hoạch** PRD, Architecture, Data Model, UI, RBAC, Roadmap, Tasks, AI Handoff, test plan.
- **CHƯA** xác nhận deadline/rubric chính thức hoặc chọn gateway P1. MVP A đã chốt COD mô phỏng. NestJS trả GET /api/v1/health với HTTP 200 trên localhost. Health này kiểm tra tiến trình HTTP. Migration đầu tiên đã kiểm chứng trên MySQL tạm. Kiểm thử nghiệp vụ, benchmark và deploy chưa thực hiện.
- Không đánh dấu bất kỳ task triển khai nào hoàn thành chỉ vì đã tạo tài liệu.

## Bộ hồ sơ bổ sung (v0.3)
- Đã tạo tài liệu dùng cho Codex: `docs/09-BACKEND_GUIDELINES.md`, `templates/BACKEND_SESSION_PROMPT.md`, `tracking/SETUP_CHECKLIST.md`.
- Có `contracts/openapi.yaml` v1.1.0 APPROVED với 52 thao tác MVP A, gồm 3 route ảnh bổ sung ở M4-06. Auth theo ADR-0003, ORM theo ADR-0002. NestJS 11.2.11 và TypeScript 5.9.3 đã kiểm chứng với Node v24.14.1/npm 11.11.0 trên Windows. Prisma CLI, Client và adapter MariaDB 7.10.1 đã kiểm chứng kết nối MySQL 8.4.13 bằng client sinh tự động trên máy này. Phiên bản Expo còn chờ kiểm chứng riêng.

## Blockers / open decisions
`tracking/OPEN_QUESTIONS.md`: Q01 deadline, Q02 phạm vi nền tảng, Q03 guest cart, Q11 hosting, Q12 teammate, Q13 policy dữ liệu, Q14 tổ chức ứng dụng quản trị.

## Phần chờ frontend — Antigravity

- **M2-01, M2-08:** Chờ shell Expo, routes/API client và smoke test gọi health API từ Android/Web. Kiểm tra workspace ngày 2026-11-22 chỉ thấy `apps/api` trong `apps/`. `apps/mobile/package.json` chưa có. Expo Android/Web **NOT RUN**. M2-10 vẫn **BLOCKED**, chờ bằng chứng Expo và phê duyệt gate.
- **M3-06, M3-07:** Admin Login UI/Auth Guard và Customer Auth UI.
- **M4-07, M4-08:** Catalog/Search/Product Detail UI và Admin Product/Inventory UI.
- **M5-09:** Cart/Checkout/Order Success UI, WAITING_FRONTEND. Handoff API và bằng chứng backend ở mục M5-09 phía trên.
- **M6-03, M6-05:** Admin Order Management UI và Customer Ratings/Comments UI.

Bảy task giao diện M3–M6 được giao cho Antigravity ngày 2026-11-23. Các dòng task vẫn mở. Với task hỗn hợp, Codex bàn giao bằng chứng API và các chi tiết tích hợp theo contract đã được duyệt.

## Bằng chứng demo M2-10

- Windows, Node v24.14.1, npm 11.11.0. `npm test --workspace apps/api`: lần đầu 9/10, ca E2E timeout chờ API. Chạy lại cùng lệnh PASS 10/10 (unit 3, integration HTTP 6, E2E 1).
- Smoke riêng trên tiến trình NestJS thật: `GET /api/v1/health` → HTTP 200 `{"status":"ok"}`. `docker compose ps mysql` → healthy tại 127.0.0.1:3307. Truy vấn MySQL xác nhận 8.4.13, InnoDB và fashioncommerce_dev có 0 bảng.
- Migration và seed lặp dùng bằng chứng trên MySQL tạm từ M2-05/M2-06 đã nghiệm thu. Hai thao tác này không chạy lại trong demo. Expo Android/Web NOT RUN vì chưa có apps/mobile/package.json.

## Next actions

Antigravity cung cấp bản Expo tích hợp và bằng chứng E2E theo ba dòng nền tảng của M6-09 ở trên. Đối chiếu với hồi quy backend trước khi trình M6-09 nghiệm thu.

Antigravity dùng `listAdminUsers` và `setAccountStatus` cho màn hình tài khoản Admin Web, xử lý 409 khi tài khoản nằm ngoài phạm vi quản lý và yêu cầu Customer đăng nhập lại sau mở khóa. Antigravity dùng API review khi tích hợp M6-05 và dùng endpoint lịch sử, chi tiết, điều phối và hủy đơn khi tích hợp M6-03.

Chủ dự án review và nghiệm thu M5-01. Antigravity thu bằng chứng M5-09 qua API thật trên Expo Web/Android để ghép với bằng chứng backend M5-10 và trình phê duyệt M5 gate.

Chủ dự án review và nghiệm thu baseline M4-09. Khi M4-07/M4-08 sẵn sàng, người B demo Admin tạo sản phẩm và nhập tồn trên Web, Customer tìm cùng sản phẩm và chọn đúng SKU trên Expo Web/Android. Ghi môi trường, mã sản phẩm hoặc SKU và kết quả từng bước để trình nghiệm thu M4-10.

Người B tích hợp M4-07 bằng API danh sách, chi tiết và Image.url từ OpenAPI v1.1.0. Thu bằng chứng loading/empty/error trên Expo Android/Web. Người B triển khai M4-08 và thu bằng chứng Admin Web tạo–sửa sản phẩm, điều chỉnh tồn theo SKU và đối chiếu lịch sử qua API thật. Người B tiếp tục tích hợp UI Admin Web và Customer Expo để bổ sung bằng chứng cho M3 gate.

Khi tích hợp M4-07, người B kiểm chứng chọn đúng biến thể và khóa mua biến thể hết hàng để nghiệm thu M4-03.

1. Người B tích hợp Admin Login UI/Auth Guard (M3-06) và Customer Auth UI (M3-07). Thu bằng chứng đăng nhập Customer qua Expo Android/Web. Dùng API quản trị đã có để tích hợp Admin Web. Bằng chứng API Admin 200 và Customer 403 đã ghi ở ma trận M3-08. Bổ sung bằng chứng Expo từ M2-01/M2-08 trước khi trình phê duyệt M2 gate.
2. Antigravity tiếp tục phần frontend đang chờ. Khi có shell Expo, kiểm chứng lệnh khởi động Mobile và smoke test health trên Android/Web để bổ sung bằng chứng M2-01/M2-08.
3. Theo dõi wireframes Customer và Admin/Staff ở M1-09/M1-10.
4. Rà Q01/Q02 khi có hạn và rubric chính thức. M0-02 vẫn mở theo phê duyệt M0 gate.

## Hướng dẫn bàn giao
Đọc `AGENTS.md` + chính file này + task được giao. Trước khi sửa code phải xác nhận có source thực tế; báo rõ test nào chưa chạy.
