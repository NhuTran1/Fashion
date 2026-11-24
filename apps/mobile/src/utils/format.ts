import { DecimalMoney, OrderStatus, PaymentStatus, Product } from '../types/api';

/** Format a 2-decimal string (e.g. "199000.00") into readable VND display text ("199.000 ₫"). */
export function formatVnd(amount: DecimalMoney): string {
  const integerPart = Math.round(Number(amount || '0'));
  return `${integerPart.toLocaleString('vi-VN')} ₫`;
}

/** Parse a 2-decimal money string safely to integer minor units (cents/xu) to avoid float drift. */
export function toMinorUnits(amount: DecimalMoney): number {
  const [whole = '0', frac = '00'] = amount.split('.');
  const normalizedFrac = (frac + '00').slice(0, 2);
  return Number(whole) * 100 + Number(normalizedFrac);
}

/** Convert integer minor units back into a strict 2-decimal string matching OpenAPI Money schema. */
export function fromMinorUnits(minorUnits: number): DecimalMoney {
  const safe = Math.max(0, Math.round(minorUnits));
  const whole = Math.floor(safe / 100);
  const frac = String(safe % 100).padStart(2, '0');
  return `${whole}.${frac}`;
}

/** Compute unitPrice * quantity using integer minor units and return a 2-decimal string. */
export function multiplyMoney(unitPrice: DecimalMoney, quantity: number): DecimalMoney {
  return fromMinorUnits(toMinorUnits(unitPrice) * quantity);
}

/** Sum an array of 2-decimal money strings accurately and return a 2-decimal string. */
export function sumMoney(amounts: DecimalMoney[]): DecimalMoney {
  const totalMinor = amounts.reduce((acc, item) => acc + toMinorUnits(item), 0);
  return fromMinorUnits(totalMinor);
}

/** Format an ISO-8601 UTC timestamp into concise Vietnamese local date/time text. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Compute the lowest active variant price for a product for catalog grid display. */
export function getLowestActivePrice(product: Product): DecimalMoney {
  const activeVariants = product.variants.filter((v) => v.status === 'ACTIVE');
  const pool = activeVariants.length > 0 ? activeVariants : product.variants;
  if (pool.length === 0) {
    return '0.00';
  }
  return pool.reduce((min, v) =>
    toMinorUnits(v.price) < toMinorUnits(min.price) ? v : min,
  ).price;
}

/** Return total remaining stock across active variants of a product. */
export function getTotalActiveStock(product: Product): number {
  return product.variants
    .filter((v) => v.status === 'ACTIVE')
    .reduce((sum, v) => sum + v.stockQuantity, 0);
}

/** Generate a unique client Idempotency-Key for COD checkout retries. */
export function createIdempotencyKey(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `cod-${Date.now()}-${rand}`;
}

/** Generate a unique synthetic requestId matching OpenAPI Error schema. */
export function createRequestId(): string {
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Human-readable Vietnamese label for internal order status values. */
export function getOrderStatusLabel(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    PENDING: 'Chờ xác nhận',
    CONFIRMED: 'Đã xác nhận',
    PACKING: 'Đang đóng gói',
    SHIPPING: 'Đang giao hàng',
    DELIVERED: 'Đã giao thành công',
    CANCELLED: 'Đã hủy',
  };
  return labels[status];
}

/** Human-readable Vietnamese label for COD payment status values. */
export function getPaymentStatusLabel(status: PaymentStatus): string {
  return status === 'PAID' ? 'Đã thu COD (mô phỏng)' : 'Chưa thu (COD mô phỏng)';
}
