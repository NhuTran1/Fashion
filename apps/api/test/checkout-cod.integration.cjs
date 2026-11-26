require('reflect-metadata');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { request } = require('node:http');
const { createRequire } = require('node:module');
const { after, before, test } = require('node:test');
const { setTimeout: delay } = require('node:timers/promises');
const { NestFactory } = require('@nestjs/core');
const { argon2id, hash } = require('argon2');
const { AppModule } = require('../dist/app.module');
const { DatabaseService } = require('../dist/database/database.service');
const { configureHttp } = require('../dist/http');

const origin = 'https://fashioncommerce.example.test';
const password = randomBytes(24).toString('hex');
const address = {
  name: 'Khách demo',
  phone: '0900000000',
  addressText: '12 Đường demo',
};
const database = new DatabaseService();
let app;
let db;
let sql;
let base;
let passwordHash;
let category;

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
  passwordHash = await hash(password, { type: argon2id });
  category = await db.category.create({
    data: { name: 'Danh mục demo', slug: 'm507', status: 'ACTIVE' },
  });
  app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false,
  });
  configureHttp(app);
  await app.listen(0, '127.0.0.1');
  base = (await app.getUrl()) + '/api/v1';
});

after(async () => {
  await Promise.all([app?.close(), database.onModuleDestroy(), sql?.end()]);
});

// Tạo các SKU theo thứ tự ID để biết SKU nào được cập nhật trước trong checkout.
async function seedCart(label, stockQuantity = 3, ...additionalStocks) {
  const product = await db.product.create({
    data: {
      categoryId: category.id,
      name: 'Áo demo',
      slug: `m507-${label}`,
      description: '',
      status: 'ACTIVE',
    },
  });
  const variants = [];
  for (const [index, stock] of [stockQuantity, ...additionalStocks].entries()) {
    variants.push(
      await db.productVariant.create({
        data: {
          productId: product.id,
          sku: `M507-${label}-${index}`,
          size: 'M',
          color: 'Đen',
          price: '12.34',
          stockQuantity: stock,
          status: 'ACTIVE',
        },
      }),
    );
  }
  return seedCustomerCart(label, variants);
}

// Tạo Customer, địa chỉ và giỏ riêng, có thể dùng các SKU đã có để kiểm tra tranh tồn.
async function seedCustomerCart(label, variants) {
  const items = variants.map(({ id: variantId }) => ({
    variantId,
    quantity: 1,
  }));
  const customer = await db.user.create({
    data: {
      email: `m507-${label}@example.test`,
      passwordHash,
      role: 'CUSTOMER',
      status: 'ACTIVE',
      addresses: { create: address },
      cart: { create: { items: { create: items } } },
    },
    include: { addresses: true },
  });
  return {
    customer,
    variants,
    key: `m507-${label}`,
    body: {
      addressId: String(customer.addresses[0].id),
      method: 'COD',
      items: items.map(({ variantId, quantity }) => ({
        variantId: String(variantId),
        quantity,
      })),
    },
  };
}

// Đăng nhập qua HTTP và dùng đúng credential cho từng kênh.
async function login(email, channel) {
  const web = channel === 'web';
  const response = await fetch(
    base + (web ? '/auth/web/login' : '/auth/login'),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(web ? { Origin: origin } : {}),
      },
      body: JSON.stringify({ email, password }),
    },
  );
  assert.equal(response.status, 200);
  const data = await response.json();
  if (!web) return { Authorization: `Bearer ${data.token}` };
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie?.startsWith('__Host-session='));
  return { Cookie: cookie, Origin: origin, 'X-CSRF-Token': data.csrfToken };
}

