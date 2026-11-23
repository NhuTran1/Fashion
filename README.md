# Fashion Store — Single-vendor E-commerce + AI Try-On (future)

**Trạng thái:** PRD v1 và M1 gate đã được duyệt. Workspace có scaffold NestJS chạy local. Shell Expo đang chờ Antigravity. Theo dõi tiến độ tại [CURRENT_STATE](tracking/CURRENT_STATE.md).

## Phạm vi đã chọn
- **MVP A (ưu tiên):** Hoàn thiện luồng e-commerce với **Customer + Admin**: sản phẩm, biến thể, tồn kho, giỏ, checkout COD mô phỏng, đơn, đánh giá/bình luận và quản trị. Gateway mock/sandbox thuộc P1.
- **MVP B:** Bổ sung **Staff** từ quyền vận hành đã xây ở MVP A; không viết lại modules hoặc hệ thống đơn hàng.
- **AI branch:** thử đồ bằng ảnh (Python/FastAPI, pretrained model, Colab thử nghiệm) sau/nhẹ song song; mặc định OFF, không chặn MVP A/B.
- **Không phải marketplace**: một cửa hàng, không có Seller/Shop approval/split orders.
- **Stack:** Expo React Native + TypeScript; NestJS TypeScript; MySQL InnoDB; Docker local khi được duyệt.

## Khởi động API local

Môi trường đã kiểm chứng cho scaffold là Windows, Node.js `v24.14.1` và npm `11.11.0`. Chạy từ thư mục gốc:

```powershell
npm ci
npm run start:dev --workspace apps/api
```

Trong một terminal khác, gọi `Invoke-RestMethod http://127.0.0.1:3000/`. Scaffold trả HTTP 200 với `{"status":"ok"}`. Có thể chạy `npm run build --workspace apps/api` và `npm run typecheck --workspace apps/api` để kiểm tra biên dịch.

`.env.example` chỉ mô tả tên biến và giá trị mẫu cho các task cấu hình sau. Scaffold hiện dùng localhost cổng 3000, chưa đọc file env và chưa cần MySQL. Khi có shell Expo trong `apps/mobile`, dùng [quy ước workspace trong tài liệu bàn giao](contracts/README.md).

## Git và cấu hình cục bộ

Dùng `git status --short` và `git diff --cached` để rà đúng file trước commit. Theo dõi `.env.example` và `package-lock.json`. Cấu hình thật nằm trong `.env` cục bộ, được Git bỏ qua cùng dependency, đầu ra build và dữ liệu local.

## Khởi động một phiên vibe coding
1. AI đọc `AGENTS.md` và `tracking/CURRENT_STATE.md`.
2. Chọn một task theo ID từ `tracking/TASKS.md`; xem dependency và điều kiện Done.
3. Đọc đúng 1–3 tài liệu liên quan; chỉ xem code module đang làm.
4. Kế hoạch thay đổi/test → thực hiện khi được phép → chạy kiểm tra → append `WORKLOG.md`, cập nhật `CURRENT_STATE.md` và checklist sau khi có evidence.
5. Viết 3–5 dòng `docs/08-LEARNING.md`: giải thích tại sao làm, rủi ro, kiến thức phỏng vấn.

## Mục lục hồ sơ
| File | Công dụng |
|---|---|
| `AGENTS.md` | Quy tắc AI, ranh giới quyền hành và cách đọc ngữ cảnh |
| `docs/01-PRD.md` | Yêu cầu đã/chưa xác nhận, P0/P1, acceptance theo chức năng |
| `docs/02-ARCHITECTURE.md` | Sơ đồ, module, hệ thống miễn phí, future AI seam |
| `docs/03-DATA_MODEL.md` | ERD logic, constraints, transaction, migration |
| `docs/04-UI_FLOWS.md` | Màn hình Customer/Admin/Staff, loading/error/empty |
| `docs/05-ROADMAP.md` | Milestone MVP A → MVP B → AI, dependency và gate |
| `docs/06-RBAC.md` | Ma trận quyền và test authorization |
| `docs/06-TEST_RELEASE.md` | Kịch bản test, DoD, demo, backup, release |
| `docs/07-AI_HANDOFF.md` | API contract dành cho AI sau này |
| `docs/08-LEARNING.md` | Nhật ký tự học và kiến thức phỏng vấn |
| `docs/adr/` | Ghi quyết định kiến trúc có lý do và trạng thái |
| `tracking/TASKS.md` | Checklist task theo milestone, ID ổn định |
| `tracking/CURRENT_STATE.md` | Snapshot ngắn, thay thế phần lớn việc đọc chat cũ |
| `tracking/WORKLOG.md` | Nhật ký append-only, chứng cứ test/commit |
| `tracking/OPEN_QUESTIONS.md` | Điều cần xác nhận trước khi code/thiết kế |
| `templates/SESSION_PROMPT.md` | Mẫu mở phiên AI mới |

## Cách đọc trạng thái
- `[ ]` chưa Done, kể cả task đang IN_PROGRESS.
- `[x]` Done = đạt acceptance, có test bằng chứng, tài liệu cập nhật, đúng thẩm quyền duyệt.
- `OPEN / IN_PROGRESS / BLOCKED / REVIEW / DONE` ghi riêng, không tự đánh dấu vì code đã được sinh.
- M0 là phân tích yêu cầu; **“MVP A” không đồng nghĩa M0**.

## Quản lý tiến độ không phải RAG
Đây là **Markdown + Git + context handoff**, không có embedding/vector DB, indexing hay truy xuất RAG tự động. `CURRENT_STATE` chứa snapshot; `TASKS` chứa backlog; `WORKLOG` là lịch sử; `ADR` là lý do quyết định. RAG chỉ thêm khi tài liệu/code nhiều và có nhu cầu tra cứu ngữ nghĩa; không cần cho sinh viên ở giai đoạn đầu.

## Tính khả thi và ngân sách
Mặc định sử dụng công cụ open-source/local, dữ liệu giả, COD/môi trường sandbox. Dịch vụ cloud có quota/điều kiện và có thể cần phương thức thanh toán; cần duyệt riêng. Không phụ thuộc GPU để hoàn thiện mua hàng. Chưa chốt deadline/rubric nên roadmap theo milestone, không cam kết số tuần.

## Hướng dẫn bắt đầu backend và học theo task (bổ sung v0.3)
1. **Chưa code ngay** nếu PRD M0 hoặc thiết kế M1 chưa được duyệt; xem `tracking/SETUP_CHECKLIST.md`.
2. Cho Codex đọc `AGENTS.md` → `tracking/CURRENT_STATE.md` → task được giao trong `tracking/TASKS.md`; thêm `docs/09-BACKEND_GUIDELINES.md` và `contracts/README.md` khi cần.
3. Dùng prompt `templates/BACKEND_SESSION_PROMPT.md` (PLAN → duyệt → CODE → TEST → LEARN → HANDOFF).
4. Mỗi feature có hồ sơ `learning/features/<TASK-ID>.md`, chỉ mục file/hàm trong `learning/FEATURE_MAP.md`, mức hiểu trong `learning/KNOWLEDGE_INDEX.md`.
5. [OpenAPI v1.0.0](contracts/openapi.yaml) là contract MVP A đã nghiệm thu. Route nghiệp vụ được triển khai theo task tương ứng.
6. Git giữ trạng thái code; `tracking/TASKS.md` giữ trạng thái công việc; `CURRENT_STATE.md` là snapshot; `WORKLOG.md` là lịch sử; **mức học do bạn đánh giá**.
