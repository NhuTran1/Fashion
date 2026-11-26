# PROMPT COPY–PASTE TUẦN TỰ CHO CODEX — MVP A (dựa trên v0.3)

> **Chỉ file này.** Không tạo lại PRD/kiến trúc/checklist. Dùng cùng `FashionCommerce_ProjectPlan_v03.zip` (giải nén vào repo). Các mã dưới đây khớp `tracking/TASKS.md` của v0.3.

## Cách dùng

1. Mở Codex tại gốc repository chứa `AGENTS.md`. Dán **Prompt 00** để khởi tạo quy tắc (dán lại khi tạo phiên chat mới).
2. Sau đó copy từng khối mã M0-01 → M6-10. **Mỗi lần chỉ một task**. Codex trước tiên chỉ lên kế hoạch; bạn duyệt kế hoạch mới cho code.
3. Khi đủ kiểm thử và bạn xác nhận nghiệm thu, mới cập nhật checklist và sang task kế tiếp. Task frontend chuyển cho Antigravity; Codex chỉ chuẩn bị API/handoff.
4. Nếu một task không thuộc scope P0 đã duyệt (đặc biệt M5-08, M6-08), ghi DEFERRED đúng quy trình, không giả hoàn thành.

## Prompt 00 — Khởi động phiên Codex

```text
Bạn là Backend Engineer kiêm mentor dự án Fashion Commerce. Trước hết đọc AGENTS.md, tracking/CURRENT_STATE.md, tracking/TASKS.md, docs/01-PRD.md. Dùng v0.3 làm nguồn yêu cầu; không tạo lại tài liệu hoặc mở rộng phạm vi.
Stack: React Native/Expo (Antigravity), NestJS + MySQL (Codex), single-vendor; MVP A Customer + Admin; Staff và AI sau. Ưu tiên local/free.
Với mỗi task tôi gửi: đọc chính task ID trong TASKS.md, kiểm tra dependency/approval và docs/code liên quan, CHỈ TRÌNH BÀY PLAN (mục tiêu, kiến thức, file/config/API/database ảnh hưởng, test, rủi ro); chưa code cho tới khi tôi duyệt.
Sau khi được duyệt: chỉ code một task, chạy test thực tế (không chạy được ghi NOT RUN); báo file/class/hàm tạo hoặc sửa, file liên quan không sửa, luồng request→DB khi có và git diff. Cập nhật tracking/CURRENT_STATE.md với kết quả kiểm tra và blocker hoặc bước tiếp theo, rồi ghi trạng thái vào dòng task trong tracking/TASKS.md theo AGENTS.md. Giải thích code trong cuộc trò chuyện khi tôi yêu cầu. Không tự tick DONE/chuyển task nếu chưa nghiệm thu.
Nếu task là frontend: chỉ tạo/chốt contract và handoff cho Antigravity, không tự code frontend. Không tự tạo payment thật, deploy, thay schema quan trọng hoặc dùng dịch vụ trả phí.
Bây giờ chỉ cho tôi biết trạng thái hiện tại, blocker và task tiếp theo dựa trên file thực tế; chưa sửa gì.
```

## Các prompt theo thứ tự

Ở mỗi bước: dán prompt → xem PLAN → nếu đồng ý trả lời **`DUYỆT <mã>: triển khai đúng plan`** → kiểm tra báo cáo và test → trả lời **`NGHIỆM THU <mã>`**.


### M0

**M0-01**

```text
Thực hiện TASK M0-01 — Nhắc lại single-vendor, solo-first, stack, miễn phí và future AI. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M0

**M0-02**

```text
Thực hiện TASK M0-02 — Xác nhận deadline/rubric / platforms. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M0

**M0-03**

```text
Thực hiện TASK M0-03 — Định nghĩa Customer + Admin MVP A, Staff MVP B. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M0

**M0-04**

```text
Thực hiện TASK M0-04 — Chốt P0 vs P1: COD/sandbox, reviews, dashboard/chatbot/shipping. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M0

**M0-05**

```text
Thực hiện TASK M0-05 — Chốt quy tắc order/cancel/stock/refund và review policy. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M0

**M0-06**

```text
Thực hiện TASK M0-06 — Duyệt user journeys và acceptance AC-01..AC-14. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M0

**M0-07**

```text
Thực hiện TASK M0-07 — Nhận phê duyệt rõ ràng M0 gate. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M1

**M1-01**

```text
Thực hiện TASK M1-01 — Duyệt architecture modular monolith và AI seam. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M1