function checkout({ body, key }, headers = {}) {
  return fetch(base + '/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(key !== undefined ? { 'Idempotency-Key': key } : {}),
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

async function expectError(response, status, code) {
  assert.equal(response.status, status);
  assert.equal((await response.json()).code, code);
}

async function assertStored(fixture, orderCount, expectedStocks) {
  const userId = fixture.customer.id;
  const orders = await db.order.findMany({
    where: { userId },
    include: { payment: true, items: true, inventoryMovements: true },
  });
  assert.equal(orders.length, orderCount);
  const lineCount = orderCount * fixture.body.items.length;
  assert.equal(
    await db.paymentRecord.count({ where: { order: { userId } } }),
    orderCount,
  );
  assert.equal(
    await db.orderItem.count({ where: { order: { userId } } }),
    lineCount,
  );
  assert.equal(
    await db.inventoryMovement.count({ where: { actorUserId: userId } }),
    lineCount,
  );
  const variants = await db.productVariant.findMany({
    where: { id: { in: fixture.variants.map(({ id }) => id) } },
    orderBy: { id: 'asc' },
    select: { stockQuantity: true },
  });
  assert.deepEqual(
    variants.map(({ stockQuantity }) => stockQuantity),
    expectedStocks,
  );
  return orders[0];
}

// Xác nhận cả hai request đã tới InnoDB trước khi thả khóa SKU.
async function waitForCheckoutStockLocks() {
  const deadline = performance.now() + 2500;
  while (performance.now() < deadline) {
    const [{ total }] = await sql.query(`
      SELECT COUNT(DISTINCT w.REQUESTING_THREAD_ID) AS total
      FROM performance_schema.data_lock_waits w
      JOIN performance_schema.data_locks l
        ON l.ENGINE_LOCK_ID = w.REQUESTING_ENGINE_LOCK_ID
      WHERE l.OBJECT_SCHEMA = DATABASE()
        AND l.OBJECT_NAME IN ('product_variants', 'products', 'categories')
    `);
    if (Number(total) === 2) return;
    await delay(20);
  }
  assert.fail('Expected both checkout requests to wait on InnoDB stock locks');
}

for (const channel of ['native', 'web']) {
  test(`checkout COD over ${channel} creates one UNPAID payment and supports replay`, async () => {
    const fixture = await seedCart(channel, 1);
    const headers = await login(fixture.customer.email, channel);
    const responses = await Promise.all([
      checkout(fixture, headers),
      checkout(fixture, headers),
    ]);
    responses.sort((first, second) => second.status - first.status);
    assert.deepEqual(
      responses.map(({ status }) => status),
      [201, 200],
    );
    assert.equal(responses[0].headers.get('cache-control'), 'no-store');
    const created = await responses[0].json();
    assert.deepEqual(await responses[1].json(), created);

    const stored = await assertStored(fixture, 1, [0]);
    const [variant] = fixture.variants;
    assert.equal(stored.payment.method, 'COD');
    assert.equal(stored.payment.status, 'UNPAID');
    assert.equal(stored.payment.providerReference, null);
    assert.equal(stored.payment.idempotencyKey, fixture.key);
    assert.equal(stored.inventoryMovements[0].delta, -1);
    assert.deepEqual(created, {
      id: String(stored.id),
      status: 'PENDING',
      paymentStatus: 'UNPAID',
      subtotal: '12.34',
      shippingFee: '0.00',
      total: '12.34',
      address,
      items: [
        {
          id: String(stored.items[0].id),
          variantId: String(variant.id),
          sku: variant.sku,
          name: 'Áo demo',
          size: 'M',
          color: 'Đen',
          quantity: 1,
          unitPrice: '12.34',
          lineTotal: '12.34',
        },
      ],
      createdAt: stored.createdAt.toISOString(),
    });
  });
}

test('two Customers contest the last SKU over HTTP and only one complete order commits', async () => {
  const first = await seedCart('gate-race-a', 1);
  const second = await seedCustomerCart('gate-race-b', first.variants);
  const [variant] = first.variants;
  const [native, web] = await Promise.all([
    login(first.customer.email, 'native'),
    login(second.customer.email, 'web'),
  ]);

  await sql.beginTransaction();
  let pending;
  try {
    await sql.query('SELECT id FROM product_variants WHERE id = ? FOR UPDATE', [
      variant.id,
    ]);
    pending = Promise.allSettled([
      checkout(first, native),
      checkout(second, web),
    ]);
    await waitForCheckoutStockLocks();
  } finally {
    await sql.rollback();
    await pending;
  }

  const [firstOutcome, secondOutcome] = await pending;
  assert.equal(firstOutcome.status, 'fulfilled', firstOutcome.reason?.stack);
  assert.equal(secondOutcome.status, 'fulfilled', secondOutcome.reason?.stack);
  const results = [
    { fixture: first, response: firstOutcome.value },
    { fixture: second, response: secondOutcome.value },
  ].sort((a, b) => a.response.status - b.response.status);
  const [winner, loser] = results;
  assert.equal(winner.response.status, 201);
  await expectError(loser.response, 409, 'OUT_OF_STOCK');

  const order = await assertStored(winner.fixture, 1, [0]);
  const responseOrder = await winner.response.json();
  assert.equal(responseOrder.id, String(order.id));
  assert.equal(responseOrder.paymentStatus, 'UNPAID');
  assert.equal(order.payment.method, 'COD');
  assert.equal(order.payment.status, 'UNPAID');
  assert.equal(order.payment.idempotencyKey, winner.fixture.key);
  assert.equal(order.items.length, 1);
  assert.equal(order.items[0].variantId, variant.id);
  assert.equal(order.items[0].quantity, 1);
  assert.equal(order.inventoryMovements.length, 1);
  assert.equal(order.inventoryMovements[0].variantId, variant.id);
  assert.equal(order.inventoryMovements[0].delta, -1);
  await assertStored(loser.fixture, 0, [0]);
});

test('checkout enforces Customer sessions, Web Origin and CSRF', async () => {
  const fixture = await seedCart('auth');
  const admin = await db.user.create({
    data: {
      email: 'm507-admin@example.test',
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });
  const adminHeaders = await login(admin.email, 'web');
  const { 'X-CSRF-Token': csrf, ...webHeaders } = await login(
    fixture.customer.email,
    'web',
  );
  await expectError(await checkout(fixture), 401, 'UNAUTHENTICATED');
  await expectError(await checkout(fixture, adminHeaders), 403, 'FORBIDDEN');
  await expectError(await checkout(fixture, webHeaders), 403, 'CSRF_INVALID');
  await expectError(
    await checkout(fixture, {
      ...webHeaders,
      Origin: 'https://other.example.test',
      'X-CSRF-Token': csrf,
    }),
    403,
    'FORBIDDEN',
  );
  await assertStored(fixture, 0, [3]);
});

test('checkout only accepts COD and validates the entire JSON and key', async () => {
  const fixture = await seedCart('validation');
  const headers = await login(fixture.customer.email, 'native');
  const [item] = fixture.body.items;
  for (const change of [
    { method: 'CARD' },
    { cardNumber: 'test-only' },
    { providerReference: 'fake-reference' },
    { paymentStatus: 'PAID' },
    { total: '0.01' },
    { addressId: '18446744073709551616' },
    { items: [] },
    { items: [null] },
    { items: [[item]] },
    { items: [{ ...item, variantId: '18446744073709551616' }] },
    { items: [{ ...item, quantity: '1' }] },
    { items: [{ ...item, quantity: 0 }] },
    { items: [{ ...item, unitPrice: '0.01' }] },
  ]) {
    await expectError(
      await checkout(
        { ...fixture, body: { ...fixture.body, ...change } },
        headers,
      ),
      400,
      'VALIDATION_ERROR',
    );
  }
  for (const key of [undefined, '', 'K'.repeat(129)]) {
    await expectError(
      await checkout({ ...fixture, key }, headers),
      400,
      'VALIDATION_ERROR',
    );
  }
  const duplicateKeyStatus = await new Promise((resolve, reject) => {
    const req = request(
      base + '/orders',
      {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Idempotency-Key': ['key-one', 'key-two'],
        },
      },
      (res) => {
        res.resume();
        res.on('end', () => resolve(res.statusCode));
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    req.end(JSON.stringify(fixture.body));
  });
  assert.equal(duplicateKeyStatus, 400);
  await assertStored(fixture, 0, [3]);
});

test('checkout maps conflicts and rolls back earlier stock writes when the second SKU is unavailable', async () => {
  const fixture = await seedCart('conflicts', 2, 0);
  const foreign = await seedCart('foreign');
  const headers = await login(fixture.customer.email, 'native');
  const withQuantity = {
    ...fixture,
    body: {
      ...fixture.body,
      items: [{ ...fixture.body.items[0], quantity: 2 }, fixture.body.items[1]],
    },
  };
  await expectError(
    await checkout(
      {
        ...fixture,
        body: { ...fixture.body, addressId: foreign.body.addressId },
      },
      headers,
    ),
    404,
    'NOT_FOUND',
  );
  await expectError(await checkout(withQuantity, headers), 409, 'CART_CHANGED');
  await expectError(await checkout(fixture, headers), 409, 'OUT_OF_STOCK');
  await assertStored(fixture, 0, [2, 0]);
  await db.productVariant.update({
    where: { id: fixture.variants[1].id },
    data: { stockQuantity: 1 },
  });
  const created = await checkout(fixture, headers);
  assert.equal(created.status, 201);
  await expectError(
    await checkout(withQuantity, headers),
    409,
    'IDEMPOTENCY_CONFLICT',
  );
  await assertStored(fixture, 1, [1, 0]);
  await assertStored(foreign, 0, [3]);
});

test('failure to store COD rolls back all SKUs and leaves the key available for retry', async () => {
  const fixture = await seedCart('rollback', 1, 2);
  const headers = await login(fixture.customer.email, 'native');
  await sql.query(`
    CREATE TRIGGER m507_reject_payment BEFORE INSERT ON payment_records
    FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'COD test write failure'
  `);
  try {
    await expectError(await checkout(fixture, headers), 500, 'INTERNAL_ERROR');
    await assertStored(fixture, 0, [1, 2]);
  } finally {
    await sql.query('DROP TRIGGER m507_reject_payment');
  }
  const response = await checkout(fixture, headers);
  assert.equal(response.status, 201);
  assert.equal((await response.json()).paymentStatus, 'UNPAID');
  await assertStored(fixture, 1, [0, 1]);
});

test('COD states and payment relationships are enforced and replay reads persisted status', async () => {
  const fixture = await seedCart('state', 1);
  const headers = await login(fixture.customer.email, 'native');
  assert.equal((await checkout(fixture, headers)).status, 201);
  const stored = await assertStored(fixture, 1, [0]);
  const { id } = stored.payment;
  const missingOrder = 18_446_744_073_709_551_615n;
  await assert.rejects(
    sql.query("UPDATE payment_records SET method = 'CARD' WHERE id = ?", [id]),
    { errno: 3819 },
  );
  await assert.rejects(
    sql.query("UPDATE payment_records SET status = 'REFUNDED' WHERE id = ?", [
      id,
    ]),
    { errno: 3819 },
  );
  await assert.rejects(
    sql.query('UPDATE payment_records SET order_id = ? WHERE id = ?', [
      missingOrder,
      id,
    ]),
    { errno: 1452 },
  );
  await assert.rejects(
    db.paymentRecord.create({
      data: {
        orderId: stored.id,
        method: 'COD',
        status: 'UNPAID',
        idempotencyKey: fixture.key,
      },
    }),
    { code: 'P2002' },
  );

  // Mô phỏng trạng thái đã lưu sau khi Admin giao và thu COD ở giai đoạn M6.
  await db.$transaction([
    db.order.update({
      where: { id: stored.id },
      data: { status: 'DELIVERED' },
    }),
    db.paymentRecord.update({ where: { id }, data: { status: 'PAID' } }),
  ]);
  const replay = await checkout(fixture, headers);
  assert.equal(replay.status, 200);
  const body = await replay.json();
  assert.equal(body.id, String(stored.id));
  assert.equal(body.status, 'DELIVERED');
  assert.equal(body.paymentStatus, 'PAID');
  await assertStored(fixture, 1, [0]);
});
