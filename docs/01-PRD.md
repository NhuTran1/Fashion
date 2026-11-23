# PRD v1 — Fashion Store (single-vendor)

**Trạng thái APPROVED.** Chủ dự án phê duyệt PRD v1 ngày 2026-11-20. Android + Web là phạm vi demo tạm thời. Q01/Q02 tiếp tục mở đến khi có thông tin chính thức. [Phê duyệt M0 gate](../tracking/WORKLOG.md#2026-11-20--m0-07--phê-duyệt-prd-v1-và-m0-gate).

## 1. Vấn đề / mục tiêu
Khách hàng muốn mua quần áo trên Android và Web: xem sản phẩm, chọn size/màu, trả tiền theo phương thức demo, theo dõi đơn và đánh giá. Một cửa hàng cần quản lý catalog, tồn kho, đơn, thanh toán, nhân sự. Về sau tích hợp AI thử đồ bằng ảnh mà không thay đổi checkout.

Hệ thống phục vụ **một đơn vị bán hàng**. Vai trò và phạm vi theo giai đoạn:

- **MVP A — Guest:** Khách chưa đăng nhập xem catalog công khai. Giỏ hàng cho Guest chờ quyết định Q03.
- **MVP A — Customer:** Khách tự đăng ký, mua hàng và quản lý dữ liệu của mình như địa chỉ, giỏ hàng, đơn hàng và đánh giá theo quy tắc nghiệp vụ.
- **MVP A — Admin:** Tài khoản được khởi tạo theo quy trình nội bộ có kiểm soát. Admin quản lý catalog, tồn kho, đơn hàng, trạng thái tài khoản và kiểm duyệt đánh giá.
- **MVP B — Staff:** Admin tạo tài khoản và cấp quyền cho từng tác vụ vận hành. Staff thực hiện tác vụ trong phạm vi được cấp. Quyền chi tiết với catalog và giá chờ quyết định Q10.

Xem [RBAC](06-RBAC.md#phạm-vi) để đối chiếu vai trò với quyền trên từng tài nguyên.

**Cách triển khai:** Nhóm có hai người, với một người triển khai chính ở giai đoạn đầu (solo-first). Stack gồm React Native + Expo + TypeScript, NestJS + TypeScript và MySQL InnoDB. Xem [ADR-0001](adr/0001-stack.md) để biết quyết định kỹ thuật và bối cảnh.

## 2. Phạm vi ưu tiên
**MVP A/P0 — cần hoạt động từ đầu đến cuối:**
1. Auth, profile, địa chỉ (Customer), Admin sign-in và authorization server-side.
2. Catalog: category, product, ảnh, variant size × color, giá, SKU, trạng thái, tìm kiếm/lọc/sắp xếp/phân trang.
3. Cart: thêm/sửa/xóa, kiểm tra stock, tính giá phía server.
4. Checkout single-store: address snapshot, order_items price snapshot, idempotency, MySQL transaction, không oversell.
5. Thanh toán COD mô phỏng. Trạng thái thanh toán tách biệt với trạng thái đơn hàng.
6. Vòng đời đơn hàng: Customer theo dõi trạng thái nội bộ và hủy theo quy tắc. Admin xử lý đơn. Khi hủy, hoàn tồn kho tối đa một lần.
7. Inventory: theo variant; điều chỉnh có reason/audit; list history.
8. Customer đánh giá 1–5 sao và bình luận một lần trên mỗi `order_item` của mình đã giao. Admin ẩn hoặc hiện lại đánh giá kèm audit.
9. Admin: quản lý sản phẩm/danh mục, tồn kho, đơn, user status, review moderation.
10. Android + Web: hoàn thiện happy path và error/loading/empty; iOS tùy quy định và khả năng build.

**MVP B/P0-B:** phân tách operational permissions từ Admin sang Staff, Staff UI quản lý đơn/tồn kho/sản phẩm theo quyền được cấp; authorization tests deny escalation.

| Hạng mục | Ưu tiên | Phạm vi và điều kiện |
|---|---|---|
| COD mô phỏng | P0 | Bắt buộc trong MVP A. AC-06 kiểm tra COD và trạng thái thanh toán riêng. |
| Gateway mock/sandbox | P1 | Chỉ triển khai khi Q05 được duyệt. Nếu tích hợp sandbox có callback, kiểm thử xác minh chữ ký và idempotency. |
| Đánh giá và kiểm duyệt | P0 | Customer đánh giá sản phẩm đã mua sau khi đơn DELIVERED. Admin kiểm duyệt có audit. Xem AC-09 và AC-10. Quy tắc chi tiết ở §4. |
| Dashboard cơ bản và nâng cao | P1 | Áp dụng cho phạm vi hiện tại. Đối chiếu lại nếu rubric Q02/Q15 yêu cầu. |
| Chatbot FAQ và chuyển hỗ trợ cho Admin | P1 | Triển khai sau luồng mua hàng cốt lõi. |
| Trạng thái đơn nội bộ | P0 | Admin xử lý đơn, Customer theo dõi trạng thái. Xem AC-07. |
| Mô phỏng vận chuyển | P1 | Mô phỏng tracking hoặc mốc giao hàng để demo. |
| Tích hợp hãng vận chuyển thực | P2 | Tích hợp ngoài MVP A/B. |

**P1 khác nếu còn thời gian** gồm wishlist, coupon đơn giản và thông báo email.

**AI riêng, không là điều kiện nghiệm thu MVP A/B:** Try-on bằng ảnh qua FastAPI/Colab, feature flag và job status. Real-time camera try-on và split payment/marketplace thuộc P2 (ngoài phạm vi).

## 3. User stories & acceptance (có thể kiểm thử)

[Luồng người dùng](04-UI_FLOWS.md) mô tả các bước của Guest, Customer, Admin và Staff. [Ma trận nghiệm thu](06-TEST_RELEASE.md#ma-trận-nghiệm-thu-ac-01-đến-ac-14) nêu điều kiện đầu vào, thao tác, kết quả và bằng chứng cần thu cho từng AC. AC-12 áp dụng cho MVP B. AC-13 dùng Android + Web trong phạm vi demo tạm thời được duyệt. Đối chiếu lại khi có rubric Q02.

| ID | Vai trò | Chức năng | Tiêu chí nghiệm thu |
|---|---|---|---|
| AC-01 | Guest/Customer | Catalog | Chỉ product ACTIVE; pagination/filter hợp lệ; loading/empty/error |
| AC-02 | Customer | Variant + cart | Chọn đúng SKU/size/color; không add số lượng <=0; server kiểm tra giá và stock |
| AC-03 | Customer | Auth/address | Mật khẩu lưu dưới dạng hash. Yêu cầu riêng tư với thông tin xác thực thiếu hoặc hết hạn bị từ chối. Customer chỉ xem/sửa hồ sơ và địa chỉ của mình. Chiến lược session/token thuộc Q07. |
| AC-04 | Customer | Checkout | Server tính và lưu snapshot tổng tiền cùng phí giao demo 0 đồng. Order, items và trừ tồn commit hoặc rollback cùng nhau. Lặp cùng yêu cầu và key chỉ tạo một đơn. |
| AC-05 | Customer | Concurrent checkout | Với stock=1, 2 request đồng thời không tạo 2 đơn thành công, stock không âm |
| AC-06 | Customer/Admin | Payment | COD mô phỏng dùng trạng thái thanh toán riêng. Đơn bắt đầu UNPAID, chỉ PAID khi Admin xác nhận giao thành công và thu tiền mô phỏng. Đơn hủy trước thu tiền giữ UNPAID. Chỉ khi tích hợp sandbox có callback, kiểm tra xác minh chữ ký và idempotency. |
| AC-07 | Customer/Admin | Order status | Customer chỉ xem đơn của mình và chỉ hủy khi PENDING. Admin chuyển trạng thái đúng thứ tự và chỉ hủy trước SHIPPING, kèm lý do. Mỗi đơn hủy hoàn tồn đúng một lần. |
| AC-08 | Admin | Catalog + inventory | CRUD validate quyền; SKU unique; mutation stock có inventory movement + lý do |
| AC-09 | Customer | Reviews | Tối đa một đánh giá trên mỗi order_item thuộc Customer, đúng sản phẩm đã mua, đơn DELIVERED, điểm từ 1 đến 5. |
| AC-10 | Admin | Moderation | Admin ẩn hoặc hiện lại đánh giá, giữ nội dung gốc và ghi audit actor/action/timestamp. |
| AC-11 | Admin | Accounts | Không public API tự đăng ký Admin, chặn role escalation; audit thay đổi quan trọng |
| AC-12 | Staff (MVP B) | Order/inventory | Chỉ tác vụ được cấp; cấm quản lý Admin/users/permission; test 403 và ownership |
| AC-13 | Android/Web | Journey | Trên Android và Web theo phạm vi dự kiến, Customer xem catalog, thêm đúng biến thể, checkout COD, xem chi tiết đơn và thấy trạng thái Admin cập nhật. Khi API lỗi, UI báo lỗi và cho thử lại ở bước phù hợp. Đối chiếu nền tảng với Q02. |
| AC-14 | All | AI isolation | Khi TRYON_ENABLED=false, toàn bộ core commerce vẫn hoạt động; API AI không phải điều kiện để order thành công |

## 4. Quy tắc nghiệp vụ

### Checkout và tồn kho

- SKU của biến thể là duy nhất. Giá và tổng tiền dùng DECIMAL(12,2). Server lấy giá từ dữ liệu sản phẩm, tính tổng theo số lượng và phí giao hàng, rồi lưu snapshot địa chỉ, sản phẩm, giá và tổng tiền. Phí giao hàng cố định 0 đồng ở bản demo.
- Tạo đơn và dòng hàng, trừ tồn trong cùng giao dịch. Tồn kho luôn không âm. Nếu một SKU thiếu hàng, toàn bộ thao tác được hoàn tác. Cùng Customer gửi lại cùng yêu cầu và idempotency key chỉ tạo một đơn.

### Trạng thái đơn và hủy

- Đơn mới ở `PENDING`. Admin xử lý theo thứ tự `PENDING → CONFIRMED → PACKING → SHIPPING → DELIVERED`. `DELIVERED` và `CANCELLED` là trạng thái kết thúc.
- Customer chỉ xem đơn của mình và chỉ được hủy khi đơn ở `PENDING`. Admin được hủy ở `PENDING`, `CONFIRMED` hoặc `PACKING` và phải ghi lý do.
- Khi hủy thành công, chuyển sang `CANCELLED`, hoàn lại số lượng đã trừ và ghi biến động tồn kho trong cùng giao dịch. Nếu hủy lặp hoặc cạnh tranh với một yêu cầu chuyển trạng thái, chỉ thao tác hợp lệ trên trạng thái hiện tại được ghi nhận. Mỗi đơn hủy chỉ hoàn tồn một lần.

### COD và hoàn tiền

- `payment_status` tách biệt với trạng thái đơn. COD bắt đầu ở `UNPAID` và chuyển `PAID` khi Admin xác nhận giao thành công và thu tiền mô phỏng. Hủy trước thu tiền giữ `UNPAID`. Trả hàng sau giao và hoàn tiền nằm sau P0.
- Không nhập dữ liệu thẻ thật vào app hoặc biểu diễn giao dịch sandbox như thanh toán thật. Sandbox phụ thuộc Q05. Nếu có callback, xác minh chữ ký và xử lý lặp an toàn.

### Đánh giá

- Customer được tạo một đánh giá trên mỗi `order_item` của mình khi đơn ở `DELIVERED`, cho đúng sản phẩm đã mua, với điểm 1–5. Sửa hoặc xóa đánh giá của Customer nằm sau P0.
- Admin được ẩn hoặc hiện lại đánh giá. Audit ghi người thao tác, hành động và thời điểm. Nội dung gốc của Customer được giữ.

### Quyết định còn mở

- Guest xem catalog công khai. Giỏ hàng Guest thuộc Q03. Checkout yêu cầu tài khoản theo đề xuất hiện tại.

## 5. NFR / security / measurable goals
- Đo với dataset, máy, mức tải được ghi lại. Mục tiêu thử nghiệm sơ bộ p95 catalog <500ms, cart <500ms, checkout <1000ms tại API (không phải cam kết), error rate/report thực tế.
- Authn/Authz tại backend, review RBAC và IDOR, validation DTO, rate limit, secret hygiene, logging không lộ dữ liệu.
- Phân quyền Staff theo capability, không chỉ check `role==='STAFF'` cho mọi tác vụ.
- Unit/integration/e2e, concurrency test, migration up và restore database demo, Expo Android/Web smoke.
- Chi phí phát triển 0 đồng local; ảnh demo có quyền sử dụng; dữ liệu cá nhân/ảnh AI cần consent và retention khi mở tính năng.

## 6. Điều kiện nghiệm thu theo mốc
**MVP A accepted** khi AC-01..AC-11, AC-13..AC-14 đạt theo phạm vi P0. Tiêu chí callback trong AC-06 áp dụng khi tích hợp sandbox có callback. Nghiệm thu cần demo script, bằng chứng kiểm thử và xác nhận của chủ dự án. **MVP B accepted** khi AC-12 + regression MVP A đạt. Không bắt buộc AI để tick MVP A/B.

## 7. Phụ thuộc và câu hỏi
`tracking/OPEN_QUESTIONS.md` Q01–Q15: deadline, rubric, payment provider, review policy, order cancel/stock, ORM, auth, storage, UI management. Không tạo source khi chưa chốt gate M0.
