# TASKS — checklist duy nhất và mã task ổn định

> **2026-11-19:** Backlog đã sửa theo single-vendor; Customer/Admin (GATE A) → Staff (GATE B); AI không chặn.

**Trạng thái:** `[ ]` = chưa DONE; `[x]` = DONE có evidence. Nếu đang làm ghi `IN_PROGRESS` bên dòng worklog/CURRENT_STATE; nếu bị chặn ghi `BLOCKED` cùng nguyên nhân; đừng tick sớm.

**Chính sách Done:** AC đạt + code/tài liệu được review + test thực tế + WORKLOG evidence; milestone cần người dùng nghiệm thu. Chưa có code nên test code đều NOT RUN.

**Dependency:** M0→M1→M2→M3→M4→M5→M6→GATE A→M7→GATE B→M8 (M8 test phải bắt đầu xuyên suốt); AI/P1 không chặn.

## M0 — Scope / PRD gate

- [x] **M0-01** — Nhắc lại single-vendor, solo-first, stack, miễn phí và future AI. **Done khi:** PRD và ADR thể hiện đúng quyết định.
- [ ] **M0-02** — Xác nhận deadline/rubric / platforms. **Done khi:** Q01/Q02 resolved + nguồn xác nhận.
- [x] **M0-03** — Định nghĩa Customer + Admin MVP A, Staff MVP B. **Done khi:** Scope và actors được người dùng duyệt.
- [x] **M0-04** — Chốt P0 vs P1: COD/sandbox, reviews, dashboard/chatbot/shipping. **Done khi:** Bảng scope không mâu thuẫn.
- [x] **M0-05** — Chốt quy tắc order/cancel/stock/refund và review policy. **Done khi:** Các invariant nêu cụ thể, có test cases.
- [x] **M0-06** — Duyệt user journeys và acceptance AC-01..AC-14. **Done khi:** PRD v1, AC testable.
- [x] **M0-07** — Nhận phê duyệt rõ ràng M0 gate. **Done khi:** Approval ghi WORKLOG, CURRENT_STATE chuyển M1.

## M1 — Design gate

- [x] **M1-01** — Duyệt architecture modular monolith và AI seam. **Done khi:** ARCHITECTURE v1 approved.
- [x] **M1-02** — Chọn ORM, ghi ADR. **Done khi:** Q06 closed, ADR accepted.
- [x] **M1-03** — Chọn auth/mobile/web session policy, ghi ADR. **Done khi:** Q07 closed, threat model.
- [x] **M1-04** — Duyệt RBAC/permission matrix Staff extension. **Done khi:** RBAC v1 accepted, denied-access tests outlined.
- [x] **M1-05** — Duyệt MySQL ERD, FK, constraints, types. **Done khi:** DATA_MODEL v1 reviewed.
- [x] **M1-06** — Thiết kế checkout atomic + idempotency + restore stock. **Done khi:** Race scenario and rollback tests documented.
- [x] **M1-07** — Thiết kế review eligibility và moderation/audit. **Done khi:** AC-09,AC-10 policy reviewed.
- [x] **M1-08** — API contract v1 Auth/Catalog/Cart/Orders/Reviews/Admin. **Done khi:** OpenAPI outline/errors agreed.
- [ ] **M1-09** — Wireframes Customer Android/Web. **Done khi:** Loading/error/empty included.
- [ ] **M1-10** — Wireframes Admin Web-first và Staff future. **Done khi:** Authorization-aware routing reviewed.
- [x] **M1-11** — Chọn image storage và payment approach. **Done khi:** Q05/Q08 closed or constrained to COD only.
- [x] **M1-12** — Nhận phê duyệt M1 gate. **Done khi:** Design review approved, M2 allowed.

## M2 — Repository / infrastructure

- [ ] **M2-01** — Scaffold Expo+NestJS monorepo khi M0/M1 approved. **Done khi:** Mobile+API start commands work.
- [ ] **M2-02** — Git/.gitignore/.env.example/README. **Done khi:** No secret in tracked files.
- [ ] **M2-03** — ESLint/Prettier/TypeScript config. **Done khi:** Lint+typecheck real pass.
- [ ] **M2-04** — Docker MySQL InnoDB + healthcheck. **Done khi:** DB start/restart verified.
- [ ] **M2-05** — ORM schema + versioned migrations. **Done khi:** Migration up in disposable DB.
- [ ] **M2-06** — Synthetic seeds for users/catalog. **Done khi:** Idempotent repeatable seed.
- [ ] **M2-07** — Nest config, DTO validation, health/error response. **Done khi:** Smoke + invalid request tests.
- [ ] **M2-08** — Expo routes + API client + mobile/web env. **Done khi:** Android/Web call health endpoint.
- [ ] **M2-09** — Test runner unit/integration/e2e skeleton. **Done khi:** Example tests real pass.
- [ ] **M2-10** — M2 gate demo + evidence. **Done khi:** Screenshots/logs and owner approval.