**M1-02**

```text
Thực hiện TASK M1-02 — Chọn ORM, ghi ADR. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M1

**M1-03**

```text
Thực hiện TASK M1-03 — Chọn auth/mobile/web session policy, ghi ADR. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M1

**M1-04**

```text
Thực hiện TASK M1-04 — Duyệt RBAC/permission matrix Staff extension. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M1

**M1-05**

```text
Thực hiện TASK M1-05 — Duyệt MySQL ERD, FK, constraints, types. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M1

**M1-06**

```text
Thực hiện TASK M1-06 — Thiết kế checkout atomic + idempotency + restore stock. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M1

**M1-07**

```text
Thực hiện TASK M1-07 — Thiết kế review eligibility và moderation/audit. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M1

**M1-08**

```text
Thực hiện TASK M1-08 — API contract v1 Auth/Catalog/Cart/Orders/Reviews/Admin. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M1

**M1-09**

```text
Thực hiện TASK M1-09 — Wireframes Customer Android/Web. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt. Đây là task có giao diện: Codex chỉ xử lý contract/backend và chuẩn bị handoff cho Antigravity, không code apps/mobile.
```


### M1

**M1-10**

```text
Thực hiện TASK M1-10 — Wireframes Admin Web-first và Staff future. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt. Đây là task có giao diện: Codex chỉ xử lý contract/backend và chuẩn bị handoff cho Antigravity, không code apps/mobile.
```


### M1

**M1-11**

```text
Thực hiện TASK M1-11 — Chọn image storage và payment approach. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M1

**M1-12**

```text
Thực hiện TASK M1-12 — Nhận phê duyệt M1 gate. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M2

**M2-01**

```text
Thực hiện TASK M2-01 — Scaffold Expo+NestJS monorepo khi M0/M1 approved. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M2

**M2-02**

```text
Thực hiện TASK M2-02 — Git/.gitignore/.env.example/README. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M2

**M2-03**

```text
Thực hiện TASK M2-03 — ESLint/Prettier/TypeScript config. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M2

**M2-04**

```text
Thực hiện TASK M2-04 — Docker MySQL InnoDB + healthcheck. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M2

**M2-05**

```text
Thực hiện TASK M2-05 — ORM schema + versioned migrations. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M2

**M2-06**

```text
Thực hiện TASK M2-06 — Synthetic seeds for users/catalog. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M2

**M2-07**

```text
Thực hiện TASK M2-07 — Nest config, DTO validation, health/error response. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M2

**M2-08**

```text
Thực hiện TASK M2-08 — Expo routes + API client + mobile/web env. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt. Đây là task có giao diện: Codex chỉ xử lý contract/backend và chuẩn bị handoff cho Antigravity, không code apps/mobile.
```


### M2

**M2-09**

```text
Thực hiện TASK M2-09 — Test runner unit/integration/e2e skeleton. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M2

**M2-10**

```text
Thực hiện TASK M2-10 — M2 gate demo + evidence. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M3

**M3-01**

```text
Thực hiện TASK M3-01 — User model & role policies (Customer/Admin). Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M3

**M3-02**

```text
Thực hiện TASK M3-02 — Customer register/login/logout. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M3

**M3-03**

```text
Thực hiện TASK M3-03 — Password hash, refresh/session policy. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M3

**M3-04**

```text
Thực hiện TASK M3-04 — Admin seed/invite controlled, no public admin signup. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M3

**M3-05**

```text
Thực hiện TASK M3-05 — Own profile and addresses. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M3

**M3-06**

```text
Thực hiện TASK M3-06 — Admin UI login/auth guard. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt. Đây là task có giao diện: Codex chỉ xử lý contract/backend và chuẩn bị handoff cho Antigravity, không code apps/mobile.
```


### M3

**M3-07**

```text
Thực hiện TASK M3-07 — Expo Customer auth flow/session/errors. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt. Đây là task có giao diện: Codex chỉ xử lý contract/backend và chuẩn bị handoff cho Antigravity, không code apps/mobile.
```


### M3

**M3-08**

```text
Thực hiện TASK M3-08 — M3 gate: 401/403/IDOR matrix. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M4

**M4-01**

```text
Thực hiện TASK M4-01 — Categories/product/variant/image schema. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M4

**M4-02**

```text
Thực hiện TASK M4-02 — Public product list filter/sort/paginate. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M4

**M4-03**

