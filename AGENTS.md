# AGENTS.md — Quy tắc cộng tác giữa người phát triển và AI

> Áp dụng cho ChatGPT, Claude, Copilot, Cursor và các coding agent có quyền đọc repository. Đây là **context engineering bằng Markdown + Git**, không phải RAG tự động hay bộ nhớ dài hạn được bảo đảm.

## 0. Nguyên tắc không được vi phạm
- **Chỉ viết code khi PRD/M0 đã được người dùng duyệt, task đã được giao và PLAN đã được xác nhận.** Không chấp nhận một tài liệu tự sinh là bằng chứng người dùng đã duyệt.
- Kiến trúc đã chọn: **single-vendor fashion e-commerce**, Customer + Admin ở MVP đầu, sau đó thêm Staff bằng phân quyền chi tiết; **KHÔNG** tạo Seller, Shops, multi-vendor, shop_orders hoặc seller payouts.
- Stack cố định: React Native + Expo + TypeScript, NestJS + TypeScript, MySQL InnoDB. AI tách nhánh Python/FastAPI + Colab (nghiên cứu), mặc định tắt khi chưa tích hợp thực tế.
- Ưu tiên miễn phí/local; không tự tạo tài khoản cloud, dùng dịch vụ trả phí hoặc yêu cầu GPU cho luồng mua hàng.
- Không tự sửa/xóa dữ liệu, chạy destructive migration, push remote, deploy, thay đổi kiến trúc, thêm dependency lớn, hoặc sửa quyền truy cập mà chưa được phê duyệt.

## 1. Thứ tự đọc tối thiểu mỗi phiên (Progressive Disclosure)
1. `AGENTS.md` (file này) → `tracking/CURRENT_STATE.md` — snapshot, milestone, trạng thái thực.
2. `tracking/TASKS.md` — CHỈ mục task ID đang thực hiện, dependency và acceptance.
3. `tracking/OPEN_QUESTIONS.md` — nếu task có quyết định chưa chốt.
4. Chỉ đọc PRD, kiến trúc, data model, RBAC hoặc tài liệu khác khi liên quan trực tiếp. Khi làm API, đọc phần tương ứng trong `contracts/openapi.yaml`. Đọc source/test liên quan đến task.
5. Khi cần lý do một quyết định, xem ADR tương ứng trong `docs/adr/`.

## 2. Nguồn sự thật và mức độ ưu tiên
1. Yêu cầu và phê duyệt **mới nhất** của người dùng.
2. `docs/01-PRD.md` đã được phê duyệt; `docs/06-RBAC.md` và ADR được phê duyệt.
3. Source code và tests thực tế (khi đã có) cho trạng thái triển khai.
4. `tracking/TASKS.md` lưu backlog và trạng thái từng task. `tracking/CURRENT_STATE.md` lưu tiến độ hiện tại.
5. AI chat cũ là tham khảo, không thay thế hồ sơ Git. Nếu tài liệu và code lệch, báo bất nhất, không âm thầm sửa.

## 3. Ưu tiên BACKEND FIRST

- Codex phụ trách NestJS, MySQL, REST API, validation, auth, phân quyền và kiểm thử backend. Antigravity phụ trách Expo Android/Web và giao diện Admin. Codex làm phần backend được giao và handoff dựa trên contract đã duyệt. Thay đổi PRD, kiến trúc, schema đã duyệt, RBAC, contract hoặc mã task cần yêu cầu rõ ràng.
- Với task hỗn hợp, ghi chứng cứ backend đã có và phần còn chờ frontend. Ghi `WAITING_FRONTEND` khi phần việc hoặc bằng chứng tiếp theo phụ thuộc trực tiếp vào frontend. Task và milestone vẫn mở đến khi đạt acceptance, kể cả kiểm thử tích hợp thực tế nếu được yêu cầu.
- Có thể triển khai backend độc lập khi đã đủ dependency thực tế và có phê duyệt đúng phạm vi. Thứ tự milestone dùng để theo dõi nghiệm thu. Dependency bắt buộc và quyền phê duyệt milestone vẫn áp dụng.
- Khi prompt, template hoặc hướng dẫn cũ khác quy tắc workflow tại đây, áp dụng file này và yêu cầu mới nhất của người dùng.

