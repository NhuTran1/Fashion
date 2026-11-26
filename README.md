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
npm run db:generate --workspace apps/api
npm run start:dev --workspace apps/api
```

Trong một terminal khác, gọi `Invoke-RestMethod http://127.0.0.1:3000/api/v1/health`. API trả HTTP 200 với `{"status":"ok"}`. Endpoint kiểm tra tiến trình HTTP, còn tình trạng MySQL được theo dõi bằng healthcheck Docker. `GET /` vẫn dùng được để kiểm tra scaffold.

API đọc `APP_HOST` và `APP_PORT` từ `.env` ở root, mặc định `127.0.0.1` và `3000`. Biến môi trường đã có trong terminal được ưu tiên. `APP_HOST` nhận địa chỉ IP, `APP_PORT` nhận số nguyên từ 1 đến 65535. Khi có shell Expo trong `apps/mobile`, dùng [quy ước workspace trong tài liệu bàn giao](contracts/README.md).

### Kiểm tra mã nguồn API

Chạy từ thư mục gốc sau khi cài dependency.

```powershell
npm run lint --workspace apps/api
npm run typecheck --workspace apps/api
npm run format:check --workspace apps/api
npm test --workspace apps/api
```

Để chạy từng nhóm, dùng `npm run test:unit --workspace apps/api`, `npm run test:integration --workspace apps/api` hoặc `npm run test:e2e --workspace apps/api`. Lệnh `test:http` gọi nhóm integration như trước. Các ca hiện có dùng `node:test` và cổng loopback tạm. E2E chạy tiến trình API thật để kiểm tra `/api/v1/health`.

### Các file của scaffold

| File | Công nghệ và chức năng |
|---|---|
| `package.json` ở root | npm workspaces tập hợp các app trong `apps/*` để cài dependency từ root. |
| `package-lock.json` | npm khóa phiên bản dependency đã chọn để `npm ci` tái lập lần cài. |
| `apps/api/package.json` | Khai báo dependency NestJS và các lệnh chạy, build, lint, kiểm tra kiểu và định dạng API. |
| `apps/api/eslint.config.mjs` | ESLint và typescript-eslint kiểm tra mã TypeScript trong `src/`, bỏ qua đầu ra build `dist/`. |
| `apps/api/.prettierrc.json` | Prettier dùng nháy đơn trong mã TypeScript và xuống dòng LF. |
| `apps/api/nest-cli.json` | Báo cho Nest CLI biết mã nguồn nằm ở `src` và cần dọn kết quả build cũ khi biên dịch. |
| `apps/api/tsconfig.json` | Bật kiểm tra kiểu strict và decorator metadata, biên dịch TypeScript từ `src` sang `dist`. |
| `apps/api/src/main.ts` | Khởi động NestJS và lắng nghe HTTP tại localhost. |
| `apps/api/src/app.module.ts` | Module gốc đăng ký controller cho NestJS. |
| `apps/api/src/app.controller.ts` | Trả trạng thái API cho `GET /` và `GET /api/v1/health`. |
| `apps/api/src/config.ts` | `loadApiConfig()` đọc môi trường. `parseApiConfig()` kiểm tra host, port để có thể test độc lập. |
| `apps/api/test/config.unit.cjs` | Kiểm tra giá trị mặc định, cấu hình hợp lệ và cấu hình sai. |
| `apps/api/test/m2-07.http.cjs` | Kiểm tra tích hợp HTTP với controller, DTO validation và bộ trả lỗi. |
| `apps/api/test/health.e2e.cjs` | Kiểm tra tiến trình API thật có phản hồi health trên cổng được cấu hình. |
| `apps/api/src/http.ts` | Gắn prefix `/api/v1`, kiểm tra DTO và đăng ký filter lỗi. |
| `apps/api/src/api-exception.filter.ts` | Trả lỗi JSON có `code`, `message` và `requestId`. |
| `apps/api/dist/` | JavaScript do build sinh ra để Node.js chạy. Khi cần sửa API, sửa mã TypeScript tương ứng trong `src`. |

## MySQL local với Docker Compose

Khởi động Docker Desktop, rồi sao chép `.env.example` thành `.env` nếu chưa có. Điền hai mật khẩu khác nhau cho `DB_PASSWORD` (tài khoản ứng dụng) và `MYSQL_ROOT_PASSWORD` (quản trị MySQL). Git bỏ qua `.env`.

