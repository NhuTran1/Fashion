# WORKLOG — append-only, không xóa lịch sử

## 2026-11-19 — PLANNING-INIT (lưu lại từ bản cũ)
- Đã tạo bộ kế hoạch Expo + NestJS + MySQL, AI FastAPI/Colab; chưa tạo source code hay test.
- Bản đầu PRD tập trung Customer/Admin, còn thiếu reviews/Staff extension rõ ràng.

## 2026-11-19 — PLANNING-REVISION-02 — Chuyển sang single-vendor Customer/Admin → Staff
- User confirmed: không làm marketplace Buyer/Seller/Admin; làm ứng dụng của một cửa hàng. MVP A = Customer+Admin đầy đủ e-commerce, MVP B = thêm Staff qua phân quyền vận hành.
- Updated: AGENTS, README, PRD, RBAC (mới), Architecture, Data Model, UI Flows, Roadmap, Test/Release, AI Handoff, Learning, ADR, TASKS, CURRENT_STATE, OPEN_QUESTIONS, Copilot instructions, SESSION_PROMPT.
- Removed from proposed design: Shops, Seller, multi-shop cart/split orders and seller payouts. Không xóa bất kỳ source/schema thực tế nào.
- Planning artifacts created only; **application tests NOT RUN**; no migration/scaffold/deployment; no approvals inferred for PRD v1.
- Next: người dùng review PRD+RBAC+open questions; đóng M0 gate có xác nhận trước khi coding.

## Entry template
```md
## YYYY-MM-DD — TASK-ID — Tên công việc
- Status: TODO / IN_PROGRESS / BLOCKED / REVIEW / DONE
- Scope / changed files:
- Actual commands and results (PASS/FAIL/NOT RUN):
- Acceptance evidence (commit, test log, screenshot):
- ADR/decisions / approvals:
- Bugs / blockers:
- Learned / docs link:
- Next task:
```

## 2026-11-20 — PLANNING-REVISION-03 — Chuẩn bị backend và feature-based learning
- User yêu cầu chốt file/thư mục cần bổ sung để chuẩn bị code backend và theo dõi kiến thức/code theo từng task.
- Added: `learning/` index + feature/review templates; `contracts/` OpenAPI DRAFT skeleton; backend guideline, setup checklist, Codex session prompt, `.gitignore`, `.env.example`.
- Updated: `AGENTS.md`, `README.md`, `CURRENT_STATE.md`, `templates/TASK_REPORT.md`, `templates/SESSION_PROMPT.md`.
- Khả năng đọc code/test thực tế **NOT RUN**; chưa scaffold NestJS, chưa migration, chưa triển khai; M0 vẫn chờ duyệt.
- Next: owner xác nhận PRD/M0 và quyết định cần thiết, sau đó duyệt M1/M2 task đầu tiên.

## 2026-11-20 — M0-01 — Đối chiếu phạm vi và stack

- Status: REVIEW, chờ chủ dự án nghiệm thu M0-01.
- Scope: Bổ sung solo-first và stack kèm liên kết ADR-0001 trong PRD. Cập nhật CURRENT_STATE và [hồ sơ học tập M0-01](../learning/features/M0-01.md) cùng hai chỉ mục learning.
- Evidence: PASS đối chiếu năm quyết định giữa PRD, ADR-0001 và CURRENT_STATE, kiểm tra đường dẫn ADR, PRD DRAFT và M0-01 còn mở. Lint/typecheck/unit/integration/E2E NOT RUN vì nội dung thay đổi là Markdown.
- Approval: Chủ dự án duyệt kế hoạch bằng `DUYỆT M0-01: triển khai đúng plan`. PRD v1 và M0 gate vẫn chờ phê duyệt.
- Git: Workspace thiếu metadata Git. Không có branch, commit hoặc working-tree diff để dẫn chiếu.
- Next: Nghiệm thu M0-01. M0-02 chờ giao sau nghiệm thu.

## 2026-11-20 — M0-01 — Nghiệm thu

- Status: DONE. Chủ dự án xác nhận `NGHIỆM THU M0-01`.
- Evidence: PASS đối chiếu năm quyết định trong PRD và ADR-0001, cùng bằng chứng rà soát ở mục M0-01 ngay trên. Kiểm thử ứng dụng NOT RUN vì task chỉ cập nhật tài liệu.
- Handoff: Tick M0-01 trong TASKS, đồng bộ trạng thái trong CURRENT_STATE, FEATURE_MAP và hồ sơ M0-01. PRD v1 và M0 gate vẫn chờ phê duyệt.
- Next: M0-02 về deadline, rubric và nền tảng demo, chờ giao.

## 2026-11-20 — M0-03 — Phạm vi vai trò MVP A/B

