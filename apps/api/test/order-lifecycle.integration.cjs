require('reflect-metadata');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { createRequire } = require('node:module');
const { after, before, test } = require('node:test');
const { setTimeout: delay } = require('node:timers/promises');
const { NestFactory } = require('@nestjs/core');
const { argon2id, hash } = require('argon2');
const { AppModule } = require('../dist/app.module');
const { DatabaseService } = require('../dist/database/database.service');
const { configureHttp } = require('../dist/http');

const database = new DatabaseService();
const origin = 'https://fashioncommerce.example.test';
const password = randomBytes(24).toString('hex');
const snapshotAddress = {
  name: 'Khách demo',
  phone: '0900000000',
  addressText: '12 Đường demo',
};
let app;
let db;
let sql;
let base;
let customerA;
let customerB;
let admin;
let variant;
let nativeHeaders;
let webHeaders;
let adminHeaders;

before(async () => {
  const url = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(url.protocol, 'mysql:');
  assert.equal(url.hostname, '127.0.0.1');
  assert.match(url.pathname, /^\/fashioncommerce_[a-z0-9_]+_test$/);
  assert(url.port && !['3306', '3307'].includes(url.port), 'Use a test port');
  process.env.AUTH_WEB_ORIGIN = origin;

  db = database.client;
  const requireFromAdapter = createRequire(
    require.resolve('@prisma/adapter-mariadb'),
  );
  sql = await requireFromAdapter('mariadb').createConnection({
    host: url.hostname,
    port: Number(url.port),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
  });
  const passwordHash = await hash(password, { type: argon2id });
  [customerA, customerB, admin] = await Promise.all(
    ['a', 'b', 'admin'].map((label) =>
      db.user.create({
        data: {
          email: `m601-${label}@example.test`,
          passwordHash,
          role: label === 'admin' ? 'ADMIN' : 'CUSTOMER',
          status: 'ACTIVE',
        },
      }),
    ),
  );
  const product = await db.product.create({
    data: {
      name: 'Áo catalog',
      slug: 'm601-product',
      description: '',
      status: 'ACTIVE',
      category: {
        create: { name: 'Danh mục demo', slug: 'm601', status: 'ACTIVE' },
      },
    },
  });
  variant = await db.productVariant.create({
    data: {
      productId: product.id,
      sku: 'M601-CURRENT',
      size: 'XL',
      color: 'Xanh',
      price: '25.50',
      stockQuantity: 20,
      status: 'ACTIVE',
    },
  });

  app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false,
  });
  configureHttp(app);
  await app.listen(0, '127.0.0.1');
  base = (await app.getUrl()) + '/api/v1';
  [nativeHeaders, webHeaders, adminHeaders] = await Promise.all([
    login(customerA.email, 'native'),
    login(customerB.email, 'web'),
    login(admin.email, 'web'),
  ]);
});

after(async () => {
  await Promise.all([app?.close(), database.onModuleDestroy(), sql?.end()]);
});

// Đăng nhập qua API thật và giữ header phiên trong bộ nhớ test.
async function login(email, channel) {
  const web = channel === 'web';
  const response = await send(web ? '/auth/web/login' : '/auth/login', {
    method: 'POST',
    headers: web ? { Origin: origin } : {},
    body: { email, password },
  });
  assert.equal(response.status, 200);
  const { token, csrfToken } = await response.json();
  if (!web) return { Authorization: `Bearer ${token}` };
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie?.startsWith('__Host-session='));
  return { Cookie: cookie, Origin: origin, 'X-CSRF-Token': csrfToken };
}