```text
Thực hiện TASK M4-03 — Product detail select size/color stock. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M4

**M4-04**

```text
Thực hiện TASK M4-04 — Admin category/product/variant CRUD. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M4

**M4-05**

```text
Thực hiện TASK M4-05 — Admin inventory adjust API + movement audit. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M4

**M4-06**

```text
Thực hiện TASK M4-06 — Product images adapter + uploads validation. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M4

**M4-07**

```text
Thực hiện TASK M4-07 — Expo catalog/search/detail UI. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt. Đây là task có giao diện: Codex chỉ xử lý contract/backend và chuẩn bị handoff cho Antigravity, không code apps/mobile.
```


### M4

**M4-08**

```text
Thực hiện TASK M4-08 — Admin product/inventory Web UI. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt. Đây là task có giao diện: Codex chỉ xử lý contract/backend và chuẩn bị handoff cho Antigravity, không code apps/mobile.
```


### M4

**M4-09**

```text
Thực hiện TASK M4-09 — Index/EXPLAIN baseline (when data available). Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M4

**M4-10**

```text
Thực hiện TASK M4-10 — M4 catalog vertical slice gate. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M5

**M5-01**

```text
Thực hiện TASK M5-01 — Cart schema and ownership. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M5

**M5-02**

```text
Thực hiện TASK M5-02 — Add/update/delete cart items. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M5

**M5-03**

```text
Thực hiện TASK M5-03 — Cart totals revalidated server-side. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M5

**M5-04**

```text
Thực hiện TASK M5-04 — Checkout address/order snapshots. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M5

**M5-05**

```text
Thực hiện TASK M5-05 — MySQL transaction & atomic stock decrement. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M5

**M5-06**

```text
Thực hiện TASK M5-06 — Checkout idempotency key. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M5

**M5-07**

```text
Thực hiện TASK M5-07 — COD payment record/state model. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M5

**M5-08**

```text
Thực hiện TASK M5-08 — Sandbox/mock integration only if Q05 approved. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt. Kiểm tra quyết định P0/P1 trước; nếu nằm ngoài P0 thì đề xuất DEFERRED.
```


### M5

**M5-09**

```text
Thực hiện TASK M5-09 — Expo cart/address/checkout/order success. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt. Đây là task có giao diện: Codex chỉ xử lý contract/backend và chuẩn bị handoff cho Antigravity, không code apps/mobile.
```


### M5

**M5-10**

```text
Thực hiện TASK M5-10 — M5 gate transaction and error tests. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M6

**M6-01**

```text
Thực hiện TASK M6-01 — Order state machine & order history/detail. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M6

**M6-02**

```text
Thực hiện TASK M6-02 — Customer cancellation + safe restore stock. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M6

**M6-03**

```text
Thực hiện TASK M6-03 — Admin order list/process/detail UI. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt. Đây là task có giao diện: Codex chỉ xử lý contract/backend và chuẩn bị handoff cho Antigravity, không code apps/mobile.
```


### M6

**M6-04**

```text
Thực hiện TASK M6-04 — Review schema with verified purchase rule. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M6

**M6-05**

```text
Thực hiện TASK M6-05 — Customer ratings/comments UI. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt. Đây là task có giao diện: Codex chỉ xử lý contract/backend và chuẩn bị handoff cho Antigravity, không code apps/mobile.
```


### M6

**M6-06**

```text
Thực hiện TASK M6-06 — Admin review hide/unhide & audit. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M6

**M6-07**

```text
Thực hiện TASK M6-07 — Admin user status management. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M6

**M6-08**

```text
Thực hiện TASK M6-08 — Dashboard basic if P0 confirmed, else P1. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt. Kiểm tra quyết định P0/P1 trước; nếu nằm ngoài P0 thì đề xuất DEFERRED.
```


### M6

**M6-09**

```text
Thực hiện TASK M6-09 — MVP A regression E2E on Android+Web. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```


### M6

**M6-10**

```text
Thực hiện TASK M6-10 — MVP A acceptance signed by user. Đọc tiêu chí Done và dependencies trong tracking/TASKS.md; làm theo Prompt 00 và AGENTS.md. Bước này chỉ PLAN, chờ tôi duyệt.
```

---

**Kết thúc:** Sau M6-10, Codex tổng hợp evidence nghiệm thu MVP A và những mục BLOCKED/DEFERRED. **Không tự bắt đầu MVP B (Staff), AI hoặc triển khai production.**