- Status: REVIEW. Chủ dự án xác nhận phạm vi vai trò bằng `DUYỆT M0-03: triển khai đúng plan`. Chờ nghiệm thu kết quả.
- Scope: PRD ghi vai trò theo từng MVP. RBAC làm rõ Guest, Customer, Admin, Staff và điều kiện cấp quyền cho Staff. Q03/Q10 còn mở.
- Evidence: PASS đối chiếu bốn đối tượng, giữ nội dung 14 AC và bảng quyền, xác nhận AC-12 thuộc MVP B. Lint/typecheck/unit/integration/E2E NOT RUN vì thay đổi chỉ gồm Markdown.
- Handoff: Cập nhật CURRENT_STATE và [hồ sơ M0-03](../learning/features/M0-03.md) cùng hai chỉ mục học tập. PRD và RBAC vẫn DRAFT. M0-03 còn mở trong TASKS.
- Next: Nghiệm thu M0-03. M0-04 chờ giao, M0-02 còn Q01/Q02.

## 2026-11-20 — M0-03 — Nghiệm thu

- Status: DONE. Chủ dự án xác nhận `NGHIỆM THU M0-03`.
- Evidence: Rà soát tài liệu PASS theo mục M0-03 trước đó. Kiểm thử ứng dụng NOT RUN.
- Handoff: Đánh dấu M0-03 trong TASKS và cập nhật CURRENT_STATE, FEATURE_MAP, hồ sơ M0-03. PRD v1 và M0 gate chờ phê duyệt.
- Next: Chủ dự án đã giao M0-04. Gate A chờ duyệt kế hoạch. M0-02 còn mở.

## 2026-11-20 — M0-04 — Phạm vi P0/P1

- Status: REVIEW. Chủ dự án xác nhận `DUYỆT M0-04: triển khai đúng plan`. Chờ nghiệm thu kết quả.
- Scope: Đồng bộ bảng phạm vi PRD, AC-06, roadmap M5/M6 và các task M5-08, M6-08, P1-04.
- Evidence: PASS đối chiếu P0/P1/P2, AC-06/07/09/10, các dòng backlog và roadmap. Lint/typecheck/unit/integration/E2E NOT RUN vì task chỉ cập nhật tài liệu.
- Handoff: Cập nhật CURRENT_STATE và [hồ sơ M0-04](../learning/features/M0-04.md) cùng hai chỉ mục học tập. Q02/Q15, Q05 và Q09 còn mở. M0-04 còn mở trong TASKS.
- Next: Nghiệm thu M0-04. M0-05 chờ giao, M0-02 vẫn mở.

## 2026-11-20 — M0-04 — Nghiệm thu

- Status: DONE. Chủ dự án xác nhận `NGHIỆM THU M0-04`.
- Evidence: Rà soát bảng phạm vi, tiêu chí nghiệm thu, roadmap và backlog PASS theo mục M0-04. Kiểm thử ứng dụng NOT RUN.
- Handoff: Tick M0-04 trong TASKS, đồng bộ CURRENT_STATE, FEATURE_MAP và hồ sơ M0-04.
- Next: M0-05 đã được giao và đang ở Gate A. M0-02 và M0 gate vẫn mở.

## 2026-11-20 — M0-05 — Quy tắc đơn hàng và đánh giá

- Status: REVIEW. Chờ nghiệm thu kết quả M0-05. M0-02 và M0 gate vẫn mở.
- Approval: Chủ dự án xác nhận `DUYỆT M0-05: triển khai đúng plan`. Q04 và Q09 được ghi là RESOLVED.
- Scope: Cập nhật PRD §2–§4, mô hình dữ liệu logic và ma trận kiểm thử cho checkout, hủy/hoàn tồn, COD và đánh giá.
- Evidence: PASS đối chiếu quy tắc, trạng thái, phí giao demo, điều kiện đánh giá và các ca cạnh tranh/rollback. Lint/typecheck/unit/integration/E2E NOT RUN vì đây là task tài liệu.
- Handoff: Cập nhật CURRENT_STATE, [hồ sơ M0-05](../learning/features/M0-05.md) và hai chỉ mục học tập. Task M0-05 còn mở trong TASKS.
- Next: Nghiệm thu M0-05, sau đó M0-06 chờ giao.

## 2026-11-20 — M0-05 — Nghiệm thu

- Status: DONE. Chủ dự án xác nhận `NGHIỆM THU M0-05`.
- Evidence: Rà soát PRD, mô hình logic, ma trận ca kiểm thử và Q04/Q09 PASS theo mục M0-05 trước đó. Kiểm thử ứng dụng NOT RUN.
- Handoff: Đánh dấu M0-05 trong TASKS, cập nhật CURRENT_STATE, FEATURE_MAP và hồ sơ M0-05.
- Next: Chủ dự án đã giao M0-06. Gate A chờ duyệt kế hoạch. M0-02 và M0 gate còn mở.

