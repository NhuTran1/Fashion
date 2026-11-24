# CURRENT_STATE — snapshot ngắn cho AI

**Updated:** 2026-11-24 (Frontend Expo + Mock OpenAPI v1.0.0 trên nhánh `feat/frontend-expo-mock`, chờ nghiệm thu).  
**10-step process:** Chuẩn bị nền tảng triển khai & hoàn thiện Frontend trên nhánh tách riêng. **PRD v1, M0 và M1 gate đã được phê duyệt.**  
**Product:** MVP A Customer + Admin → MVP B Staff → AI image try-on độc lập.  
**Milestone active:** M2 — nền tảng & Frontend Expo/Web.  
**Current task:** M2-01 / M1-09 / M1-10 (Frontend) — REVIEW trên nhánh `feat/frontend-expo-mock`. Đã scaffold `apps/mobile` (Expo SDK 58 + TypeScript + React Native Web), mock server stateful khớp OpenAPI v1.0.0, đủ luồng Customer & Admin/Staff RBAC cùng typecheck, mock contract tests và Playwright Web E2E PASS.  
**Repository code:** Có `apps/api` (scaffold), `apps/mobile` (Expo TypeScript frontend hoàn chỉnh dùng Mock OpenAPI v1.0.0 mặc định) và `package-lock.json` ở root. Đang ở nhánh `feat/frontend-expo-mock`.

## Quyết định người dùng đã xác nhận
- Single-vendor fashion e-commerce, không Seller/multi-vendor.
- MVP đầu **Customer + Admin** và các nghiệp vụ mua/bán, tồn kho, đơn, đánh giá, thanh toán demo.
- MVP hoàn chỉnh mở role **Staff** từ quyền vận hành của Admin, reuse services.
- Expo + NestJS + MySQL. AI sau: Python/FastAPI + Colab thử pretrained VTON, không GPU mạnh/không ngân sách trả phí.
- Nhóm 2, solo-first; hướng học để phỏng vấn; phải theo dõi tiến trình bằng file.

- Android + Web là phạm vi demo tạm thời. Chủ dự án cho phép thiết kế M1 khi Q01/Q02 còn mở.

## Hiện đã thực hiện
- Đã **soạn/cập nhật hồ sơ kế hoạch** PRD, Architecture, Data Model, UI, RBAC, Roadmap, Tasks, Worklog, AI Handoff, test plan.
- **CHƯA** xác nhận deadline/rubric chính thức hoặc chọn gateway P1. MVP A đã chốt COD mô phỏng. NestJS scaffold trả HTTP 200 trên localhost. Migration, kiểm thử nghiệp vụ, benchmark và deploy chưa thực hiện.
- Không đánh dấu bất kỳ task triển khai nào hoàn thành chỉ vì đã tạo tài liệu.

## Bộ hồ sơ bổ sung (v0.3)
- Đã tạo tài liệu dùng cho Codex: `docs/09-BACKEND_GUIDELINES.md`, `templates/BACKEND_SESSION_PROMPT.md`, `tracking/SETUP_CHECKLIST.md`.
- Có `learning/FEATURE_MAP.md`, `learning/KNOWLEDGE_INDEX.md` và hồ sơ M2-01. Trạng thái học do người học tự đánh giá.
- Có `contracts/openapi.yaml` v1.0.0 APPROVED với 49 thao tác MVP A. Auth theo ADR-0003, ORM theo ADR-0002. NestJS 11.2.11 và TypeScript 5.9.3 đã kiểm chứng với Node v24.14.1/npm 11.11.0 trên Windows. Phiên bản Expo và Prisma runtime còn chờ kiểm chứng riêng.

## Blockers / open decisions
`tracking/OPEN_QUESTIONS.md`: Q01 deadline, Q02 phạm vi nền tảng, Q03 guest cart, Q11 hosting, Q12 teammate, Q13 policy dữ liệu, Q14 tổ chức ứng dụng quản trị.

## Next actions
1. Chủ dự án nghiệm thu M2-02.
2. Nhận shell Expo từ Antigravity, kiểm chứng lệnh khởi động Mobile rồi trình nghiệm thu M2-01.
3. Theo dõi wireframes Customer và Admin/Staff ở M1-09/M1-10.
4. Rà Q01/Q02 khi có hạn và rubric chính thức. M0-02 vẫn mở theo phê duyệt M0 gate.

## Hướng dẫn bàn giao
Đọc `AGENTS.md` + chính file này + task được giao. Trước khi sửa code phải xác nhận có source thực tế; báo rõ test nào chưa chạy.