## 3a. Bốn cổng làm từng chức năng

- **Gate A — PLAN:** Xác định task ID, dependency và acceptance. Người dùng phải duyệt PLAN trước khi code ở cả hai chế độ.
  - **FAST:** Task thông thường, ít rủi ro. PLAN ngắn gồm mục tiêu, file dự kiến, test và rủi ro. Có thể duyệt chung tối đa 2–3 task liên quan có phạm vi rõ ràng. Triển khai tuần tự trong nhóm đã duyệt, kiểm tra dependency trước mỗi task và nghiệm thu từng task theo acceptance của task đó.
  - **STRICT:** Duyệt riêng từng task về auth, JWT/token, refresh/phiên, băm mật khẩu, RBAC/ownership, migration/thay đổi schema quan trọng, thanh toán, checkout, transaction, tồn kho đồng thời, idempotency hoặc thay đổi kiến trúc/bảo mật quan trọng. PLAN mô tả file, cấu hình, API và DB bị ảnh hưởng, ca thành công, ca lỗi và lệnh kiểm thử rủi ro trọng yếu.
- **Gate B — CODE REVIEW:** Giới hạn thay đổi trong phạm vi đã duyệt. Tóm tắt diff bằng đường dẫn và thay đổi chính. Kèm class/hàm, cấu hình, migration hoặc luồng request/data/lỗi khi cần review. Gửi diff chi tiết khi người dùng yêu cầu.
- **Gate C — TEST:** Chạy kiểm thử theo rủi ro và acceptance. Với API hoặc hành vi quan trọng có thể thao tác trực tiếp, thêm hướng dẫn tự test theo mục 3c.
- **Gate D — HANDOFF:** Ghi kết quả, blocker và bước tiếp theo trong `tracking/CURRENT_STATE.md`. Cập nhật dòng trong `tracking/TASKS.md` khi trạng thái thực tế thay đổi. Chỉ tick `[x]` khi đủ acceptance, có bằng chứng và được người dùng nghiệm thu. Giới hạn công việc trong phạm vi đã duyệt.

## 3b. Kiểm thử theo rủi ro

- Chạy unit test cho business logic bị ảnh hưởng, integration/API test cho HTTP và MySQL, test bảo mật cho auth, token, RBAC/ownership và 401/403. Chọn ca kiểm tra validation, lỗi, CRUD quan trọng, migration/ràng buộc, giỏ hàng, checkout, đơn, thanh toán, transaction, tồn kho đồng thời và idempotency theo phạm vi thay đổi.
- Chạy regression cho hành vi cũ có thể bị ảnh hưởng. Chạy full regression tại milestone gate hoặc trước khi bàn giao phiên bản, gồm các suite riêng cần thiết để đạt acceptance. Thay đổi tài liệu thuần túy chỉ cần kiểm tra tài liệu.
- Báo lệnh, môi trường và kết quả `PASS`, `FAIL` hoặc `NOT RUN`. Với test chưa chạy, ghi lý do và có cần chạy lại tại gate hay không. Kiểm thử cần cho acceptance hoặc rủi ro thực tế vẫn bắt buộc.

## 3c. Hướng dẫn tôi tự test

Sau kết quả kiểm thử của API hoặc chức năng quan trọng, thêm mục **HƯỚNG DẪN TÔI TỰ TEST** ngay trong chat. Dựa trên route, cấu hình, contract và test thực tế để nêu điều kiện chuẩn bị, lệnh khởi động, method/URL, headers, body mẫu, cách gửi qua Postman/Bruno hoặc curl, status/response dự kiến, cách kiểm tra MySQL khi cần, ca lỗi quan trọng và cách nhận biết PASS/FAIL.

Dùng dữ liệu giả và giá trị thay thế cho secret/token. Manual test bổ sung cho kiểm thử Codex phải chạy. Chỉ ghi manual test PASS sau khi người dùng xác nhận. Có thể bỏ mục này với thay đổi tài liệu, cấu hình nhỏ hoặc task không có hành vi thao tác trực tiếp.