## 2026-11-20 — M0-06 — User journeys và AC-01 đến AC-14

- Status: REVIEW. Chủ dự án xác nhận `DUYỆT M0-06: triển khai đúng plan`. PRD v1 là bản DRAFT chờ review và phê duyệt.
- Scope: Đồng bộ luồng Guest/Customer/Admin/Staff, làm rõ AC-03/AC-13 và ánh xạ 14 AC sang điều kiện, thao tác, kết quả và bằng chứng cần thu.
- Evidence: PASS kiểm tra tài liệu đủ 14 AC duy nhất trong PRD và ma trận, đúng trường kiểm chứng và luồng MVP. Lint/typecheck/unit/integration/E2E NOT RUN vì task cập nhật Markdown.
- Handoff: Cập nhật CURRENT_STATE, [hồ sơ M0-06](../learning/features/M0-06.md) và hai chỉ mục học tập. M0-06 chờ nghiệm thu.
- Next: M0-07 đã được giao. M0-02 và M0 gate còn mở, chưa chuyển M1.

## 2026-11-20 — M0-06 — Nghiệm thu

- Status: DONE. Chủ dự án xác nhận `NGHIỆM THU M0-06`.
- Evidence: Rà soát 14 AC và luồng MVP PASS theo mục M0-06 trước đó. Kiểm thử ứng dụng NOT RUN.
- Handoff: Tick M0-06 trong TASKS, cập nhật CURRENT_STATE, FEATURE_MAP và hồ sơ M0-06.

## 2026-11-20 — M0-07 — Rà soát điều kiện phê duyệt M0

- Chủ dự án yêu cầu thực hiện M0-07. Đã đối chiếu PRD v1, checklist M0 và roadmap.
- Status: BLOCKED. M0-02 còn mở vì Q01/Q02 chưa đủ xác nhận. PRD v1 vẫn DRAFT, chờ xác nhận rõ phạm vi phê duyệt PRD v1/M0 và xử lý blocker trước khi chuyển M1.
- Next: Chốt thông tin Q01/Q02 hoặc ghi quyết định của chủ dự án về cách xử lý các mục chưa có thông tin chính thức.

## 2026-11-20 — M0-07 — Phê duyệt PRD v1 và M0 gate

> Tôi duyệt PRD v1 và M0 gate, cho phép chuyển M1. Dùng Android + Web làm phạm vi demo tạm thời và để Q01/Q02 mở đến khi có thông tin chính thức

- Status: DONE. PRD v1 APPROVED, M0 gate đã duyệt và CURRENT_STATE chuyển sang M1 — thiết kế.
- Phạm vi tạm thời: Android + Web. Q01/Q02 và M0-02 còn mở đến khi có thông tin chính thức.
- Evidence: PASS kiểm tra đồng bộ PRD, TASKS, CURRENT_STATE, Q01/Q02 và SETUP_CHECKLIST. Kiểm thử ứng dụng NOT RUN vì task cập nhật tài liệu.
- Next: M1-01 chờ giao. Scaffold M2 chờ phê duyệt M1 và giao task.

## 2026-11-20 — M1-01 — Modular monolith và điểm tích hợp AI

- Status: REVIEW. Chủ dự án xác nhận `DUYỆT M1-01: triển khai đúng plan`. Architecture v1 chờ nghiệm thu.
- Scope: Làm rõ ranh giới module, giao dịch checkout/hủy, điểm tích hợp AI mặc định tắt, dashboard P1 và gateway phụ thuộc Q05.
- Evidence: PASS rà soát tài liệu theo AC-04/05/07/14. Lint/typecheck/unit/integration/E2E NOT RUN vì task cập nhật Markdown.
- Handoff: Cập nhật CURRENT_STATE, [hồ sơ M1-01](../learning/features/M1-01.md) và hai chỉ mục học tập. M1-01 và M1 gate còn mở.
- Next: Nghiệm thu M1-01, sau đó M1-02 chờ giao.

## 2026-11-20 — M1-01 — Nghiệm thu

- Status: DONE. Chủ dự án xác nhận `NGHIỆM THU M1-01`. Architecture v1 APPROVED.
- Evidence: Rà soát thiết kế checkout và ranh giới AI PASS theo mục M1-01 trước đó. Kiểm thử ứng dụng NOT RUN.
- Handoff: Đánh dấu M1-01 hoàn tất trong TASKS. Đồng bộ Architecture v1, CURRENT_STATE, FEATURE_MAP và hồ sơ M1-01.
- Next: M1-02 đã được giao, chờ duyệt phương án ORM ở Gate A. M1 gate vẫn mở.

## 2026-11-20 — M1-02 — Chọn Prisma ORM 7

> **M1-02:** Chọn **Prisma ORM 7 + MySQL InnoDB**, dùng migration có phiên bản và kiểm tra bộ phiên bản tương thích khi scaffold.