```powershell
docker compose config --quiet
docker compose up -d --wait --wait-timeout 150 mysql
docker compose ps mysql
```

`compose.yaml` chạy MySQL 8.4.13 với InnoDB, lưu dữ liệu vào volume `mysql_data` và chỉ mở cổng cho máy local. Dùng `127.0.0.1:3307` từ Windows. Nếu cổng này đã được dùng, đổi `DB_PORT` trong `.env`. Healthcheck chạy `SELECT 1` qua TCP với tài khoản ứng dụng và database `fashioncommerce_dev` theo cấu hình mẫu.

Dùng `docker compose restart mysql` để khởi động lại và `docker compose ps mysql` để theo dõi tới khi service báo `healthy`. Dùng `docker compose stop mysql` để tạm dừng và giữ dữ liệu. Image chỉ tạo database, người dùng và mật khẩu từ env khi volume còn trống. Với volume đã có dữ liệu, đổi mật khẩu trong MySQL trước rồi đồng bộ `.env`.

## Schema và migration Prisma

| File | Công nghệ và chức năng |
|---|---|
| `apps/api/prisma/schema.prisma` | Prisma ORM 7 mô tả tám bảng nền tảng và quan hệ MySQL. |
| `apps/api/prisma.config.ts` | Prisma CLI đọc vị trí schema, migration và biến môi trường `DATABASE_URL` của tiến trình. |
| `apps/api/prisma/migrations/` | Lưu SQL theo phiên bản. Migration đầu tạo bảng InnoDB và thêm `CHECK` cho giá và tồn kho. |
| `apps/api/src/generated/prisma/` | Client TypeScript do Prisma sinh từ schema. Thư mục này được Git, ESLint và Prettier bỏ qua. |

Chạy từ root để kiểm tra schema và sinh Client cục bộ.

```powershell
npm run db:validate --workspace apps/api
npm run db:generate --workspace apps/api
```

Khi kiểm tra migration, đặt `DATABASE_URL` trong terminal đang dùng và trỏ đến MySQL thử nghiệm riêng. Dạng URL là `mysql://USER:PASSWORD@HOST:PORT/DATABASE`. Mã hóa các ký tự đặc biệt trong thông tin đăng nhập theo dạng URL và giữ giá trị thật ngoài Git. Rà lại host, port, tên database và file SQL trước khi chạy.

```powershell
npm run db:migrate --workspace apps/api
npm run db:status --workspace apps/api
```

### Seed dữ liệu demo

`apps/api/src/seed.ts` tạo hai tài khoản giả (`demo-admin@example.test` và `demo-customer@example.test`), một danh mục, một sản phẩm và hai SKU. Prisma dùng email, slug và SKU làm khóa tra cứu. Chạy lại giữ dữ liệu hiện có, kể cả giá, tồn kho và mật khẩu đã lưu.

Sau khi chạy migration trên database local dành cho dev hoặc test, giữ `DATABASE_URL` trỏ tới database đó. Đặt hai mật khẩu khác nhau, mỗi mật khẩu ít nhất 12 ký tự, qua `SEED_ADMIN_PASSWORD` và `SEED_CUSTOMER_PASSWORD` trong môi trường terminal. Seed lưu hash Argon2id.

```powershell
npm run db:seed --workspace apps/api
```

### Auth Customer trên Android và Web

Cấu hình `DATABASE_URL` trỏ đến MySQL đã chạy migration và `AUTH_WEB_ORIGIN` là origin Web chính xác, gồm scheme, host và port nếu có. Lưu giá trị thật trong môi trường local. Đăng nhập Web dùng HTTPS và cookie `__Host-session`. Android dùng bearer token. Health HTTP chạy độc lập với kết nối MySQL.

`apps/api/src/auth/` chứa DTO, controller, service và kết nối Prisma cho đăng ký, đăng nhập và đăng xuất. Giới hạn thử theo IP là 10 lần/phút cho mỗi nhóm đăng ký hoặc đăng nhập. Bộ đếm dùng bộ nhớ của tiến trình API local.

