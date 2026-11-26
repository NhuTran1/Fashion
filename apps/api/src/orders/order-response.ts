import type { Order, OrderItem } from '../generated/prisma/client';

/** Dựng phản hồi Order từ snapshot và trạng thái thanh toán đã lưu. */
export function orderResponse(
  order: Order & { items: OrderItem[] },
  paymentStatus: string,
) {
  return {
    id: order.id.toString(),
    status: order.status,
    paymentStatus,
    subtotal: order.subtotal.toFixed(2),
    shippingFee: order.shippingFee.toFixed(2),
    total: order.total.toFixed(2),
    address: order.addressSnapshot,
    items: order.items.map((item) => ({
      id: item.id.toString(),
      variantId: item.variantId.toString(),
      sku: item.skuSnapshot,
      name: item.nameSnapshot,
      size: item.sizeSnapshot,
      color: item.colorSnapshot,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toFixed(2),
      lineTotal: item.lineTotal.toFixed(2),
    })),
    createdAt: order.createdAt.toISOString(),
  };
}