- Status: REVIEW. [ADR-0002](../docs/adr/0002-orm.md) chờ nghiệm thu. Q06 và M1-02 còn mở.
- Scope: Ghi lựa chọn Prisma ORM 7 + MySQL InnoDB, migration có phiên bản, kiểm tra phiên bản khi scaffold và nguyên tắc bảo toàn giao dịch.
- Evidence: PASS rà soát ADR theo Architecture v1, data model và Q06. Lint/typecheck/unit/integration/E2E và migration NOT RUN vì task cập nhật Markdown.
- Handoff: Cập nhật CURRENT_STATE, [hồ sơ M1-02](../learning/features/M1-02.md) và hai chỉ mục học tập. Chưa cài package.
- Next: Nghiệm thu ADR-0002 và M1-02, sau đó M1-03 chờ giao.

## 2026-11-20 — M1-02 — Nghiệm thu

- Status: DONE. Chủ dự án xác nhận `NGHIỆM THU M1-02`. ADR-0002 ACCEPTED và Q06 RESOLVED với Prisma ORM 7 + MySQL InnoDB.
- Evidence: PASS đồng bộ ADR, Q06, backlog, trạng thái và hồ sơ học tập. Kiểm thử ứng dụng và migration NOT RUN.
- Handoff: Liên kết quyết định ORM từ Architecture v1 và ADR-0001. Bộ phiên bản cụ thể được kiểm tra khi scaffold.
- Next: M1-03 đã được giao, ở Gate A. Q07 còn mở.

## 2026-11-20 — M1-03 — Chính sách phiên Android và Web

- Approval: Chủ dự án xác nhận `DUYỆT M1-03: phiên lưu phía server, triển khai đúng plan`.
- Status: REVIEW. [ADR-0003](../docs/adr/0003-auth-session.md) ghi chính sách Android/Web, thời hạn, mô hình mối đe dọa và ca kiểm thử. Q07 và M1-03 còn mở.
- Scope: Cập nhật ADR và API outline cũ về refresh. Endpoint chi tiết thuộc M1-08.
- Evidence: PASS rà soát tài liệu theo Architecture v1, AC-03/11 và Q07. Lint/typecheck/unit/integration/E2E NOT RUN vì task cập nhật tài liệu.
- Handoff: Cập nhật CURRENT_STATE, [hồ sơ M1-03](../learning/features/M1-03.md) và hai chỉ mục học tập.
- Next: Nghiệm thu ADR-0003 và M1-03, sau đó M1-04 chờ giao.

## 2026-11-20 — M1-03 — Nghiệm thu

- Chủ dự án xác nhận `NGHIỆM THU M1-03`. ADR-0003 ACCEPTED, Q07 RESOLVED và M1-03 DONE.
- Rà soát đồng bộ hồ sơ PASS. Kiểm thử ứng dụng NOT RUN.
- M1-04 ở Gate A. Q10 còn mở.

## 2026-11-20 — M1-04 — RBAC v1

- Chủ dự án duyệt kế hoạch M1-04. RBAC v1 REVIEW, Q10 chờ nghiệm thu.
- Rà soát tài liệu PASS: quyền Staff theo tài khoản, catalog giới hạn mô tả/ảnh và ca từ chối AC-12. Kiểm thử ứng dụng NOT RUN.
- M1-05 đã giao, đang ở Gate A.

## 2026-11-20 — M1-04 — Nghiệm thu

- Chủ dự án xác nhận `NGHIỆM THU M1-04`. RBAC v1 APPROVED, Q10 RESOLVED và M1-04 DONE.

## 2026-11-20 — M1-05 — DATA_MODEL v1

- Chủ dự án xác nhận `DUYỆT M1-05: triển khai đúng plan`. DATA_MODEL v1 REVIEW.
- Rà soát tài liệu PASS: ERD, 23 FK, kiểu dữ liệu, phiên, quyền Staff và ca kiểm chứng. Prisma schema, migration, kiểm thử MySQL và ứng dụng NOT RUN.
- Next: Nghiệm thu M1-05. M1-06 chờ giao.

## 2026-11-20 — M1-05 — Nghiệm thu

- Chủ dự án xác nhận `NGHIỆM THU M1-05`. DATA_MODEL v1 APPROVED, M1-05 DONE.
- Kiểm tra đồng bộ tài liệu PASS. Kiểm thử MySQL và ứng dụng NOT RUN.
- M1-06 đã giao, ở Gate A.

## 2026-11-20 — M1-06 — Checkout và hoàn tồn

- Chủ dự án xác nhận `DUYỆT M1-06: triển khai đúng plan`. Trạng thái REVIEW.
- Rà soát tài liệu PASS: giao dịch, khóa checkout theo Customer, hoàn tồn một lần và chín ca kiểm chứng. MySQL, migration và kiểm thử ứng dụng NOT RUN.
- Next: Nghiệm thu M1-06. M1-07 chờ giao.