Chạy `npm run test:auth --workspace apps/api` với `DATABASE_URL` trỏ đến một MySQL thử nghiệm trống đã chạy migration, trên `127.0.0.1` với cổng riêng ngoài 3306/3307 và tên dạng `fashioncommerce_<tên>_test`.

## Git và cấu hình cục bộ

Dùng `git status --short` và `git diff --cached` để rà đúng file trước commit. Theo dõi `.env.example` và `package-lock.json`. Cấu hình thật nằm trong `.env` cục bộ, được Git bỏ qua cùng dependency, đầu ra build và dữ liệu local.

## Khởi động một phiên vibe coding
1. AI đọc `AGENTS.md` và `tracking/CURRENT_STATE.md`.
2. Chọn một task theo ID từ `tracking/TASKS.md`; xem dependency và điều kiện Done.
3. Đọc đúng 1–3 tài liệu liên quan; chỉ xem code module đang làm.
4. Kế hoạch thay đổi/test → thực hiện khi được phép → chạy kiểm tra → tóm tắt kết quả và blocker hoặc bước tiếp theo trong `tracking/CURRENT_STATE.md`, ghi trạng thái trong `tracking/TASKS.md`. Chỉ tick DONE sau khi có bằng chứng và nghiệm thu.
5. Khi cần giải thích code hoặc kiến thức nền, trao đổi trực tiếp trong cuộc trò chuyện.

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
| `docs/08-LEARNING.md` | Hồ sơ học tập cũ |
| `docs/adr/` | Ghi quyết định kiến trúc có lý do và trạng thái |
| `tracking/TASKS.md` | Checklist task theo milestone, ID ổn định |
| `tracking/CURRENT_STATE.md` | Snapshot ngắn, thay thế phần lớn việc đọc chat cũ |
| `tracking/WORKLOG.md` | Hồ sơ tiến độ cũ, lưu các phê duyệt trước đây |
| `tracking/OPEN_QUESTIONS.md` | Điều cần xác nhận trước khi code/thiết kế |
| `templates/SESSION_PROMPT.md` | Mẫu mở phiên AI mới |

## Cách đọc trạng thái
- `[ ]` chưa Done, kể cả task đang IN_PROGRESS.
- `[x]` Done = đạt acceptance, có test bằng chứng, tài liệu cập nhật, đúng thẩm quyền duyệt.
- `OPEN / IN_PROGRESS / BLOCKED / REVIEW / DONE` ghi riêng, không tự đánh dấu vì code đã được sinh.
- M0 là phân tích yêu cầu; **“MVP A” không đồng nghĩa M0**.

## Quản lý tiến độ không phải RAG
Đây là **Markdown + Git + context handoff**, không có embedding/vector DB, indexing hay truy xuất RAG tự động. `CURRENT_STATE` chứa snapshot; `TASKS` chứa backlog và trạng thái; `ADR` giải thích các quyết định kỹ thuật. RAG chỉ thêm khi tài liệu/code nhiều và có nhu cầu tra cứu ngữ nghĩa; không cần cho sinh viên ở giai đoạn đầu.

## Tính khả thi và ngân sách
Mặc định sử dụng công cụ open-source/local, dữ liệu giả, COD/môi trường sandbox. Dịch vụ cloud có quota/điều kiện và có thể cần phương thức thanh toán; cần duyệt riêng. Không phụ thuộc GPU để hoàn thiện mua hàng. Chưa chốt deadline/rubric nên roadmap theo milestone, không cam kết số tuần.

## Hướng dẫn bắt đầu backend
1. **Chưa code ngay** nếu PRD M0 hoặc thiết kế M1 chưa được duyệt; xem `tracking/SETUP_CHECKLIST.md`.
2. Cho Codex đọc `AGENTS.md` → `tracking/CURRENT_STATE.md` → task được giao trong `tracking/TASKS.md`; thêm `docs/09-BACKEND_GUIDELINES.md` và `contracts/README.md` khi cần.
3. Dùng prompt `templates/BACKEND_SESSION_PROMPT.md` (PLAN → duyệt → CODE → TEST → HANDOFF).
4. Thư mục `learning/` lưu hồ sơ cũ. Theo dõi task mới trong `tracking/`.
5. [OpenAPI v1.0.0](contracts/openapi.yaml) là contract MVP A đã nghiệm thu. Route nghiệp vụ được triển khai theo task tương ứng.