## 4. Tiêu chuẩn bảo mật và nghiệp vụ
- Không commit `.env`, secret, token, dump DB, ảnh cá nhân, payment keys. Chỉ commit `.env.example` giả.
- Backend luôn kiểm tra `roles/permissions`, không dùng ẩn nút UI làm authorization. Customer chỉ đọc đơn/review của chính họ; Staff chỉ có quyền đã cấp; Admin thao tác nhạy cảm có audit log.
- Order total phải tính ở server từ snapshot; không tin price/role/stock từ frontend. MySQL transaction và cập nhật tồn kho atomic, kiểm thử hai checkout đồng thời khi chỉ còn 1 sản phẩm.
- Reviews phải gắn với món đã mua/đơn hoàn tất theo PRD; payment sandbox không đại diện thanh toán thật; callback/IPN cần xác minh phía server.
- AI tắt khi chưa sẵn, không ảnh hưởng catalog/cart/checkout; AI không được truy cập trực tiếp DB hoặc ảnh riêng tư không được cấp quyền.

## 4a. Comment trong source code

- Với mỗi hàm hoặc phương thức nghiệp vụ mới hay được sửa, thêm hoặc cập nhật comment tiếng Việt ngắn gọn, chuyên nghiệp để nêu chức năng chính. Ưu tiên JSDoc cho hàm quan trọng. Chỉ nêu đầu vào, đầu ra, điều kiện đặc biệt hoặc tác động phụ khi cần. Với class/service có trách nhiệm khó nhận ra, thêm một comment ngắn mô tả vai trò.
- Ưu tiên code tự giải thích. Với logic phức tạp như auth/JWT, băm mật khẩu, RBAC/ownership, transaction, tồn kho, checkout, payment, idempotency, concurrency, rollback hoặc xử lý lỗi đặc biệt, chỉ thêm comment khi cần giải thích lý do của cách xử lý.
- Giữ tên biến, class, function và thuật ngữ kỹ thuật bằng tiếng Anh theo convention TypeScript/NestJS. Cập nhật comment khi logic thay đổi. Tránh comment từng dòng, lặp tên hàm hoặc diễn giải thao tác hiển nhiên. Giới hạn comment mới trong phạm vi task.

## 5. Đầu ra chuẩn khi trả lời task

Dùng các mục **TASK / MODE / STATUS / CHANGES / TESTS / MANUAL TEST GUIDE / BLOCKERS / NEXT**. Đặt hướng dẫn tự test ngay sau TESTS khi áp dụng. STATUS dùng `DONE`, `IN_PROGRESS`, `BLOCKED` hoặc `WAITING_FRONTEND`. Task đã triển khai và chờ nghiệm thu giữ `REVIEW` trong tracking và báo `IN_PROGRESS (chờ nghiệm thu)` trong chat.

`tracking/WORKLOG.md`, `learning/` và `docs/08-LEARNING.md` là hồ sơ lưu trữ. Bỏ qua khi lấy bối cảnh và bàn giao. Giải thích code trong cuộc trò chuyện khi được yêu cầu.

Kết thúc báo cáo triển khai mỗi task backend bằng mục **LUỒNG HOẠT ĐỘNG** ngay trong chat. Viết 3–6 bước bằng tiếng Việt, nêu đúng tên và vai trò của class/function tham gia theo luồng Controller → Service → Repository/ORM → Database, theo các tầng thực sự được gọi. Nêu cách trả response hoặc xử lý lỗi khi liên quan. Tập trung vào luồng thay đổi trong task. Phần này thuộc báo cáo trong chat, không tạo tài liệu learning riêng và vẫn áp dụng kiểm thử, nghiệm thu hiện hành.

## 6. Khi mở phiên AI mới

Dùng `templates/SESSION_PROMPT.md` hoặc `templates/BACKEND_SESSION_PROMPT.md` cho Codex backend. Đọc đúng các file thực tế theo mục 1. Khi không truy cập được file cần thiết, yêu cầu người dùng cung cấp nội dung.

Khi chuẩn bị scaffold backend, xem thêm `docs/09-BACKEND_GUIDELINES.md` và `tracking/SETUP_CHECKLIST.md`.