## 2026-11-20 — M1-06 — Nghiệm thu

- Chủ dự án xác nhận `NGHIỆM THU M1-06`. Task DONE.
- Kiểm tra đồng bộ hồ sơ PASS. Kiểm thử ứng dụng NOT RUN.
- M1-07 đã giao, đang ở Gate A.

## 2026-11-20 — M1-07 — Đánh giá và kiểm duyệt

- Chủ dự án xác nhận `DUYỆT M1-07: triển khai đúng plan`. Trạng thái REVIEW.
- Rà soát tài liệu PASS: điều kiện AC-09, kiểm duyệt và audit AC-10, bảy ca kiểm chứng. MySQL, migration và kiểm thử ứng dụng NOT RUN.
- Next: Nghiệm thu M1-07. M1-08 chờ giao.

## 2026-11-20 — M1-07 — Nghiệm thu

- Chủ dự án xác nhận `NGHIỆM THU M1-07`. Task DONE, thiết kế AC-09/AC-10 đã nghiệm thu.
- Kiểm tra đồng bộ hồ sơ PASS. Kiểm thử MySQL và ứng dụng NOT RUN.
- Next: M1-08 chờ giao.

## 2026-11-20 — M1-08 — API contract v1

- Chủ dự án xác nhận `DUYỆT M1-08: triển khai đúng plan`. Contract REVIEW.
- Sau khi dừng tiến trình Python cũ, dùng apply_patch cập nhật OpenAPI, README handoff và hồ sơ task.
- `npx --offline --yes @apidevtools/swagger-cli validate contracts/openapi.yaml` PASS. Python PASS kiểm tra 49 thao tác trên 38 path, refs, tham số path, quyền, lỗi và checkout replay. Kiểm thử ứng dụng NOT RUN.
- Git status/diff không khả dụng do workspace thiếu metadata Git.
- Next: Nghiệm thu M1-08. M1-09 chờ giao.

## 2026-11-20 — M1-08 — Nghiệm thu

- Chủ dự án xác nhận `NGHIỆM THU M1-08`. Task DONE, OpenAPI v1.0.0 và quy ước lỗi đã nghiệm thu.
- Cập nhật metadata contract và trạng thái theo bằng chứng kiểm tra OpenAPI và nhất quán ở mục trên. Kiểm thử ứng dụng NOT RUN.
- M1-09 đã giao, ở Gate A để lập kế hoạch bàn giao cho Antigravity.

## 2026-11-20 — M1-09 — Handoff wireframes Customer

- Chủ dự án xác nhận `DUYỆT M1-09: triển khai đúng plan`. Handoff đã soạn trong UI_FLOWS và contracts/README.
- Kiểm tra tài liệu bằng Python trên Windows PASS: 8 nhóm màn hình, 22 operationId tồn tại trong OpenAPI v1.0.0, mã 409 và kết quả checkout 200/201 khớp. Kiểm thử ứng dụng NOT RUN.
- Chờ wireframes Android/Web của Antigravity để review loading, empty và error. M1-09 vẫn mở. OpenAPI v1.0.0 không đổi.

## 2026-11-20 — M1-10 — Handoff Admin và Staff

- Chủ dự án xác nhận `DUYỆT M1-10: triển khai đúng plan`. Handoff trong UI_FLOWS và contracts/README.
- Python trên Windows PASS: 6 nhóm màn hình Admin, 19 operationId và 4 quyền Staff đối chiếu với OpenAPI/RBAC. Kiểm thử ứng dụng NOT RUN.
- Chờ Antigravity bàn giao wireframes và review điều hướng theo quyền. Q14 còn mở.

## 2026-11-20 — M1-11 — Ảnh local và COD mô phỏng

- Chủ dự án xác nhận `DUYỆT M1-11: local storage + COD mô phỏng`. ADR-0004 REVIEW, ghi quyết định ở Q05/Q08.
- Python trên Windows PASS: đối chiếu storageKey, COD-only, confirmDeliveryAndCod và phạm vi MVP A với OpenAPI. Kiểm thử upload, MySQL, Android/Web và ứng dụng NOT RUN.
- Chờ nghiệm thu ADR-0004. Contract upload và gateway P1 cần quyết định riêng. M1-09, M1-10, M1-11 và M1 gate vẫn mở.

## 2026-11-20 — M1-11 — Nghiệm thu

- Chủ dự án xác nhận `NGHIỆM THU M1-11`. ADR-0004 ACCEPTED, Q05/Q08 RESOLVED trong phạm vi ảnh local và COD mô phỏng, M1-11 DONE.
- Dựa trên bằng chứng đối chiếu tài liệu ở mục trên. Kiểm thử ứng dụng NOT RUN.
- Chủ dự án giao M1-12. M1-09 và M1-10 còn chờ wireframes. M1 gate và M2-01 tiếp tục chờ phê duyệt.

