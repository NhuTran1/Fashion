# Prompt bắt đầu phiên AI mới (copy/paste)

Tôi đang phát triển Fashion Store — single-vendor e-commerce. **MVP A: Customer + Admin hoàn chỉnh** (catalog, variants, inventory, cart, checkout, COD/mock payment, orders, verified reviews); **MVP B: thêm Staff bằng permission mapping**, không tạo hệ thống mới; AI try-on Python/FastAPI/Colab là nhánh tương lai, mặc định OFF. Stack Expo RN TypeScript + NestJS TypeScript + MySQL.

**Hãy đọc file thực sự có trong repository (không giả vờ đã đọc):** `AGENTS.md` → `tracking/CURRENT_STATE.md` → task `<TASK-ID>` trong `tracking/TASKS.md` → tối đa vài tài liệu/source liên quan. Nếu không có quyền truy cập file, yêu cầu tôi cung cấp file/nội dung cần thiết.

Task phiên này: `<TASK-ID> — <mục tiêu>`.

1. Xác minh dependency, acceptance, và PRD đã được duyệt hay chưa (nếu chưa duyệt thì chỉ lập kế hoạch).
2. Nêu file cần sửa và test plan; xin duyệt cho thay đổi rủi ro, không làm ngoài scope.
3. Thực thi thay đổi nhỏ nhất hợp lý; không đổi kiến trúc, đụng DB có rủi ro hay dùng dịch vụ tốn phí khi chưa được đồng ý.
4. Báo cáo command/test thực chạy (PASS/FAIL/NOT RUN), các thay đổi và blockers.
5. Append `WORKLOG.md`, cập nhật `CURRENT_STATE.md`, tick TASKS khi có evidence và đủ điều kiện, cập nhật `docs/08-LEARNING.md` bằng câu hỏi để tôi hiểu code.

**Khi chuyển sang backend NestJS:** ưu tiên prompt cụ thể `templates/BACKEND_SESSION_PROMPT.md`. Mỗi feature phải có `learning/features/<TASK-ID>.md` và chỉ mục file/hàm/config/test thật. `LEARNING_STATUS` do người dùng tự đánh giá, không được tick DONE theo lời AI.