## M3 — Customer/Admin identity foundation

- [ ] **M3-01** — User model & role policies (Customer/Admin). **Done khi:** DB migration and role tests.
- [ ] **M3-02** — Customer register/login/logout. **Done khi:** Auth integration tests.
- [ ] **M3-03** — Password hash, refresh/session policy. **Done khi:** Security tests + no token leaks.
- [ ] **M3-04** — Admin seed/invite controlled, no public admin signup. **Done khi:** Role escalation denied.
- [ ] **M3-05** — Own profile and addresses. **Done khi:** IDOR negative test passes.
- [ ] **M3-06** — Admin UI login/auth guard. **Done khi:** Customer cannot access admin API.
- [ ] **M3-07** — Expo Customer auth flow/session/errors. **Done khi:** Android/Web login smoke.
- [ ] **M3-08** — M3 gate: 401/403/IDOR matrix. **Done khi:** Evidence in WORKLOG.

## M4 — Catalog, variants, inventory

- [ ] **M4-01** — Categories/product/variant/image schema. **Done khi:** FK, SKU uniqueness, DECIMAL validated.
- [ ] **M4-02** — Public product list filter/sort/paginate. **Done khi:** API tests active-only.
- [ ] **M4-03** — Product detail select size/color stock. **Done khi:** UI selects correct variant.
- [ ] **M4-04** — Admin category/product/variant CRUD. **Done khi:** RBAC and validation tests.
- [ ] **M4-05** — Admin inventory adjust API + movement audit. **Done khi:** Stock delta/reason recorded.
- [ ] **M4-06** — Product images adapter + uploads validation. **Done khi:** Mime/size/filename restrictions.
- [ ] **M4-07** — Expo catalog/search/detail UI. **Done khi:** Android/Web loading/empty/error.
- [ ] **M4-08** — Admin product/inventory Web UI. **Done khi:** Create-edit-stock through UI.
- [ ] **M4-09** — Index/EXPLAIN baseline (when data available). **Done khi:** Queries documented; no fabricated numbers.
- [ ] **M4-10** — M4 catalog vertical slice gate. **Done khi:** Admin created product appears to Customer.

## M5 — Cart/checkout/payment

- [ ] **M5-01** — Cart schema and ownership. **Done khi:** Customer A cannot access B cart.
- [ ] **M5-02** — Add/update/delete cart items. **Done khi:** Qty/stock validation tests.
- [ ] **M5-03** — Cart totals revalidated server-side. **Done khi:** Client price tampering rejected.
- [ ] **M5-04** — Checkout address/order snapshots. **Done khi:** Totals immutable snapshot tests.
- [ ] **M5-05** — MySQL transaction & atomic stock decrement. **Done khi:** Concurrent stock=1 test passes.
- [ ] **M5-06** — Checkout idempotency key. **Done khi:** Double-tap 1 logical order.
- [ ] **M5-07** — COD payment record/state model. **Done khi:** No real card/real-money processing.
- [ ] **M5-08** — Gateway mock/sandbox (P1), chỉ triển khai khi Q05 được duyệt. **Done khi:** Luồng demo đạt phạm vi đã duyệt, có kiểm thử xác minh chữ ký và idempotency nếu sandbox dùng callback.
- [ ] **M5-09** — Expo cart/address/checkout/order success. **Done khi:** Complete Android/Web happy path.
- [ ] **M5-10** — M5 gate transaction and error tests. **Done khi:** No oversell, no orphaned orders.

## M6 — Operations/reviews / MVP A gate

- [ ] **M6-01** — Order state machine & order history/detail. **Done khi:** Valid/invalid transition tests.
- [ ] **M6-02** — Customer cancellation + safe restore stock. **Done khi:** Cancel twice no double stock restore.
- [ ] **M6-03** — Admin order list/process/detail UI. **Done khi:** Admin fulfillment end-to-end.
- [ ] **M6-04** — Review schema with verified purchase rule. **Done khi:** Undelivered/not-owned purchases rejected.
- [ ] **M6-05** — Customer ratings/comments UI. **Done khi:** 1–5 stars, content validation.
- [ ] **M6-06** — Admin review hide/unhide & audit. **Done khi:** Authorization/moderation tests.
- [ ] **M6-07** — Admin user status management. **Done khi:** Role escalation prevented.
- [ ] **M6-08** — Dashboard cơ bản (P1 theo phạm vi hiện tại, rà lại khi có rubric Q02/Q15). **Done khi:** Nguồn dữ liệu và trạng thái tính số liệu được xác định rõ.
- [ ] **M6-09** — MVP A regression E2E on Android+Web. **Done khi:** Customer/Admin full demo pass.
- [ ] **M6-10** — MVP A acceptance signed by user. **Done khi:** Gate A recorded with evidence.