## 2026-11-20 — M1-12 — Rà soát điều kiện M1 gate

- Chủ dự án duyệt kế hoạch review M1-12. Architecture, ORM/auth, RBAC, mô hình dữ liệu, checkout, reviews, OpenAPI và ADR ảnh/COD đã được nghiệm thu theo M1-01 đến M1-08 và M1-11.
- Status: BLOCKED. M1-09 và M1-10 đã có handoff, chưa có wireframes trong hồ sơ để review trạng thái Customer và điều hướng Admin/Staff theo quyền. Review wireframes và kiểm thử ứng dụng NOT RUN.
- M1 gate chưa đóng. M2-01 chưa được giao. Checklist scaffold vẫn theo dõi phiên bản Node/stack và phạm vi scaffold.

## 2026-11-20 — M1-12 — Phê duyệt M1 gate

> phê duyệt M1 gate và duyệt phạm vi M2-01

- Chủ dự án cho phép chuyển sang M2 và thực hiện M2-01 theo phạm vi đã nêu. M1-12 DONE.
- M1-09 và M1-10 tiếp tục chờ wireframes và nghiệm thu riêng. Phê duyệt gate không thay bằng chứng của hai task đó.

## 2026-11-20 — M2-01 — Scaffold npm workspace và NestJS

- Status: IN_PROGRESS. Tạo root npm workspace, lockfile và scaffold `apps/api`. Shell Expo do Antigravity phụ trách theo contracts/README.
- Môi trường Windows, Node v24.14.1, npm 11.11.0, NestJS 11.2.11, Nest CLI 11.0.24 và TypeScript 5.9.3.
- PASS: `npm install --no-audit --no-fund`, `npm run build --workspace apps/api`, `npm run typecheck --workspace apps/api`. `npm run start:dev --workspace apps/api` và `GET http://127.0.0.1:3000/` trả HTTP 200 với JSON `{"status":"ok"}`. Đã dừng tiến trình smoke check.
- NOT RUN: Mobile/Expo và Android/Web, do chưa có `apps/mobile/package.json`. Lint, unit, integration, E2E và migration chưa chạy.
- Git diff không khả dụng do workspace thiếu metadata Git. M2-01 vẫn mở vì tiêu chí yêu cầu cả Mobile và API khởi động.

## 2026-11-20 — M2-02 — Git local, env mẫu và README

- Chủ dự án xác nhận `DUYỆT M2-02: triển khai đúng plan`. Khi bắt đầu triển khai, Git đã có nhánh `main` và index trống.
- Cập nhật `.gitignore`, `.env.example` và README để khớp với scaffold và ADR phiên. Dùng Git local đã có.
- PASS: kiểm tra ignore, giữ env ví dụ/lockfile trong phạm vi theo dõi và rà ứng viên theo mẫu secret bằng Python. Không in giá trị phát hiện. Kiểm thử ứng dụng NOT RUN.
- Đã stage danh sách 63 file được rà. Kiểm tra lại 63 blob trong index không phát hiện mẫu secret. Cấu hình Codex và báo cáo Word để ngoài index. Chưa tạo commit.
- M2-02 REVIEW. M2-01 vẫn chờ shell Expo.


## 2026-11-24 — M2-01 / M1-09 / M1-10 (Frontend Expo + Mock OpenAPI v1.0.0) — Nhánh feat/frontend-expo-mock
- Status: REVIEW, chờ chủ dự án kiểm tra và nghiệm thu trên nhánh `feat/frontend-expo-mock`.
- Scope / changed files:
  - Scaffold `apps/mobile/` (Expo SDK 58 + React Native Web + TypeScript + `expo-secure-store`), cập nhật `package-lock.json` ở root workspace.
  - `src/types/api.ts`: Khai báo đầy đủ DTO, ID chuỗi số, tiền Decimal 2 chữ số, Error payload và Staff RBAC theo `contracts/openapi.yaml` v1.0.0 & `docs/06-RBAC.md`.
  - `src/mock/seedData.ts`, `src/mock/mockServer.ts`, `src/api/client.ts`, `src/api/sessionStore.ts`: Mock backend stateful toàn bộ 41+ thao tác OpenAPI v1.0.0, ADR-0003 session/CSRF, idempotency checkout 201/200/409, hoàn tồn một lần, verified-purchase review, Admin audit logs và giả lập lỗi QA Sim.
  - `src/screens/customer/*` & `src/screens/admin/*`: Hoàn thiện toàn bộ luồng Customer (Catalog, Chi tiết/Biến thể/Đánh giá, Auth, Địa chỉ, Giỏ hàng, Checkout COD mô phỏng, Lịch sử/Hủy/Đánh giá) và Admin Web-first + Staff MVP B RBAC preview (Catalog, Tồn kho, Đơn hàng & Thu COD, Kiểm duyệt Đánh giá, Tài khoản & Audit).
