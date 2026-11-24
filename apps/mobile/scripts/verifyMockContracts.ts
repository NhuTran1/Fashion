import { mockServer } from '../src/mock/mockServer';
import { ApiClientError } from '../src/types/api';

/** Minimal runtime assertion helper keeping script free of Node-specific type packages. */
function assertTrue(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

/** Minimal equality assertion helper for contract verification. */
function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message} (expected ${String(expected)}, got ${String(actual)})`);
  }
}

/** Assert that an async operation rejects with a specific HTTP status and OpenAPI error code. */
async function expectApiError(
  fn: () => Promise<unknown>,
  expectedStatus: number,
  expectedCode: string,
): Promise<void> {
  let caught: unknown;
  try {
    await fn();
  } catch (err) {
    caught = err;
  }
  assertTrue(caught instanceof ApiClientError, `Expected ApiClientError, got ${String(caught)}`);
  if (caught instanceof ApiClientError) {
    assertEqual(caught.status, expectedStatus, 'Unexpected HTTP status');
    assertEqual(caught.code, expectedCode, 'Unexpected OpenAPI error code');
  }
}

/** Run end-to-end verification of OpenAPI v1.0.0 & RBAC v1 invariants on MockFashionServer. */
async function runAllContractChecks(): Promise<void> {
  mockServer.reset();
  mockServer.setLatency(0);

  // AC-01: Public catalog returns only ACTIVE products and ACTIVE categories/variants.
  const categories = await mockServer.listCategories();
  assertTrue(
    categories.every((c) => c.status === 'ACTIVE'),
    'All public categories must be ACTIVE',
  );
  const catalog = await mockServer.listProducts({ page: 1, pageSize: 50 });
  assertTrue(
    catalog.items.every((p) => p.status === 'ACTIVE'),
    'All public products must be ACTIVE',
  );
  assertTrue(!catalog.items.some((p) => p.id === '108'), 'Draft product #108 must stay hidden');

  // Auth & Role checks: Customer login + Admin login + IDOR 404 + RBAC 403.
  const custWeb = await mockServer.loginWeb({
    email: 'customer@example.test',
    password: 'demo-example-only',
  });
  const custToken = custWeb.sessionToken;
  const custCsrf = custWeb.payload.csrfToken;

  const adminWeb = await mockServer.loginWeb({
    email: 'admin@example.test',
    password: 'admin-demo-only',
  });
  const adminToken = adminWeb.sessionToken;
  const adminCsrf = adminWeb.payload.csrfToken;

  // Customer cannot access Admin endpoints (403 FORBIDDEN).
  await expectApiError(() => mockServer.listAdminOrders(custToken), 403, 'FORBIDDEN');
  // Customer 1 cannot read Customer 2's order #204 (404 NOT_FOUND).
  await expectApiError(() => mockServer.getMyOrder(custToken, '204'), 404, 'NOT_FOUND');

  // AC-02 & AC-04: Cart server-side pricing + Idempotent COD Checkout (201 then 200 replay, 409 conflict).
  const cartBefore = await mockServer.getCart(custToken);
  assertEqual(cartBefore.items.length, 1, 'Seed cart should contain 1 item');
  assertEqual(cartBefore.subtotal, '480000.00', 'Seed cart subtotal mismatch');

  const idemKey = 'test-idem-key-1';
  const checkoutBody = {
    addressId: '10',
    method: 'COD' as const,
    items: [{ variantId: '1001', quantity: 1 }],
  };
  const firstCheckout = await mockServer.checkoutCod(custToken, custCsrf, idemKey, checkoutBody);
  assertEqual(firstCheckout.replayed, false, 'First checkout must be 201 Created');
  assertEqual(firstCheckout.order.status, 'PENDING', 'New order must start PENDING');
  assertEqual(firstCheckout.order.paymentStatus, 'UNPAID', 'New COD order must start UNPAID');
  assertEqual(firstCheckout.order.total, '480000.00', 'Order total mismatch');

  // Exact retry returns 200 Replay with identical order ID.
  const replayCheckout = await mockServer.checkoutCod(custToken, custCsrf, idemKey, checkoutBody);
  assertEqual(replayCheckout.replayed, true, 'Retry checkout must return 200 Replay');
  assertEqual(replayCheckout.order.id, firstCheckout.order.id, 'Replay must return same order ID');

  // Different body with same key returns 409 IDEMPOTENCY_CONFLICT.
  await expectApiError(
    () =>
      mockServer.checkoutCod(custToken, custCsrf, idemKey, {
        addressId: '11',
        method: 'COD',
        items: [{ variantId: '1001', quantity: 1 }],
      }),
    409,
    'IDEMPOTENCY_CONFLICT',
  );

  // AC-07: Cancel order restores stock at most once even if cancelled twice.
  const productAfterCheckout = await mockServer.getProduct('101');
  const v1001AfterCheckout = productAfterCheckout.variants.find((v) => v.id === '1001');
  assertEqual(v1001AfterCheckout?.stockQuantity, 13, 'Stock should decrement from 14 to 13');

  await mockServer.cancelMyOrder(custToken, custCsrf, firstCheckout.order.id);
  await mockServer.cancelMyOrder(custToken, custCsrf, firstCheckout.order.id);
  const productAfterCancel = await mockServer.getProduct('101');
  const v1001AfterCancel = productAfterCancel.variants.find((v) => v.id === '1001');
  assertEqual(v1001AfterCancel?.stockQuantity, 14, 'Stock must restore exactly once');

  // AC-06: Admin confirms delivery and simulated COD collection on SHIPPING order #203.
  const delivered = await mockServer.confirmDeliveryAndCod(adminToken, adminCsrf, '203');
  assertEqual(delivered.status, 'DELIVERED', 'Order #203 should become DELIVERED');
  assertEqual(delivered.paymentStatus, 'PAID', 'Order #203 payment should become PAID');

  // AC-09 & AC-10: Verified purchase review + duplicate check + Admin moderation audit.
  const review = await mockServer.createReview(custToken, custCsrf, {
    orderItemId: '3001',
    rating: 5,
    content: 'Chất lượng may rất tốt',
  });
  await expectApiError(
    () =>
      mockServer.createReview(custToken, custCsrf, {
        orderItemId: '3001',
        rating: 4,
        content: 'Gửi trùng',
      }),
    409,
    'REVIEW_ALREADY_EXISTS',
  );
  const moderated = await mockServer.moderateReview(adminToken, adminCsrf, review.id, {
    status: 'HIDDEN',
  });
  assertEqual(moderated.status, 'HIDDEN', 'Moderation should set status to HIDDEN');

  // AC-12 (MVP B): Staff with orders.read + orders.process cannot adjust inventory (403).
  const staffWeb = await mockServer.loginWeb({
    email: 'staff@example.test',
    password: 'staff-demo-only',
  });
  await expectApiError(
    () =>
      mockServer.adjustInventory(staffWeb.sessionToken, staffWeb.payload.csrfToken, '1001', {
        delta: 1,
        reason: 'Unauthorized test',
      }),
    403,
    'FORBIDDEN',
  );

  console.log('ALL OPENAPI v1.0.0 & RBAC v1 MOCK CONTRACT CHECKS PASSED');
}

void runAllContractChecks();