## M7 — Staff extension / MVP B gate

- [ ] **M7-01** — Review Admin capabilities already present. **Done khi:** Permission mapping documented.
- [ ] **M7-02** — Enable Staff roles and admin-only provisioning. **Done khi:** No public Staff signup.
- [ ] **M7-03** — Staff authorization guards with least privilege. **Done khi:** Access matrix 401/403 tests.
- [ ] **M7-04** — Staff order processing reuses Orders service. **Done khi:** No duplicated core logic.
- [ ] **M7-05** — Staff inventory adjust with audit. **Done khi:** No forbidden price/user changes.
- [ ] **M7-06** — Staff Web-first screens/navigation. **Done khi:** Staff operations smoke.
- [ ] **M7-07** — Regression Customer/Admin and Staff denial tests. **Done khi:** MVP A tests still pass.
- [ ] **M7-08** — MVP B user acceptance. **Done khi:** Gate B approved.

## M8 — Hardening, release & demo

- [ ] **M8-01** — Error/loading/empty/responsive UX audit. **Done khi:** Android/Web manual test matrix.
- [ ] **M8-02** — Unit/integration/e2e test suite. **Done khi:** Actual commands + pass/fail logs.
- [ ] **M8-03** — Security/permission review. **Done khi:** Threat checklist + negatives.
- [ ] **M8-04** — Load test 10/25/50 users if machine permits. **Done khi:** p95/RPS/error and setup recorded.
- [ ] **M8-05** — DB index review and query plan. **Done khi:** EXPLAIN evidence.
- [ ] **M8-06** — Backup and restore disposable MySQL. **Done khi:** Restored sample data verified.
- [ ] **M8-07** — CI lint/typecheck/test if feasible. **Done khi:** Pipeline evidence or NOT RUN.
- [ ] **M8-08** — Deployment plan, HTTPS, secrets, rollback (if required). **Done khi:** No paid/public deploy without permission.
- [ ] **M8-09** — Demo script, screenshots, final report. **Done khi:** Reproducible demo.
- [ ] **M8-10** — Final review/retrospective & learning journal. **Done khi:** Stakeholder acceptance recorded.

## AI — Independent future track

- [ ] **AI-01** — Research pretrained VTON licenses and VRAM. **Done khi:** Document code/weights license.
- [ ] **AI-02** — Consent-safe demo garment/person dataset. **Done khi:** Rights/source documented.
- [ ] **AI-03** — Run Colab inference baseline if GPU available. **Done khi:** True logs or NOT RUN.
- [ ] **AI-04** — Measure runtime/VRAM/quality. **Done khi:** Environment + evidence.
- [ ] **AI-05** — Draft future FastAPI request/job/status/errors. **Done khi:** Contract reviewed.
- [ ] **AI-06** — Plan privacy/retention/storage keys. **Done khi:** Security and deletion policy reviewed.
- [ ] **AI-07** — Feature flag off and fallback UI contract. **Done khi:** Core commerce unaffected.
- [ ] **AI-08** — Prototype FastAPI service only when approved. **Done khi:** Test evidence, not production claim.
- [ ] **AI-09** — Future Redis/Celery worker design if needed. **Done khi:** Scale rationale documented.

## P1 — Nice-to-have after MVP

- [ ] **P1-01** — Wishlist. **Done khi:** API+UI tests if prioritized.
- [ ] **P1-02** — Simple voucher. **Done khi:** Price validation + expiry/limits tests.
- [ ] **P1-03** — Chatbot customer support FAQ / admin escalation. **Done khi:** No fake admin response, safe disclosures.
- [ ] **P1-04** — Mô phỏng vận chuyển (P1). **Done khi:** Tracking được ghi rõ là mô phỏng. Tích hợp hãng vận chuyển thực thuộc P2.
- [ ] **P1-05** — Enhanced analytics dashboard. **Done khi:** Verified metrics by order state.

## Checklist cho một phiên AI (không thay thế task Done)

- [ ] Đọc CURRENT_STATE và đúng task/dependencies.
- [ ] Nhắc plan/affected files/test trước sửa.
- [ ] Thực hiện một thay đổi đủ nhỏ, không đụng production/trả phí khi chưa được duyệt.
- [ ] Chạy test thực (PASS/FAIL) hoặc ghi NOT RUN.
- [ ] Append WORKLOG, cập nhật CURRENT_STATE, ADR/LEARNING khi cần.
- [ ] Chỉ tick task khi có đầy đủ evidence & phê duyệt cần thiết.

## Mẫu evidence

`M5-05 | commit <SHA> | test:concurrency PASS (command+output) | ticket/screenshot <path> | review/approval <date>`
