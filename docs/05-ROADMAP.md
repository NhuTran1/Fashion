# Roadmap v0.2 — MVP A → MVP B → AI (không cam kết deadline)

**Nguyên tắc:** Solo-first, 2 thành viên khi có thể. Đường găng là **khách mua → quản trị xử lý → tồn kho đúng**. AI R&D không được chặn đường găng. Timeline theo tuần chỉ thiết lập khi biết deadline/rubric và giờ thực tế.

| Milestone | Phạm vi | Bằng chứng chuyển mốc |
|---|---|---|
| M0 — Requirements | PRD v1, actor, P0/P1, order/payment/review rules | Người dùng ký duyệt PRD; open blockers resolved |
| M1 — Design | Architecture, RBAC, ERD, API, UI flows, ADR | Architecture/design approved |
| M2 — Foundation | Git, Expo, NestJS, MySQL Docker, env, migrations, tests | Android/Web can call API; migration/test smoke |
| M3 — Auth & Admin foundation | Customer/Admin identity, authorization, profile, admin login, policies | Auth, 401/403/IDOR tests |
| M4 — Product & inventory | Catalog admin CRUD; variants, images, stock movements; customer browse/search | Product vertical slice E2E |
| M5 — Cart, checkout, payment | Cart, address, orders, stock transaction, COD mô phỏng | Place order E2E + concurrent stock=1 test |
| M6 — Operations & reviews (MVP A) | Xử lý và theo dõi trạng thái đơn nội bộ, hủy đơn, đánh giá và kiểm duyệt | Customer/Admin end-to-end script + review tests |
| **GATE A — MVP A ACCEPTED** | Customer + Admin e-commerce | Người dùng nghiệm thu + test evidence, không cần Staff hoặc AI |
| M7 — Staff extension (MVP B) | Role/permission grants, staff UI; reuse service logic | Staff denial/allow matrix + regression MVP A |
| **GATE B — MVP B ACCEPTED** | Customer + Staff + Admin | Người dùng nghiệm thu |
| M8 — Release readiness | Security, load test, Android/Web UX, CI, backup/restore, demo report | Release checklist + rollback rehearsal |
| AI — Independent track | Colab baseline, license, FastAPI prototype, future job contract | R&D evidence; không gây regress MVP A/B |

## Thứ tự ưu tiên khi thiếu thời gian
1. M0–M5, đạt full checkout và Admin xử lý đơn.
2. M6, reviews và nghiệm thu MVP A.
3. M7 Staff (ưu tiên trước chatbot/shipping/AI integration).
4. M8 hardening: kiểm thử bảo mật và demo quan trọng hơn tính năng mở rộng.
5. AI image try-on và các hạng mục P1 nếu còn thời gian. Xem [bảng phạm vi trong PRD](01-PRD.md#2-phạm-vi-ưu-tiên) cho dashboard, chatbot, mô phỏng vận chuyển và gateway mock/sandbox theo Q05.

## Chiến lược solo-first
- Chia mỗi milestone thành vertical slices 0.5–2 ngày công **chỉ khi có ước lượng thực tế**, không ép cứng lịch.
- Với một người, song song AI tối đa ở mức có thể dừng ngay; không train từ đầu, không thuê GPU.
- Khi thành viên thứ hai tham gia: ưu tiên bàn giao UI screens/tests hoặc AI prototype qua API contract; không cùng sửa một module không cần thiết.

## Sprint cadence
- Đầu sprint: chọn 2–5 task đã rõ dependency, review rủi ro và acceptance.
- Mỗi task: plan → code → test → evidence → tick nếu Done.
- Cuối sprint: review demo, ghi điều đã học, cập nhật CURRENT_STATE, đánh giá còn bao lâu mới đạt GATE A/B.
- Không tự động chuyển mốc khi chưa có bằng chứng và xác nhận.
