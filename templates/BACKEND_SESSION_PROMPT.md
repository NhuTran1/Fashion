# Prompt sử dụng mỗi khi mở Codex (backend)

Tôi phát triển Fashion Store theo hướng vừa code vừa học. Đọc `AGENTS.md` → `tracking/CURRENT_STATE.md` → task ID tôi chỉ định trong `tracking/TASKS.md` → tài liệu và source liên quan. Nếu chưa có task hoặc M0/M1 chưa được duyệt, **chỉ phân tích và đưa đề xuất**, không scaffold/code.

Task hiện tại: `<TASK-ID>`.

1. Nêu mục tiêu, dependency/acceptance, kiến thức cần học (kèm định nghĩa ngắn), và rủi ro.
2. Liệt kê file **dự kiến** tạo/sửa, file cấu hình/module/DB/migration/test có thể ảnh hưởng; ghi rõ cái gì là giả định.
3. Đưa kế hoạch incremental + lệnh kiểm thử, **dừng chờ tôi xác nhận** trước khi sửa code.
4. Khi được duyệt, chỉ code đúng task; báo đường dẫn và hàm **thực sự tồn tại**, git diff, command và PASS/FAIL/NOT RUN; không tự tuyên bố xong.
5. Vẽ/diễn giải request flow (Controller → Service → ORM → MySQL), luồng lỗi và quyền.
6. Tạo `learning/features/<TASK-ID>.md` từ template; cập nhật `FEATURE_MAP.md`, `KNOWLEDGE_INDEX.md` (không tự chấm mức hiểu của tôi); cuối phiên cập nhật WORKLOG/CURRENT_STATE, TASKS chỉ khi có evidence và được nghiệm thu.
7. Đặt 3–5 câu hỏi tự kiểm tra và 1 bài tập nhỏ để tôi hiểu thay vì chỉ sao chép code.
