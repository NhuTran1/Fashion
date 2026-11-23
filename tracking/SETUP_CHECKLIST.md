# SETUP_CHECKLIST — sẵn sàng code backend (chưa phải task đã hoàn thành)

> Checklist này hỗ trợ M0–M2, **không thay TASKS.md**; kiểm tra điều kiện trước khi khởi tạo NestJS. `[]` không đồng nghĩa việc chưa thảo luận, mà là chưa có bằng chứng đã đạt gate.

## Gate 0: trước khi viết code
- [x] Người dùng duyệt `docs/01-PRD.md` v1 và MVP A Customer/Admin (M0).
- [x] Xác nhận hoặc chủ động chấp nhận mức chưa chắc chắn của deadline/rubric cần thiết.
- [x] Chốt nghiệp vụ order/cancel/restock/COD và review; ghi vào PRD.
- [x] Người dùng duyệt kiến trúc tối thiểu, RBAC, ERD và API contract của task đầu (M1).
- [ ] ORM, auth approach, Node version và migration strategy được quyết định; ghi ADR.
- [x] Task M2-01 và phạm vi scaffold được người dùng đồng ý.

## Môi trường local khi đã qua gate
- [x] Git repository + `.gitignore` + README ở root. Danh sách stage M2-02 đã được rà mẫu secret.
- [ ] Node.js LTS, npm/pnpm được kiểm tra phiên bản thật.
- [ ] Docker Engine/Compose (hoặc MySQL local) chạy được.
- [ ] MySQL dev DB/user quyền tối thiểu; env local riêng; `.env.example` chỉ là placeholder.
- [x] NestJS scaffold trong `apps/api/` theo M2-01. Build, typecheck và khởi động local trả HTTP 200.
- [ ] DB kết nối; migration đầu tiên + rollback/backup policy đã test.
- [ ] Lint/typecheck/unit test smoke chạy thật và log kết quả.
- [ ] OpenAPI route đầu tiên được chốt; tiêu chuẩn lỗi và status code nhất quán.
- [ ] Tạo feature report đầu tiên sau khi code/test, không giả định đã hoàn thành.

## Handoff Stitch/Antigravity
- [ ] Frontend đọc contract phiên bản được duyệt; mock và API thật phân biệt rõ.
- [ ] Không chia sẻ database credentials cho client.
- [ ] Kiểm thử Expo Web và Android theo đúng địa chỉ API từng môi trường.
