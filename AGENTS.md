# AGENTS.md — Quy tắc cộng tác giữa người phát triển và AI

> Áp dụng cho ChatGPT, Claude, Copilot, Cursor và các coding agent có quyền đọc repository. Đây là **context engineering bằng Markdown + Git**, không phải RAG tự động hay bộ nhớ dài hạn được bảo đảm.

## 0. Nguyên tắc không được vi phạm
- **Không viết code khi PRD/M0 chưa được người dùng duyệt và task chưa được giao.** Không chấp nhận một tài liệu tự sinh là bằng chứng người dùng đã duyệt.
- Kiến trúc đã chọn: **single-vendor fashion e-commerce**, Customer + Admin ở MVP đầu, sau đó thêm Staff bằng phân quyền chi tiết; **KHÔNG** tạo Seller, Shops, multi-vendor, shop_orders hoặc seller payouts.
- Stack cố định: React Native + Expo + TypeScript, NestJS + TypeScript, MySQL InnoDB. AI tách nhánh Python/FastAPI + Colab (nghiên cứu), mặc định tắt khi chưa tích hợp thực tế.
- Ưu tiên miễn phí/local; không tự tạo tài khoản cloud, dùng dịch vụ trả phí hoặc yêu cầu GPU cho luồng mua hàng.
- Không tự sửa/xóa dữ liệu, chạy destructive migration, push remote, deploy, thay đổi kiến trúc, thêm dependency lớn, hoặc sửa quyền truy cập mà chưa được phê duyệt.

## 1. Thứ tự đọc tối thiểu mỗi phiên (Progressive Disclosure)
1. `AGENTS.md` (file này) → `tracking/CURRENT_STATE.md` — snapshot, milestone, trạng thái thực.
2. `tracking/TASKS.md` — CHỈ mục task ID đang thực hiện, dependency và acceptance.
3. `tracking/OPEN_QUESTIONS.md` — nếu task có quyết định chưa chốt.
4. Đọc 1–3 tài liệu trong `docs/` có liên quan và source file cần chỉnh. **Không đọc toàn bộ WORKLOG/codebase theo mặc định.**
5. Khi cần lý do một quyết định, xem `docs/adr/` và đoạn WORKLOG liên quan.

## 2. Nguồn sự thật và mức độ ưu tiên
1. Yêu cầu và phê duyệt **mới nhất** của người dùng.
2. `docs/01-PRD.md` đã được phê duyệt; `docs/06-RBAC.md` và ADR được phê duyệt.
3. Source code và tests thực tế (khi đã có) cho trạng thái triển khai.
4. `tracking/TASKS.md` là danh sách việc, `CURRENT_STATE.md` là snapshot; WORKLOG là lịch sử append-only.
5. AI chat cũ là tham khảo, không thay thế hồ sơ Git. Nếu tài liệu và code lệch, báo bất nhất, không âm thầm sửa.

## 3. Quy trình bắt đầu và kết thúc từng task
**Bắt đầu:** Nhắc task ID, mục tiêu, dependency, acceptance; đọc đúng file; đưa kế hoạch thay đổi nhỏ, rủi ro, test plan; chờ xác nhận đối với thay đổi có tác động quan trọng.

**Thực hiện:** Chỉ sửa phạm vi task; giữ typing, validation, transaction, RBAC/ownership; luôn nghĩ về trường hợp lỗi; không tạo giả dữ liệu người dùng thật; không thêm tính năng ngoài backlog.

**Kiểm tra:** Nêu cụ thể lint/typecheck/unit/integration/E2E nào đã chạy, PASS/FAIL, command và môi trường. Không chạy được phải ghi **NOT RUN**, không suy diễn thành PASS.

**Kết thúc:** Append `tracking/WORKLOG.md`; cập nhật `CURRENT_STATE.md` (task hiện tại, commit nếu biết, next task, blockers); update trạng thái trong `TASKS.md`. Tick `[x]` **chỉ khi có chứng cứ & đủ tiêu chí Done, với milestone cần chủ dự án duyệt**. Tạo/cập nhật `learning/features/<TASK-ID>.md` từ template; cập nhật `learning/FEATURE_MAP.md` để truy vết file/hàm/config/test thật và `learning/KNOWLEDGE_INDEX.md` để theo dõi kiến thức (**không tự chấm mức hiểu của người dùng**). `docs/08-LEARNING.md` chỉ là nhật ký tổng kết. Ghi ADR nếu thay đổi quyết định dài hạn và đã duyệt.

## 3a. Bốn cổng làm từng chức năng — bắt buộc
- **Gate A — PLAN:** Giải thích mục tiêu, kiến thức, file dự kiến, config, API, database, test; **chờ người dùng xác nhận trước khi code**.
- **Gate B — CODE REVIEW:** Sau sửa, báo `git diff`, tên file/class/hàm thực tế và lý do từng file liên quan, phân loại `CREATED`, `MODIFIED`, `RELATED_UNCHANGED`, `CONFIG`, `MIGRATION`, `TEST`.
- **Gate C — TEST & LEARN:** Chạy test, báo chứng cứ, nêu luồng request/data/errors, 3–5 câu hỏi và bài tập nhỏ; trạng thái kỹ thuật khác trạng thái hiểu bài.
- **Gate D — HANDOFF:** Hoàn thành tài liệu feature/map/index, worklog/state; chỉ đánh dấu DONE khi có evidence và được nghiệm thu. Không tự chạy task khác.

## 4. Tiêu chuẩn bảo mật và nghiệp vụ
- Không commit `.env`, secret, token, dump DB, ảnh cá nhân, payment keys. Chỉ commit `.env.example` giả.
- Backend luôn kiểm tra `roles/permissions`, không dùng ẩn nút UI làm authorization. Customer chỉ đọc đơn/review của chính họ; Staff chỉ có quyền đã cấp; Admin thao tác nhạy cảm có audit log.
- Order total phải tính ở server từ snapshot; không tin price/role/stock từ frontend. MySQL transaction và cập nhật tồn kho atomic, kiểm thử hai checkout đồng thời khi chỉ còn 1 sản phẩm.
- Reviews phải gắn với món đã mua/đơn hoàn tất theo PRD; payment sandbox không đại diện thanh toán thật; callback/IPN cần xác minh phía server.
- AI tắt khi chưa sẵn, không ảnh hưởng catalog/cart/checkout; AI không được truy cập trực tiếp DB hoặc ảnh riêng tư không được cấp quyền.

## 5. Đầu ra chuẩn khi trả lời task
`Mục tiêu → Trạng thái/điều kiện → File sẽ đọc/sửa → Kế hoạch → Thay đổi thực tế → Kiểm thử (lệnh + kết quả) → Rủi ro/việc chờ → Log cập nhật → Điều cần học → Next task`.

## 6. Khi mở phiên AI mới
Dùng `templates/SESSION_PROMPT.md`; cung cấp repository/file thực tế qua công cụ hỗ trợ. Nếu AI không có quyền đọc file, phải yêu cầu cung cấp nội dung hoặc đính kèm, **không tuyên bố đã đọc**. Không yêu cầu AI duyệt toàn bộ repo để lấy lại bối cảnh.

**Riêng Codex backend:** dùng `templates/BACKEND_SESSION_PROMPT.md`, xem `docs/09-BACKEND_GUIDELINES.md`, `tracking/SETUP_CHECKLIST.md` khi chuẩn bị scaffold; không đọc toàn bộ `learning/features/` trừ task liên quan.