- Actual commands and results:
  - `npm run typecheck --workspace apps/mobile`: PASS (0 errors).
  - `npm run typecheck --workspace apps/api`: PASS (0 errors).
  - `node /tmp/fashion-mock-test/scripts/verifyMockContracts.js`: PASS (`ALL OPENAPI v1.0.0 & RBAC v1 MOCK CONTRACT CHECKS PASSED`).
  - `cd apps/mobile && EXPO_NO_TELEMETRY=1 HOME=/tmp npx expo export --platform web --output-dir /tmp/fashion-web-dist`: PASS (221 modules bundled, 587KB web bundle).
  - Playwright Chromium E2E Smoke Test (`http://127.0.0.1:4173`): PASS (0 console/page errors — verified Catalog pagination, Product Detail, Customer login, Cart -> COD Checkout 201, Customer 403 Admin guard, Admin login).
  - Android runtime / live NestJS MySQL integration: NOT RUN (backend API endpoints chưa triển khai trong `apps/api`).
- Next task: Chủ dự án review nhánh `feat/frontend-expo-mock`, chạy `npm run web --workspace apps/mobile` hoặc tích hợp với backend NestJS khi Codex hoàn thành M2–M6.


## 2026-11-24 — UI/UX & Motion Polish (Nhánh feat/frontend-expo-mock)
- Scope: Bổ sung hệ thống motion (`src/components/Motion.tsx`: `FadeSlideIn`, `InteractiveCard`, `FloatingAmbient`, `ShimmerBlock`, `AnimatedProgressTrack`), bo góc đa tầng (`radius.xs/sm/md/lg/pill`), bóng đổ (`shadows.soft/card/lifted`), header kính mờ sticky trên Web, pill filters/selectors, timeline tiến trình đơn hàng và làm sạch thumbnail ảnh sản phẩm.
- Actual commands and results:
  - `npm run typecheck --workspace apps/mobile`: PASS (0 errors).
  - `npm run typecheck --workspace apps/api`: PASS (0 errors).
  - `node /tmp/fashion-mock-test/scripts/verifyMockContracts.js`: PASS (`ALL OPENAPI v1.0.0 & RBAC v1 MOCK CONTRACT CHECKS PASSED`).
  - `EXPO_NO_TELEMETRY=1 HOME=/tmp npx expo export --platform web --output-dir /tmp/fashion-web-dist`: PASS (294 modules, 731KB web bundle).
  - Playwright Chromium E2E Smoke Test (`http://127.0.0.1:4174`): PASS (`PLAYWRIGHT E2E WEB SMOKE TEST PASSED (0 errors)`).


## 2026-11-24 — Catalog Right Collapsible Search Sidebar (Nhánh feat/frontend-expo-mock)
- Scope: Chuyển khu vực tìm kiếm & bộ lọc Catalog sang sidebar bên phải tay người dùng (`CatalogScreen.tsx`): sticky panel đóng/mở mượt trên desktop (`>= 920px`) và right slide-over drawer trên màn hình nhỏ (`< 920px`), kèm chip tóm tắt bộ lọc đang bật có thể gỡ trực tiếp.
- Actual commands and results:
  - `npm run typecheck --workspace apps/mobile` & `npm run typecheck --workspace apps/api`: PASS (0 errors).
  - `EXPO_NO_TELEMETRY=1 HOME=/tmp npx expo export --platform web --output-dir /tmp/fashion-web-dist`: PASS (299 modules, 744KB).
  - Playwright Chromium E2E Smoke Test (`http://127.0.0.1:4176`): PASS (`PLAYWRIGHT E2E WEB SMOKE TEST PASSED (0 errors)`), bao gồm đóng/mở sidebar tìm kiếm bên phải.


## 2026-11-24 — Full-screen Layout, Flush Docked Sidebar & 3:4 Portrait Garment Proportions (Nhánh feat/frontend-expo-mock)
- Scope: Gỡ giới hạn `maxWidth` trên Storefront (`AppShell`, `CatalogScreen`, `ProductDetailScreen`, `AdminWorkspaceScreen`) để hiển thị toàn màn hình; neo sidebar tìm kiếm bên phải full-height liền mạch ngay dưới header (không còn khoảng thừa phía trên khi cuộn); đổi tỉ lệ khung ảnh áo quần sang khối chữ nhật đứng `3:4` và kéo dài hình khối áo/quần trong `GarmentArtwork`.
- Actual commands and results:
  - `npm run typecheck --workspace apps/mobile` & `npm run typecheck --workspace apps/api`: PASS (0 errors).
  - `EXPO_NO_TELEMETRY=1 HOME=/tmp npx expo export --platform web --output-dir /tmp/fashion-web-dist`: PASS (294 modules, 744KB).
  - Playwright Chromium E2E Smoke Test (`1440x900`, `http://127.0.0.1:4177`): PASS (`PLAYWRIGHT E2E WEB SMOKE TEST PASSED (0 errors)`).


