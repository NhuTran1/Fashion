# AI Try-On — hợp đồng tích hợp tương lai (không chặn MVP)

**Trạng thái:** DESIGN RESERVED / R&D ONLY. Nhánh e-commerce **không đòi hỏi GPU**, không bắt buộc AI để nghiệm thu Customer/Admin hoặc Staff.

## Ranh giới cố định
- Single-vendor; ảnh trang phục tham chiếu `product_variant_id` và metadata ảnh sản phẩm; không có Seller/shop_id.
- Không đưa ảnh binary vào MySQL, không nhúng PyTorch trong NestJS.
- NestJS xác thực người dùng, kiểm tra quyền xem job; FastAPI không tự nhận JWT nội bộ không xác thực hoặc truy cập MySQL trực tiếp.
- API AI failure, timeout, quota không được tác động catalog, checkout, stock hay payment.
- Expo chỉ hiển thị nút Try-On khi `TRYON_ENABLED=true` và service có khả năng trả kết quả thực; mock phải gắn nhãn rõ.

## Future API sketch (CHƯA triển khai)
- `POST /api/v1/tryon/jobs` → HTTP 202, `{job_id,status:'queued'}`.
- `GET /api/v1/tryon/jobs/:id` → `queued|processing|completed|failed|cancelled`, result short-lived signed URL.
- Input: authorized `person_image_key`, `product_variant_id`, `garment_type`; validate mime, size, expiry, ownership.
- Job queue Redis + Celery khi cần và có GPU worker phù hợp; Colab dùng nghiên cứu không phải inference production 24/7.

## R&D track
- [ ] So sánh pretrained model, license code/weights, constraints áo/quần, VRAM.
- [ ] Có ảnh mẫu được phép sử dụng; không lấy dữ liệu cá nhân không consent.
- [ ] Colab baseline, đo latency/quality/resource, report hạn chế.
- [ ] FastAPI prototype nếu GPU và quota cho phép.
- [ ] Quyết định retention/delete, private upload, idempotency, retries.
- [ ] Review future architecture/ADR trước khi mở feature flag.

## Mở rộng khác (không P0)
- Chatbot FAQ/admin handoff, shipping simulation và realtime AI tách backlog P1/P2. Không chèn trực tiếp AI vào business transaction.