function send(path, { method = 'GET', headers = {}, body } = {}) {
  return fetch(base + path, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

// Dựng đơn bằng snapshot khác catalog hiện tại để kiểm chứng API đọc đúng dữ liệu lưu.
async function seedOrder(
  label,
  userId,
  status,
  createdAt = new Date(),
  lines = [{ variantId: variant.id, quantity: 1 }],
) {
  const idempotencyKey = `m601-${label}`;
  const units = lines.reduce((total, { quantity }) => total + quantity, 0);
  const amount = ((1234 * units) / 100).toFixed(2);
  return db.order.create({
    data: {
      userId,
      status,
      subtotal: amount,
      shippingFee: '0.00',
      total: amount,
      addressSnapshot: snapshotAddress,
      idempotencyKey,
      requestFingerprint: 'a'.repeat(64),
      createdAt,
      items: {
        create: lines.map(({ variantId, quantity }) => ({
          variantId,
          skuSnapshot: 'M601-ORIGINAL',
          nameSnapshot: 'Áo snapshot',
          sizeSnapshot: 'M',
          colorSnapshot: 'Đen',
          unitPrice: '12.34',
          quantity,
          lineTotal: ((1234 * quantity) / 100).toFixed(2),
        })),
      },
      payment: { create: { method: 'COD', status: 'UNPAID', idempotencyKey } },
    },
  });
}

function advance(id, status, headers = adminHeaders) {
  return send(`/admin/orders/${id}/status`, {
    method: 'PATCH',
    headers,
    body: { status },
  });
}

function deliver(id, headers = adminHeaders) {
  return send(`/admin/orders/${id}/deliver`, { method: 'POST', headers });
}

async function expectStatus(response, status) {
  const body = await response.json();
  assert.equal(response.status, status, JSON.stringify(body));
  return body;
}

async function expectError(response, status, code) {
  assert.equal((await expectStatus(response, status)).code, code);
}

function readAudits(id) {
  return db.adminAuditLog.findMany({
    where: { targetType: 'ORDER', targetId: id },
    orderBy: { id: 'asc' },
    select: { action: true, actorUserId: true, metadata: true },
  });
}

// Khóa một đơn trước rồi chỉ nhả khi cả hai HTTP request đã chờ MySQL.
async function raceOrder(id, first, second = first) {
  await sql.beginTransaction();
  const pending = [];
  try {
    await sql.query('SELECT id FROM orders WHERE id = ? FOR UPDATE', [id]);
    for (const [index, act] of [first, second].entries()) {
      pending.push(Promise.allSettled([act()]));
      const expected = index + 1;
      const deadline = performance.now() + 2500;
      let waiting = 0;
      while (performance.now() < deadline) {
        const [{ total }] = await sql.query(`
          SELECT COUNT(DISTINCT w.REQUESTING_THREAD_ID) AS total
          FROM performance_schema.data_lock_waits w
          JOIN performance_schema.data_locks l
            ON l.ENGINE_LOCK_ID = w.REQUESTING_ENGINE_LOCK_ID
          WHERE l.OBJECT_SCHEMA = DATABASE() AND l.OBJECT_NAME = 'orders'
        `);
        waiting = Number(total);
        if (waiting === expected) break;
        await delay(20);
      }
      assert.equal(waiting, expected, 'Requests must wait on the order lock');
    }
  } finally {
    await sql.rollback();
    await Promise.all(pending);
  }
  return (await Promise.all(pending)).flat().map((outcome) => {
    assert.equal(outcome.status, 'fulfilled', outcome.reason?.stack);
    return outcome.value;
  });
}

test('Customer history is paginated, stable and scoped to the authenticated owner', async () => {
  const timestamp = new Date('2026-11-20T01:00:00.000Z');
  const earlier = await seedOrder(
    'earlier',
    customerA.id,
    'PENDING',
    new Date(timestamp.getTime() - 1000),
  );
  const lowerId = await seedOrder(
    'lower-id',
    customerA.id,
    'CONFIRMED',
    timestamp,
  );
  const higherId = await seedOrder(
    'higher-id',
    customerA.id,
    'PENDING',
    timestamp,
  );
  const foreign = await seedOrder(
    'foreign',
    customerB.id,
    'PENDING',
    timestamp,
  );

  const first = await expectStatus(
    await send('/orders/me?page=1&pageSize=2', { headers: nativeHeaders }),
    200,
  );
  assert.deepEqual(
    first.items.map(({ id }) => id),
    [String(higherId.id), String(lowerId.id)],
  );
  assert.deepEqual([first.total, first.page, first.pageSize], [3, 1, 2]);
  const second = await expectStatus(
    await send('/orders/me?page=2&pageSize=2', { headers: nativeHeaders }),
    200,
  );
  assert.deepEqual(
    second.items.map(({ id }) => id),
    [String(earlier.id)],
  );
  const empty = await expectStatus(
    await send('/orders/me?page=9007199254740991', { headers: nativeHeaders }),
    200,
  );
  assert.deepEqual(empty, {
    items: [],
    page: Number.MAX_SAFE_INTEGER,
    pageSize: 20,
    total: 3,
  });

  const details = await send(`/orders/${lowerId.id}`, {
    headers: nativeHeaders,
  });
  assert.equal(details.headers.get('cache-control'), 'no-store');
  const own = await expectStatus(details, 200);
  assert.deepEqual(own, first.items[1]);
  assert.deepEqual(own.address, snapshotAddress);
  assert.equal(own.total, '12.34');
  assert.equal(own.items[0].sku, 'M601-ORIGINAL');
  assert.equal(own.items[0].name, 'Áo snapshot');
  assert.equal(own.paymentStatus, 'UNPAID');
  assert.deepEqual(
    (
      await expectStatus(await send('/orders/me', { headers: webHeaders }), 200)
    ).items.map(({ id }) => id),
    [String(foreign.id)],
  );
  for (const id of [
    foreign.id,
    18_446_744_073_709_551_615n,
    '01',
    '18446744073709551616',
  ]) {
    await expectError(
      await send(`/orders/${id}`, { headers: nativeHeaders }),
      404,
      'NOT_FOUND',
    );
  }
});

function cancelMyOrder(id, headers = nativeHeaders) {
  return send(`/orders/${id}/cancel`, { method: 'POST', headers });
}

function cancelAdminOrder(id, reason, headers = adminHeaders) {
  return send(`/admin/orders/${id}/cancel`, {
    method: 'POST',
    headers,
    body: { reason },
  });
}

// Tạo SKU theo thứ tự khóa để ca rollback có thể làm lỗi đúng dòng thứ hai.
async function cancellationVariants(label, stocks) {
  const variants = [];
  for (const [index, stockQuantity] of stocks.entries()) {
    variants.push(
      await db.productVariant.create({
        data: {
          productId: variant.productId,
          sku: `M602-${label}-${index}`,
          size: 'M',
          color: 'Đen',
          price: '12.34',
          stockQuantity,
          status: 'ACTIVE',
        },
      }),
    );
  }
  return variants;
}

async function assertCancellation(
  id,
  variants,
  status,
  expectedStocks,
  expectedDeltas,
) {
  const order = await db.order.findUniqueOrThrow({
    where: { id },
    include: {
      payment: true,
      inventoryMovements: { orderBy: { variantId: 'asc' } },
    },
  });
  assert.equal(order.status, status);
  assert.equal(order.payment.status, 'UNPAID');
  const restored = order.inventoryMovements.filter(({ delta }) => delta > 0);
  assert.deepEqual(
    restored.map(({ delta }) => delta),
    expectedDeltas,
  );
  const stored = await db.productVariant.findMany({
    where: { id: { in: variants.map(({ id: variantId }) => variantId) } },
    orderBy: { id: 'asc' },
    select: { stockQuantity: true },
  });
  assert.deepEqual(
    stored.map(({ stockQuantity }) => stockQuantity),
    expectedStocks,
  );
  return restored;
}

test('Customer cancels a real COD checkout once, including a SKU that stopped selling', async () => {
  const variants = await cancellationVariants('customer', [5]);
  const [sku] = variants;
  const address = await db.address.create({
    data: { ...snapshotAddress, userId: customerB.id },
  });
  await db.cart.create({
    data: {
      userId: customerB.id,
      items: { create: { variantId: sku.id, quantity: 2 } },
    },
  });
  const order = await expectStatus(
    await send('/orders', {
      method: 'POST',
      headers: { ...webHeaders, 'Idempotency-Key': 'm602-customer-checkout' },
      body: {
        addressId: String(address.id),
        method: 'COD',
        items: [{ variantId: String(sku.id), quantity: 2 }],
      },
    }),
    201,
  );
  const id = BigInt(order.id);
  await assertCancellation(id, variants, 'PENDING', [3], []);
  await db.productVariant.update({
    where: { id: sku.id },
    data: { status: 'INACTIVE' },
  });

  const { 'X-CSRF-Token': csrf, ...withoutCsrf } = webHeaders;
  assert.ok(csrf);
  await expectError(await cancelMyOrder(id, withoutCsrf), 403, 'CSRF_INVALID');
  await expectError(await cancelMyOrder(id, {}), 401, 'UNAUTHENTICATED');
  await expectError(await cancelMyOrder(id, adminHeaders), 403, 'FORBIDDEN');
  await expectError(await cancelMyOrder(id), 404, 'NOT_FOUND');
  await expectError(
    await cancelMyOrder('18446744073709551615'),
    404,
    'NOT_FOUND',
  );
  await assertCancellation(id, variants, 'PENDING', [3], []);

  const cancelled = await expectStatus(
    await cancelMyOrder(id, webHeaders),
    200,
  );
  assert.deepEqual(cancelled, { ...order, status: 'CANCELLED' });
  assert.deepEqual(
    await expectStatus(await cancelMyOrder(id, webHeaders), 200),
    cancelled,
  );
  await expectError(await cancelMyOrder(id), 404, 'NOT_FOUND');
  const [movement] = await assertCancellation(
    id,
    variants,
    'CANCELLED',
    [5],
    [2],
  );
  assert.equal(movement.actorUserId, customerB.id);
  assert.equal(movement.variantId, sku.id);
  assert.deepEqual(await readAudits(id), []);
});

test('two Customer cancellation requests both return the same snapshot and restore each SKU once', async () => {
  const variants = await cancellationVariants('double', [2, 3]);
  const lines = variants.map(({ id: variantId }, index) => ({
    variantId,
    quantity: index + 1,
  }));
  const order = await seedOrder(
    'double-cancel',
    customerA.id,
    'PENDING',
    undefined,
    lines,
  );
  const responses = await raceOrder(order.id, () => cancelMyOrder(order.id));
  const bodies = await Promise.all(
    responses.map((response) => expectStatus(response, 200)),
  );
  assert.equal(bodies[0].status, 'CANCELLED');
  assert.deepEqual(bodies[0], bodies[1]);
  const movements = await assertCancellation(
    order.id,
    variants,
    'CANCELLED',
    [3, 5],
    [1, 2],
  );
  assert.deepEqual(
    movements.map(({ variantId }) => variantId),
    variants.map(({ id }) => id),
  );
});

test('Admin cancellation needs a reason, rejects SHIPPING and audits the first valid cancellation', async () => {
  const variants = await cancellationVariants('admin', [3]);
  const lines = [{ variantId: variants[0].id, quantity: 1 }];
  const confirmed = await seedOrder(
    'admin-confirmed',
    customerA.id,
    'CONFIRMED',
    undefined,
    lines,
  );
  const shipping = await seedOrder(
    'admin-shipping',
    customerA.id,
    'SHIPPING',
    undefined,
    lines,
  );
  await expectError(
    await cancelMyOrder(confirmed.id),
    409,
    'INVALID_ORDER_STATE',
  );
  await expectError(
    await cancelAdminOrder(confirmed.id, 'test', webHeaders),
    403,
    'FORBIDDEN',
  );
  const { 'X-CSRF-Token': csrf, ...withoutCsrf } = adminHeaders;
  assert.ok(csrf);
  await expectError(
    await cancelAdminOrder(confirmed.id, 'test', withoutCsrf),
    403,
    'CSRF_INVALID',
  );
  for (const reason of [undefined, '', '  ', 'á'.repeat(32_768)]) {
    await expectError(
      await cancelAdminOrder(confirmed.id, reason),
      400,
      'VALIDATION_ERROR',
    );
  }
  await expectError(
    await cancelAdminOrder('18446744073709551615', 'test'),
    404,
    'NOT_FOUND',
  );
  await expectError(
    await cancelAdminOrder(shipping.id, 'test'),
    409,
    'INVALID_ORDER_STATE',
  );
  await assertCancellation(shipping.id, variants, 'SHIPPING', [3], []);
  await assertCancellation(confirmed.id, variants, 'CONFIRMED', [3], []);
  const cancelled = await expectStatus(
    await cancelAdminOrder(confirmed.id, '  Khách đổi ý  '),
    200,
  );
  assert.equal(cancelled.status, 'CANCELLED');
  assert.deepEqual(
    await expectStatus(
      await cancelAdminOrder(confirmed.id, 'Lý do thứ hai'),
      200,
    ),
    cancelled,
  );
  const [movement] = await assertCancellation(
    confirmed.id,
    variants,
    'CANCELLED',
    [4],
    [1],
  );
  assert.equal(movement.reason, 'Khách đổi ý');
  assert.equal(movement.actorUserId, admin.id);
  assert.deepEqual(await readAudits(confirmed.id), [
    {
      action: 'CANCEL_ORDER',
      actorUserId: admin.id,
      metadata: {
        previousStatus: 'CONFIRMED',
        status: 'CANCELLED',
        reason: 'Khách đổi ý',
      },
    },
  ]);
});

test('Admin cancellation and PACKING to SHIPPING can each win the same row lock', async () => {
  for (const cancelFirst of [true, false]) {
    const label = cancelFirst ? 'cancel-wins' : 'shipping-wins';
    const variants = await cancellationVariants(label, [3]);
    const order = await seedOrder(label, customerA.id, 'PACKING', undefined, [
      { variantId: variants[0].id, quantity: 2 },
    ]);
    const cancel = () => cancelAdminOrder(order.id, 'Khách đổi ý');
    const ship = () => advance(order.id, 'SHIPPING');
    const [winner, loser] = await raceOrder(
      order.id,
      cancelFirst ? cancel : ship,
      cancelFirst ? ship : cancel,
    );
    const status = cancelFirst ? 'CANCELLED' : 'SHIPPING';
    assert.equal((await expectStatus(winner, 200)).status, status);
    await expectError(loser, 409, 'INVALID_ORDER_STATE');
    await assertCancellation(
      order.id,
      variants,
      status,
      cancelFirst ? [5] : [3],
      cancelFirst ? [2] : [],
    );
    assert.deepEqual(
      (await readAudits(order.id)).map(({ action }) => action),
      [cancelFirst ? 'CANCEL_ORDER' : 'ADVANCE_ORDER_STATUS'],
    );
  }
});

test('second SKU movement, stock overflow or Admin audit failure rolls back the whole cancellation', async () => {
  const variants = await cancellationVariants('rollback', [2, 3]);
  const lines = variants.map(({ id: variantId }) => ({
    variantId,
    quantity: 1,
  }));
  const order = await seedOrder(
    'rollback-cancel',
    customerA.id,
    'PACKING',
    undefined,
    lines,
  );
  const cancel = () => cancelAdminOrder(order.id, 'Thử rollback');
  await sql.query(`
    CREATE TRIGGER m602_movement_failure BEFORE INSERT ON inventory_movements
    FOR EACH ROW
    BEGIN
      IF NEW.variant_id = ${variants[1].id} AND NEW.delta > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Fixture second SKU movement failure';
      END IF;
    END
  `);
  try {
    await expectError(await cancel(), 500, 'INTERNAL_ERROR');
    await assertCancellation(order.id, variants, 'PACKING', [2, 3], []);
    assert.deepEqual(await readAudits(order.id), []);
  } finally {
    await sql.query('DROP TRIGGER m602_movement_failure');
  }

  const maxStock = 2_147_483_647;
  await db.productVariant.update({
    where: { id: variants[1].id },
    data: { stockQuantity: maxStock },
  });
  await expectError(await cancel(), 500, 'INTERNAL_ERROR');
  await assertCancellation(order.id, variants, 'PACKING', [2, maxStock], []);
  assert.deepEqual(await readAudits(order.id), []);
  await db.productVariant.update({
    where: { id: variants[1].id },
    data: { stockQuantity: 3 },
  });

  await sql.query(`
    CREATE TRIGGER m602_audit_failure BEFORE INSERT ON admin_audit_logs
    FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Fixture cancellation audit failure'
  `);
  try {
    await expectError(await cancel(), 500, 'INTERNAL_ERROR');
    await assertCancellation(order.id, variants, 'PACKING', [2, 3], []);
    assert.deepEqual(await readAudits(order.id), []);
  } finally {
    await sql.query('DROP TRIGGER m602_audit_failure');
  }
  assert.equal((await expectStatus(await cancel(), 200)).status, 'CANCELLED');
  await assertCancellation(order.id, variants, 'CANCELLED', [3, 4], [1, 1]);
  assert.equal((await readAudits(order.id)).length, 1);
});

test('Admin list filters orders and endpoints enforce session, role, Origin and CSRF', async () => {
  const order = await seedOrder('admin-view', customerB.id, 'SHIPPING');
  const { 'X-CSRF-Token': csrf, ...adminRead } = adminHeaders;
  const list = await expectStatus(
    await send('/admin/orders?status=SHIPPING&pageSize=1', {
      headers: adminRead,
    }),
    200,
  );
  assert.equal(list.items.length, 1);
  assert.equal(list.items[0].id, String(order.id));
  assert.equal(list.items[0].status, 'SHIPPING');
  assert.equal(list.pageSize, 1);
  assert.deepEqual(
    await expectStatus(
      await send(`/admin/orders/${order.id}`, { headers: adminRead }),
      200,
    ),
    list.items[0],
  );
  await expectError(
    await send('/admin/orders?status=INVALID', { headers: adminRead }),
    400,
    'VALIDATION_ERROR',
  );
  await expectError(
    await send('/orders/me?pageSize=101', { headers: nativeHeaders }),
    400,
    'VALIDATION_ERROR',
  );
  await expectError(
    await send('/admin/orders/0', { headers: adminRead }),
    404,
    'NOT_FOUND',
  );
  await expectError(await send('/orders/me'), 401, 'UNAUTHENTICATED');
  await expectError(await send('/admin/orders'), 401, 'UNAUTHENTICATED');
  await expectError(
    await send('/orders/me', { headers: adminRead }),
    403,
    'FORBIDDEN',
  );
  await expectError(
    await send('/admin/orders', { headers: webHeaders }),
    403,
    'FORBIDDEN',
  );
  await expectError(
    await advance(order.id, 'PACKING', webHeaders),
    403,
    'FORBIDDEN',
  );
  await expectError(await deliver(order.id, adminRead), 403, 'CSRF_INVALID');
  await expectError(
    await deliver(order.id, {
      ...adminRead,
      'X-CSRF-Token': csrf,
      Origin: 'https://other.example.test',
    }),
    403,
    'FORBIDDEN',
  );
  assert.deepEqual(await readAudits(order.id), []);
});

test('checkout order advances step by step, is delivered with COD and cannot advance again', async () => {
  const address = await db.address.create({
    data: { ...snapshotAddress, userId: customerA.id },
  });
  await db.cart.create({
    data: {
      userId: customerA.id,
      items: { create: { variantId: variant.id, quantity: 1 } },
    },
  });
  const created = await expectStatus(
    await send('/orders', {
      method: 'POST',
      headers: {
        ...nativeHeaders,
        'Idempotency-Key': 'm601-lifecycle-checkout',
      },
      body: {
        addressId: String(address.id),
        method: 'COD',
        items: [{ variantId: String(variant.id), quantity: 1 }],
      },
    }),
    201,
  );
  const id = BigInt(created.id);
  const missingId = '18446744073709551615';
  await expectError(await advance(missingId, 'CONFIRMED'), 404, 'NOT_FOUND');
  await expectError(await deliver(missingId), 404, 'NOT_FOUND');
  await expectError(await advance(id, 'PACKING'), 409, 'INVALID_ORDER_STATE');
  await expectError(await advance(id, 'DELIVERED'), 400, 'VALIDATION_ERROR');
  await expectError(await deliver(id), 409, 'INVALID_ORDER_STATE');
  await expectError(
    await deliver((await seedOrder('cancelled', customerB.id, 'CANCELLED')).id),
    409,
    'INVALID_ORDER_STATE',
  );

  for (const status of ['CONFIRMED', 'PACKING', 'SHIPPING']) {
    const body = await expectStatus(await advance(id, status), 200);
    assert.deepEqual(body, { ...created, status });
  }
  await expectError(await advance(id, 'PACKING'), 409, 'INVALID_ORDER_STATE');
  const delivered = await expectStatus(await deliver(id), 200);
  assert.deepEqual(delivered, {
    ...created,
    status: 'DELIVERED',
    paymentStatus: 'PAID',
  });
  assert.deepEqual(await expectStatus(await deliver(id), 200), delivered);
  await expectError(await advance(id, 'SHIPPING'), 409, 'INVALID_ORDER_STATE');
  assert.deepEqual(
    await expectStatus(
      await send(`/orders/${id}`, { headers: nativeHeaders }),
      200,
    ),
    delivered,
  );

  const audits = await readAudits(id);
  assert.deepEqual(
    audits.map(({ action, actorUserId, metadata }) => ({
      action,
      actorUserId,
      ...metadata,
    })),
    [
      {
        action: 'ADVANCE_ORDER_STATUS',
        actorUserId: admin.id,
        previousStatus: 'PENDING',
        status: 'CONFIRMED',
      },
      {
        action: 'ADVANCE_ORDER_STATUS',
        actorUserId: admin.id,
        previousStatus: 'CONFIRMED',
        status: 'PACKING',
      },
      {
        action: 'ADVANCE_ORDER_STATUS',
        actorUserId: admin.id,
        previousStatus: 'PACKING',
        status: 'SHIPPING',
      },
      {
        action: 'CONFIRM_ORDER_DELIVERY',
        actorUserId: admin.id,
        previousStatus: 'SHIPPING',
        status: 'DELIVERED',
        previousPaymentStatus: 'UNPAID',
        paymentStatus: 'PAID',
      },
    ],
  );
});

test('two competing status requests write one transition and one audit', async () => {
  const order = await seedOrder('race-advance', customerB.id, 'PACKING');
  const responses = await raceOrder(order.id, () =>
    advance(order.id, 'SHIPPING'),
  );
  responses.sort((a, b) => a.status - b.status);
  assert.equal((await expectStatus(responses[0], 200)).status, 'SHIPPING');
  await expectError(responses[1], 409, 'INVALID_ORDER_STATE');
  assert.equal(
    (await db.order.findUniqueOrThrow({ where: { id: order.id } })).status,
    'SHIPPING',
  );
  assert.equal((await readAudits(order.id)).length, 1);
});

test('two competing delivery requests return the same paid snapshot with one audit', async () => {
  const order = await seedOrder('race-deliver', customerB.id, 'SHIPPING');
  const responses = await raceOrder(order.id, () => deliver(order.id));
  const [first, second] = await Promise.all(
    responses.map((response) => expectStatus(response, 200)),
  );
  assert.deepEqual(first, second);
  assert.equal(first.status, 'DELIVERED');
  assert.equal(first.paymentStatus, 'PAID');
  assert.equal((await readAudits(order.id)).length, 1);
  assert.equal(
    await db.paymentRecord.count({
      where: { orderId: order.id, status: 'PAID' },
    }),
    1,
  );
});

test('failed payment or audit writes roll back fulfillment changes', async () => {
  const shipping = await seedOrder(
    'rollback-delivery',
    customerA.id,
    'SHIPPING',
  );
  const pending = await seedOrder('rollback-advance', customerB.id, 'PENDING');
  await sql.query(`
    CREATE TRIGGER m601_payment_failure BEFORE UPDATE ON payment_records
    FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Fixture payment failure'
  `);
  try {
    await expectError(await deliver(shipping.id), 500, 'INTERNAL_ERROR');
    const order = await db.order.findUniqueOrThrow({
      where: { id: shipping.id },
      include: { payment: true },
    });
    assert.equal(order.status, 'SHIPPING');
    assert.equal(order.payment.status, 'UNPAID');
    assert.deepEqual(await readAudits(shipping.id), []);
  } finally {
    await sql.query('DROP TRIGGER m601_payment_failure');
  }

  await sql.query(`
    CREATE TRIGGER m601_audit_failure BEFORE INSERT ON admin_audit_logs
    FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Fixture audit failure'
  `);
  try {
    await expectError(await deliver(shipping.id), 500, 'INTERNAL_ERROR');
    await expectError(
      await advance(pending.id, 'CONFIRMED'),
      500,
      'INTERNAL_ERROR',
    );
    for (const [id, status] of [
      [shipping.id, 'SHIPPING'],
      [pending.id, 'PENDING'],
    ]) {
      const order = await db.order.findUniqueOrThrow({
        where: { id },
        include: { payment: true },
      });
      assert.equal(order.status, status);
      assert.equal(order.payment.status, 'UNPAID');
      assert.deepEqual(await readAudits(id), []);
    }
  } finally {
    await sql.query('DROP TRIGGER m601_audit_failure');
  }
  assert.equal(
    (await expectStatus(await deliver(shipping.id), 200)).paymentStatus,
    'PAID',
  );
});