## 2026-11-24 — Bean Farm Storefront Redesign for Fashion (Nhánh feat/frontend-expo-mock)
- Scope: Thiết kế lại toàn bộ giao diện theo phong cách Bean Farm (`#0E8A44` emerald, `#F5B82E` amber, `#DDF3E8` mint hero, `#E53935` quick-order/badge): Header 2 tầng (logo + thanh tìm kiếm + Giỏ hàng có badge, thanh dưới gồm nút `☰ Danh mục sản phẩm`, nav pill và `Mua hàng nhanh`), Hero Mint Banner, dải `Danh mục nổi bật`, khối `Bán chạy nhất hàng ngày`, lưới thẻ áo quần khối chữ nhật `3:4` kèm nút `Thêm vào giỏ`, và sidebar bên phải đóng/mở với 2 thẻ tiêu đề xanh `DANH MỤC SẢN PHẨM` & `BỘ LỌC SẢN PHẨM`.
- Actual commands and results:
  - `npm run typecheck --workspace apps/mobile` & `npm run typecheck --workspace apps/api`: PASS (0 errors).
  - `EXPO_NO_TELEMETRY=1 HOME=/tmp npx expo export --platform web --output-dir /tmp/fashion-web-dist`: PASS (294 modules, 756KB).
  - Playwright Chromium E2E Smoke Test (`1440x900`, `http://127.0.0.1:4179`): PASS (`PLAYWRIGHT E2E WEB SMOKE TEST PASSED (0 errors)`).


## 2026-11-24 — Multi-color Card Swatches, Hover Actions, Quick View, Sản phẩm View & Vouchers (Nhánh feat/frontend-expo-mock)
- Scope:
  - Bổ sung chọn nhiều màu trực tiếp trên thẻ sản phẩm (`ProductPortraitCard`: chấm tròn màu có viền active, tự đổi màu áo và giá theo biến thể màu đang chọn).
  - Thêm hiệu ứng hover hiện thanh 3 nút tròn (`⚙ Tùy chọn`, `👁 Xem nhanh`, `＋ Thêm nhanh giỏ`) và hộp thoại `QuickViewModal` ([QuickViewModal.tsx](apps/mobile/src/components/QuickViewModal.tsx)).
  - Tách riêng tab `Trang chủ` (`home`) và tab `Sản phẩm` (`products` với banner `Tất cả sản phẩm`, breadcrumb `Trang chủ › Tất cả sản phẩm`, dải danh mục tròn và lưới sản phẩm).
  - Bổ sung dải 4 thẻ Voucher (`VoucherStrip.tsx`: `HELLO`, `FREESHIP`, `SOI50K`, `SOI50` kèm nút `Sao chép` & xem điều kiện) và ô nhập kiểm tra mã P1 Preview ở Checkout.
- Actual commands and results:
  - `npm run typecheck --workspace apps/mobile` & `npm run typecheck --workspace apps/api`: PASS (0 errors).
  - `EXPO_NO_TELEMETRY=1 HOME=/tmp npx expo export --platform web --output-dir /tmp/fashion-web-dist`: PASS (301 modules, 777KB).
  - Playwright Chromium E2E Smoke Test (`1440x900`, `http://127.0.0.1:4180`): PASS (`PLAYWRIGHT E2E WEB SMOKE TEST PASSED (0 errors)`).


## 2026-11-24 — Edge Reopen Handle, Centered Hover Icons & Carousel Arrows (Nhánh feat/frontend-expo-mock)
- Scope:
  - Bổ sung tab mở lại bộ lọc ngay mép phải (`‹ Bộ lọc`) khi thu gọn sidebar ([CatalogScreen.tsx](apps/mobile/src/screens/customer/CatalogScreen.tsx)).
  - Căn giữa cụm nút hover trong khung `3:4`, tăng kích thước `48x48` kèm phóng to `scale: 1.18` khi rê chuột từng icon.
  - Thêm nút cuộn ngang `‹` / `›` cho `Danh mục nổi bật`, `VoucherStrip` và `Bán chạy nhất hàng ngày`.
- Actual commands and results:
  - `npm run typecheck --workspace apps/mobile` & `npm run typecheck --workspace apps/api`: PASS (0 errors).
  - `EXPO_NO_TELEMETRY=1 HOME=/tmp npx expo export --platform web --output-dir /tmp/fashion-web-dist`: PASS (295 modules, 782KB).
  - Playwright Chromium E2E Smoke Test (`1440x900`, `http://127.0.0.1:4181`): PASS (`PLAYWRIGHT E2E WEB SMOKE TEST PASSED (0 errors)`).
