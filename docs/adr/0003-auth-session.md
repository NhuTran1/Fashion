# ADR-0003 — Phiên lưu phía server cho Android và Web

**Trạng thái ACCEPTED.** Chủ dự án nghiệm thu M1-03 ngày 2026-11-20. [Bằng chứng duyệt](../../tracking/WORKLOG.md#2026-11-20--m1-03--chính-sách-phiên-android-và-web).

## Bối cảnh và quyết định

MVP A có Customer trên Android/Web và Admin Web. [PRD v1](../01-PRD.md) yêu cầu xác thực phiên, giới hạn dữ liệu theo chủ sở hữu và quản lý quyền ở backend. MVP B sẽ bổ sung Staff theo chính sách quyền tại M1-04.

Chọn session lưu phía server qua MySQL InnoDB trong NestJS. Khi đăng nhập thành công, backend cấp một token mới ngẫu nhiên từ nguồn sinh số ngẫu nhiên mật mã. Token chỉ là mã tham chiếu. MySQL lưu hash của token, ID tài khoản, thời điểm phát hành, hạn tuyệt đối, thời điểm hoạt động gần nhất và trạng thái thu hồi. Mỗi request riêng tư kiểm tra phiên, hạn dùng và trạng thái hiện tại của tài khoản trước khi kiểm tra quyền và ownership. Truy vấn phiên thêm chi phí vào request xác thực, đồng thời cho phép thu hồi ở server. Access JWT + refresh token là phương án đã xem xét và cần thêm cơ chế xoay vòng, xử lý dùng lại refresh token và thu hồi.

## Chính sách theo nền tảng

| Nền tảng | Gửi và lưu thông tin phiên |
|---|---|
| Android / Expo | Lưu token phiên trong Expo SecureStore, gửi qua `Authorization: Bearer` trên HTTPS. Khi phiên không còn hiệu lực, xóa token local và yêu cầu đăng nhập lại. |
| Web Customer và Admin | Ưu tiên Web và API cùng origin. Backend cấp cookie host-only với `HttpOnly`, `Secure`, `SameSite=Lax`. Web không lưu token phiên trong localStorage hoặc sessionStorage. |

- Customer dùng phiên tối đa **7 ngày**. Admin dùng phiên tối đa **8 giờ** và hết hạn sau **30 phút không hoạt động**. Hạn tuyệt đối tính từ lúc cấp phiên. Logout thu hồi phiên hiện tại ở server và xóa token SecureStore hoặc cookie. Khi khóa tài khoản, thu hồi các phiên của tài khoản và từ chối request riêng tư kế tiếp.
- Đăng ký công khai luôn tạo Customer. Admin được khởi tạo theo quy trình nội bộ. Hash mật khẩu bằng Argon2id, giới hạn tần suất đăng nhập và tránh lộ tài khoản qua thông báo lỗi. Chi tiết thư viện và cấu hình runtime kiểm tra trong giai đoạn triển khai.
- Web dùng kiểm tra Origin cho thao tác thay đổi trạng thái, kể cả đăng nhập. Request thay đổi dữ liệu dùng cookie phiên còn phải có CSRF token ràng buộc với phiên. Cookie `SameSite=Lax` là lớp bổ sung. Cách cấp CSRF token và schema lỗi thống nhất ở M1-08. Giữ HTTP GET chỉ đọc.
- Luồng P0 dự kiến đăng ký, đăng nhập, đọc hồ sơ phiên và đăng xuất. Khi hết phiên, đăng nhập lại. Route, payload, status và hành vi client thuộc M1-08 và các task triển khai.

## Mô hình mối đe dọa và ca kiểm thử

| Tình huống | Biện pháp thiết kế | Bằng chứng cần thu khi triển khai |
|---|---|---|
| Phiên bị lộ qua mạng, bộ nhớ trình duyệt hoặc log | HTTPS, SecureStore trên Android, cookie HttpOnly trên Web, hash phía server. Không ghi token, mật khẩu hay cookie phiên vào log | Kiểm tra thuộc tính cookie và lưu trữ Android. Kiểm tra log sau đăng nhập, request lỗi và logout |
| Phiên cố định, hết hạn, logout hoặc tài khoản bị khóa | Cấp token mới khi đăng nhập và kiểm tra hạn, thu hồi, trạng thái tài khoản ở server | Kiểm thử token trước phiên mới, phiên hết hạn, sau logout và sau khóa. Kiểm thử riêng hạn tuyệt đối và thời gian không hoạt động của Admin |
| CSRF trên Web | Origin hợp lệ và CSRF token đúng phiên cho thao tác ghi có cookie. Kiểm tra Origin ở đăng nhập | Ca hợp lệ thành công. Ca thiếu token, sai token hoặc sai origin bị từ chối trước thay đổi dữ liệu. Android xác thực qua bearer |
| JavaScript độc hại trên Web | Cookie HttpOnly bảo vệ khỏi đọc token trực tiếp. Kiểm soát đầu vào và hiển thị vẫn cần thiết vì mã chạy cùng origin có thể gửi request | Xác minh token phiên không xuất hiện trong dữ liệu đọc được từ JavaScript. Review cách hiển thị nội dung người dùng |
| Thử mật khẩu và lộ DB | Argon2id, giới hạn tần suất, thông báo lỗi chung | Kiểm tra password lưu hash. Đăng nhập lặp sai bị giới hạn và không sinh phiên |
| Customer vượt quyền hoặc đọc tài nguyên người khác | Backend xác định vai trò theo tài khoản và kiểm tra ownership. Đăng ký chỉ tạo Customer | Customer gọi chức năng Admin bị từ chối. Kiểm tra truy cập chéo hồ sơ, địa chỉ và đơn. Đăng ký công khai không cấp Admin |

M1-03 là quyết định thiết kế. Các ca trên đang **NOT RUN**.

## Tham chiếu

- [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)
