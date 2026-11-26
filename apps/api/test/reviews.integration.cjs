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
const address = {
  name: 'Khách demo',
  phone: '0900000000',
  addressText: '12 Đường demo',
};
const missingId = 18_446_744_073_709_551_615n;
let app;
let db;
let sql;
let base;
let customerA;
let customerB;
let native;
let web;
let admin;
let adminUserId;

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
  const [a, b, operator] = await Promise.all(
    ['a', 'b', 'admin'].map((label) =>
      db.user.create({
        data: {
          email: `m604-${label}@example.test`,
          passwordHash,
          role: label === 'admin' ? 'ADMIN' : 'CUSTOMER',
          status: 'ACTIVE',
          addresses: label === 'a' ? { create: address } : undefined,
        },
        include: { addresses: true },
      }),
    ),
  );
  customerA = a;
  customerB = b;
  adminUserId = operator.id;
  app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false,
  });
  configureHttp(app);
  await app.listen(0, '127.0.0.1');
  base = (await app.getUrl()) + '/api/v1';
  [native, web, admin] = await Promise.all([
    login(a.email, 'native'),
    login(b.email, 'web'),
    login(operator.email, 'web'),
  ]);
});

after(async () => {
  await Promise.all([app?.close(), database.onModuleDestroy(), sql?.end()]);
});

// Đăng nhập trên HTTP để kiểm tra đúng phiên, quyền và CSRF của NestJS.
async function login(email, channel) {
  const isWeb = channel === 'web';
  const response = await send(isWeb ? '/auth/web/login' : '/auth/login', {
    method: 'POST',
    headers: isWeb ? { Origin: origin } : {},
    body: { email, password },
  });
  const data = await expectStatus(response, 200);
  if (!isWeb) return { Authorization: `Bearer ${data.token}` };
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie?.startsWith('__Host-session='));
  return { Cookie: cookie, Origin: origin, 'X-CSRF-Token': data.csrfToken };
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

function postReview(orderItemId, headers = native, overrides = {}) {
  return send('/reviews', {
    method: 'POST',
    headers,
    body: {
      orderItemId: String(orderItemId),
      rating: 5,
      content: 'Đúng mô tả',
      ...overrides,
    },
  });
}

async function expectStatus(response, status) {
  const body = await response.json();
  assert.equal(response.status, status, JSON.stringify(body));
  return body;
}

async function expectError(response, status, code) {
  assert.equal((await expectStatus(response, status)).code, code);
}

async function createVariant(label) {
  const product = await db.product.create({
    data: {
      name: `Áo ${label}`,
      slug: `m604-${label}`,
      description: '',
      status: 'ACTIVE',
      category: {
        create: {
          name: 'Danh mục test',
          slug: `m604-${label}`,
          status: 'ACTIVE',
        },
      },
    },
  });
  return db.productVariant.create({
    data: {
      productId: product.id,
      sku: `M604-${label}`,
      size: 'M',
      color: 'Đen',
      price: '12.34',
      stockQuantity: 5,
      status: 'ACTIVE',
    },
  });
}

// Tạo dòng đơn riêng cho từng ca trạng thái và quyền sở hữu.
async function seedOrderItem(label, variant, owner, status = 'DELIVERED') {
  const idempotencyKey = `m604-${label}`;
  const order = await db.order.create({
    data: {
      userId: owner.id,
      status,
      subtotal: '12.34',
      shippingFee: '0.00',
      total: '12.34',
      addressSnapshot: address,
      idempotencyKey,
      requestFingerprint: 'a'.repeat(64),
      items: {
        create: {
          variantId: variant.id,
          skuSnapshot: variant.sku,
          nameSnapshot: 'Áo demo',
          sizeSnapshot: variant.size,
          colorSnapshot: variant.color,
          quantity: 1,
          unitPrice: '12.34',
          lineTotal: '12.34',
        },
      },
      payment: {
        create: {
          idempotencyKey,
          method: 'COD',
          status: status === 'DELIVERED' ? 'PAID' : 'UNPAID',
        },
      },
    },
    include: { items: true },
  });
  return order.items[0];
}

test('Customer reviews a real purchase only after Admin completes delivery', async () => {
  const variant = await createVariant('lifecycle');
  await db.cart.create({
    data: {
      userId: customerA.id,
      items: { create: { variantId: variant.id, quantity: 1 } },
    },
  });
  const order = await expectStatus(
    await send('/orders', {
      method: 'POST',
      headers: { ...native, 'Idempotency-Key': 'm604-checkout' },
      body: {
        addressId: String(customerA.addresses[0].id),
        method: 'COD',
        items: [{ variantId: String(variant.id), quantity: 1 }],
      },
    }),
    201,
  );
  const itemId = order.items[0].id;
  await expectError(await postReview(itemId), 409, 'REVIEW_NOT_ELIGIBLE');
  for (const status of ['CONFIRMED', 'PACKING', 'SHIPPING']) {
    await expectStatus(
      await send(`/admin/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: admin,
        body: { status },
      }),
      200,
    );
  }
  await expectError(await postReview(itemId), 409, 'REVIEW_NOT_ELIGIBLE');
  const delivered = await expectStatus(
    await send(`/admin/orders/${order.id}/deliver`, {
      method: 'POST',
      headers: admin,
    }),
    200,
  );
  assert.equal(delivered.status, 'DELIVERED');
  const content = '  Áo đẹp 🧵  ';
  const review = await expectStatus(
    await postReview(itemId, native, { content, rating: 1 }),
    201,
  );
  const stored = await db.review.findUniqueOrThrow({
    where: { orderItemId: BigInt(itemId) },
  });
  assert.equal(stored.userId, customerA.id);
  assert.equal(stored.productId, variant.productId);
  assert.equal(stored.status, 'VISIBLE');
  assert.deepEqual(review, {
    id: String(stored.id),
    productId: String(variant.productId),
    rating: 1,
    content,
    createdAt: stored.createdAt.toISOString(),
  });
  assert.deepEqual(
    (
      await expectStatus(
        await send(`/products/${variant.productId}/reviews`),
        200,
      )
    ).items,
    [review],
  );
});

test('foreign, missing and undelivered items are rejected without inserting reviews', async () => {
  const variant = await createVariant('scope');
  const own = await seedOrderItem('cancelled', variant, customerA, 'CANCELLED');
  const foreign = await seedOrderItem('foreign', variant, customerB);
  await expectError(await postReview(own.id), 409, 'REVIEW_NOT_ELIGIBLE');
  await expectError(await postReview(foreign.id), 404, 'NOT_FOUND');
  await expectError(await postReview(missingId), 404, 'NOT_FOUND');
  await expectError(await postReview(foreign.id, {}), 401, 'UNAUTHENTICATED');
  await expectError(await postReview(foreign.id, admin), 403, 'FORBIDDEN');
  const { 'X-CSRF-Token': csrf, ...withoutCsrf } = web;
  await expectError(
    await postReview(foreign.id, withoutCsrf),
    403,
    'CSRF_INVALID',
  );
  await expectError(
    await postReview(foreign.id, {
      ...withoutCsrf,
      'X-CSRF-Token': csrf,
      Origin: 'https://other.example.test',
    }),
    403,
    'FORBIDDEN',
  );
  assert.equal(
    await db.review.count({ where: { productId: variant.productId } }),
    0,
  );
  assert.equal(
    (await expectStatus(await postReview(foreign.id, web), 201)).rating,
    5,
  );
});

test('DTO rejects invalid rating, ID, content and caller-supplied product or owner', async () => {
  const variant = await createVariant('validation');
  const item = await seedOrderItem('validation', variant, customerA);
  for (const change of [
    { rating: 0 },
    { rating: 6 },
    { rating: 1.5 },
    { rating: '5' },
    { content: '' },
    { content: ' \t\n ' },
    { content: 'á'.repeat(32_768) },
    { orderItemId: '0' },
    { orderItemId: '18446744073709551616' },
    { productId: String(variant.productId + 1n) },
    { userId: String(customerB.id) },
    { status: 'HIDDEN' },
  ]) {
    await expectError(
      await postReview(item.id, native, change),
      400,
      'VALIDATION_ERROR',
    );
  }
  assert.equal(await db.review.count({ where: { orderItemId: item.id } }), 0);
});

// Chờ hai request chạm khóa review hoặc khóa FK của dòng mua trong MySQL.
async function waitForReviewLockWaiters() {
  const deadline = performance.now() + 2500;
  let waiting = 0;
  while (performance.now() < deadline) {
    const [{ total }] = await sql.query(`
      SELECT COUNT(DISTINCT w.REQUESTING_THREAD_ID) AS total
      FROM performance_schema.data_lock_waits w
      JOIN performance_schema.data_locks l
        ON l.ENGINE_LOCK_ID = w.REQUESTING_ENGINE_LOCK_ID
      WHERE l.OBJECT_SCHEMA = DATABASE() AND l.OBJECT_NAME IN ('order_items', 'reviews')
    `);
    waiting = Number(total);
    if (waiting === 2) break;
    await delay(20);
  }
  assert.equal(
    waiting,
    2,
    'Both requests must wait on InnoDB before releasing the lock',
  );
}

test('concurrent requests create one review and hiding it leaves the purchase slot occupied', async () => {
  const variant = await createVariant('race');
  const item = await seedOrderItem('race', variant, customerA);
  await sql.beginTransaction();
  let pending;
  try {
    await sql.query('SELECT id FROM order_items WHERE id = ? FOR UPDATE', [
      item.id,
    ]);
    pending = Promise.allSettled([postReview(item.id), postReview(item.id)]);
    await waitForReviewLockWaiters();
  } finally {
    await sql.rollback();
    await pending;
  }
  const responses = (await pending).map((outcome) => {
    assert.equal(outcome.status, 'fulfilled', outcome.reason?.stack);
    return outcome.value;
  });
  responses.sort((first, second) => first.status - second.status);
  await expectStatus(responses[0], 201);
  await expectError(responses[1], 409, 'REVIEW_ALREADY_EXISTS');
  assert.equal(await db.review.count({ where: { orderItemId: item.id } }), 1);

  await db.review.update({
    where: { orderItemId: item.id },
    data: { status: 'HIDDEN' },
  });
  await expectError(await postReview(item.id), 409, 'REVIEW_ALREADY_EXISTS');
  const page = await expectStatus(
    await send(`/products/${variant.productId}/reviews`),
    200,
  );
  assert.deepEqual(page, { items: [], page: 1, pageSize: 20, total: 0 });
});

test('public reviews paginate VISIBLE rows with stable ties and respect catalog visibility', async () => {
  const variant = await createVariant('public');
  const productId = variant.productId;
  const { categoryId } = await db.product.findUniqueOrThrow({
    where: { id: productId },
  });
  const first = await seedOrderItem('public-a', variant, customerA);
  const second = await seedOrderItem('public-b', variant, customerB);
  const hidden = await seedOrderItem('public-hidden', variant, customerA);
  const firstReview = await expectStatus(await postReview(first.id), 201);
  const secondReview = await expectStatus(
    await postReview(second.id, web),
    201,
  );
  const hiddenReview = await expectStatus(await postReview(hidden.id), 201);
  await db.review.updateMany({
    where: { productId },
    data: { createdAt: new Date('2026-11-25T00:00:00.000Z') },
  });
  await db.review.update({
    where: { id: BigInt(hiddenReview.id) },
    data: { status: 'HIDDEN' },
  });
  const path = `/products/${productId}/reviews`;
  const firstPage = await expectStatus(await send(path + '?pageSize=1'), 200);
  const secondPage = await expectStatus(
    await send(path + '?pageSize=1&page=2'),
    200,
  );
  assert.deepEqual([firstPage.total, secondPage.total], [2, 2]);
  assert.deepEqual(
    firstPage.items.map(({ id }) => id),
    [secondReview.id],
  );
  assert.deepEqual(
    secondPage.items.map(({ id }) => id),
    [firstReview.id],
  );
  await expectError(
    await send(path + '?pageSize=101'),
    400,
    'VALIDATION_ERROR',
  );
  await expectError(
    await send(`/products/${missingId}/reviews`),
    404,
    'NOT_FOUND',
  );
  for (const [model, id] of [
    [db.category, categoryId],
    [db.product, productId],
    [db.productVariant, variant.id],
  ]) {
    await model.update({ where: { id }, data: { status: 'INACTIVE' } });
    await expectError(await send(path), 404, 'NOT_FOUND');
    await model.update({ where: { id }, data: { status: 'ACTIVE' } });
  }
});

test('MySQL enforces review rating, visibility, ownership references and unique purchase line', async () => {
  const variant = await createVariant('constraints');
  const item = await seedOrderItem('constraints', variant, customerA);
  const statement =
    'INSERT INTO reviews (user_id, product_id, order_item_id, rating, content, status) VALUES (?, ?, ?, ?, ?, ?)';
  const values = [
    customerA.id,
    variant.productId,
    item.id,
    5,
    'Fixture',
    'VISIBLE',
  ];
  for (const [column, value, errno] of [
    [0, missingId, 1452],
    [1, missingId, 1452],
    [2, missingId, 1452],
    [3, 0, 3819],
    [3, 6, 3819],
    [5, 'hidden', 3819],
  ]) {
    const invalid = [...values];
    invalid[column] = value;
    await assert.rejects(sql.query(statement, invalid), { errno });
  }
  await expectStatus(await postReview(item.id), 201);
  await assert.rejects(sql.query(statement, values), { errno: 1062 });
  await assert.rejects(
    sql.query('DELETE FROM order_items WHERE id = ?', [item.id]),
    { errno: 1451 },
  );
});

function patchVisibility(id, body, headers = admin) {
  return send(`/admin/reviews/${id}/visibility`, {
    method: 'PATCH',
    headers,
    body,
  });
}

function moderationAudits(reviewId) {
  return db.adminAuditLog.findMany({
    where: { targetType: 'REVIEW', targetId: BigInt(reviewId) },
    orderBy: { id: 'asc' },
    select: {
      actorUserId: true,
      action: true,
      metadata: true,
      createdAt: true,
    },
  });
}

test('Admin hides and restores a review, preserving content and auditing only changes', async () => {
  const variant = await createVariant('moderation');
  const item = await seedOrderItem('moderation', variant, customerA);
  const review = await expectStatus(await postReview(item.id), 201);
  const id = BigInt(review.id);
  const before = await db.review.findUniqueOrThrow({ where: { id } });
  const path = `/products/${variant.productId}/reviews`;
  const publicBefore = await expectStatus(await send(path), 200);
  assert.equal(publicBefore.total, 1);
  assert.deepEqual(publicBefore.items, [review]);
  const expected = {
    ...review,
    orderItemId: String(item.id),
    userId: String(customerA.id),
  };

  const hidden = await expectStatus(
    await patchVisibility(id, { status: 'HIDDEN' }),
    200,
  );
  assert.deepEqual(hidden, { ...expected, status: 'HIDDEN' });
  assert.deepEqual(await db.review.findUniqueOrThrow({ where: { id } }), {
    ...before,
    status: 'HIDDEN',
  });
  assert.deepEqual(await expectStatus(await send(path), 200), {
    items: [],
    page: 1,
    pageSize: 20,
    total: 0,
  });
  assert.deepEqual(
    await expectStatus(await patchVisibility(id, { status: 'HIDDEN' }), 200),
    hidden,
  );
  assert.equal((await moderationAudits(id)).length, 1);
  await expectError(await postReview(item.id), 409, 'REVIEW_ALREADY_EXISTS');

  const restored = await expectStatus(
    await patchVisibility(id, { status: 'VISIBLE' }),
    200,
  );
  assert.deepEqual(restored, { ...expected, status: 'VISIBLE' });
  assert.deepEqual(
    await expectStatus(await patchVisibility(id, { status: 'VISIBLE' }), 200),
    restored,
  );
  assert.deepEqual(
    await db.review.findUniqueOrThrow({ where: { id } }),
    before,
  );
  assert.deepEqual(await expectStatus(await send(path), 200), publicBefore);
  const audits = await moderationAudits(id);
  assert.deepEqual(
    audits.map(({ actorUserId, action, metadata }) => ({
      actorUserId,
      action,
      metadata,
    })),
    [
      {
        actorUserId: adminUserId,
        action: 'MODERATE_REVIEW',
        metadata: { previousStatus: 'VISIBLE', status: 'HIDDEN' },
      },
      {
        actorUserId: adminUserId,
        action: 'MODERATE_REVIEW',
        metadata: { previousStatus: 'HIDDEN', status: 'VISIBLE' },
      },
    ],
  );
  assert(audits.every(({ createdAt }) => createdAt instanceof Date));
});

test('Admin list paginates hidden reviews and moderation enforces session, role and validation', async () => {
  const variant = await createVariant('admin-list');
  const first = await seedOrderItem('admin-list-a', variant, customerA);
  const second = await seedOrderItem('admin-list-b', variant, customerA);
  const earlier = await expectStatus(await postReview(first.id), 201);
  const later = await expectStatus(await postReview(second.id), 201);
  await db.review.updateMany({
    where: { productId: variant.productId },
    data: { status: 'HIDDEN', createdAt: new Date('2030-01-01T00:00:00.000Z') },
  });
  const { 'X-CSRF-Token': csrf, ...readHeaders } = admin;
  const path = '/admin/reviews?status=HIDDEN&pageSize=1';
  const firstResponse = await send(path, { headers: readHeaders });
  assert.equal(firstResponse.headers.get('cache-control'), 'no-store');
  const firstPage = await expectStatus(firstResponse, 200);
  const secondPage = await expectStatus(
    await send(path + '&page=2', { headers: readHeaders }),
    200,
  );
  assert.deepEqual(firstPage.items, [
    {
      ...later,
      createdAt: '2030-01-01T00:00:00.000Z',
      orderItemId: String(second.id),
      userId: String(customerA.id),
      status: 'HIDDEN',
    },
  ]);
  assert.deepEqual(
    secondPage.items.map(({ id }) => id),
    [earlier.id],
  );
  const total = await db.review.count({ where: { status: 'HIDDEN' } });
  assert.deepEqual(
    [
      firstPage.page,
      secondPage.page,
      firstPage.pageSize,
      firstPage.total,
      secondPage.total,
    ],
    [1, 2, 1, total, total],
  );

  await expectError(await send('/admin/reviews'), 401, 'UNAUTHENTICATED');
  await expectError(
    await send('/admin/reviews', { headers: web }),
    403,
    'FORBIDDEN',
  );
  await expectError(
    await send('/admin/reviews?status=hidden', { headers: readHeaders }),
    400,
    'VALIDATION_ERROR',
  );
  await expectError(
    await send('/admin/reviews?pageSize=101', { headers: readHeaders }),
    400,
    'VALIDATION_ERROR',
  );
  await expectError(
    await patchVisibility(later.id, { status: 'VISIBLE' }, {}),
    401,
    'UNAUTHENTICATED',
  );
  await expectError(
    await patchVisibility(later.id, { status: 'VISIBLE' }, web),
    403,
    'FORBIDDEN',
  );
  await expectError(
    await patchVisibility(later.id, { status: 'VISIBLE' }, native),
    403,
    'FORBIDDEN',
  );
  await expectError(
    await patchVisibility(later.id, { status: 'VISIBLE' }, readHeaders),
    403,
    'CSRF_INVALID',
  );
  await expectError(
    await patchVisibility(
      later.id,
      { status: 'VISIBLE' },
      {
        ...readHeaders,
        Origin: 'https://other.example.test',
        'X-CSRF-Token': csrf,
      },
    ),
    403,
    'FORBIDDEN',
  );
  for (const body of [
    {},
    { status: 'DELETED' },
    { status: 'VISIBLE', content: 'Sửa nội dung' },
  ]) {
    await expectError(
      await patchVisibility(later.id, body),
      400,
      'VALIDATION_ERROR',
    );
  }
  for (const id of [missingId, '0', '18446744073709551616']) {
    await expectError(
      await patchVisibility(id, { status: 'HIDDEN' }),
      404,
      'NOT_FOUND',
    );
  }
  assert.equal(
    (await db.review.findUniqueOrThrow({ where: { id: BigInt(later.id) } }))
      .status,
    'HIDDEN',
  );
  assert.deepEqual(await moderationAudits(later.id), []);
});

test('two concurrent Admin requests for the same visibility write one audit', async () => {
  const variant = await createVariant('moderation-race');
  const item = await seedOrderItem('moderation-race', variant, customerA);
  const review = await expectStatus(await postReview(item.id), 201);
  const id = BigInt(review.id);
  await sql.beginTransaction();
  let pending;
  try {
    await sql.query('SELECT id FROM reviews WHERE id = ? FOR UPDATE', [id]);
    pending = Promise.allSettled([
      patchVisibility(id, { status: 'HIDDEN' }),
      patchVisibility(id, { status: 'HIDDEN' }),
    ]);
    await waitForReviewLockWaiters();
  } finally {
    await sql.rollback();
    await pending;
  }
  const bodies = await Promise.all(
    (await pending).map((outcome) => {
      assert.equal(outcome.status, 'fulfilled', outcome.reason?.stack);
      return expectStatus(outcome.value, 200);
    }),
  );
  assert.deepEqual(bodies[0], bodies[1]);
  assert.equal(bodies[0].status, 'HIDDEN');
  assert.equal(
    (await db.review.findUniqueOrThrow({ where: { id } })).status,
    'HIDDEN',
  );
  assert.equal((await moderationAudits(id)).length, 1);
});

test('a failed audit rolls visibility back in MySQL and on the public endpoint', async () => {
  const variant = await createVariant('moderation-rollback');
  const item = await seedOrderItem('moderation-rollback', variant, customerA);
  const review = await expectStatus(await postReview(item.id), 201);
  const id = BigInt(review.id);
  const before = await db.review.findUniqueOrThrow({ where: { id } });
  const path = `/products/${variant.productId}/reviews`;
  await sql.query(`
    CREATE TRIGGER m606_audit_failure BEFORE INSERT ON admin_audit_logs
    FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Fixture moderation audit failure'
  `);
  try {
    await expectError(
      await patchVisibility(id, { status: 'HIDDEN' }),
      500,
      'INTERNAL_ERROR',
    );
    const page = await expectStatus(await send(path), 200);
    assert.deepEqual(page, {
      items: [review],
      page: 1,
      pageSize: 20,
      total: 1,
    });
    assert.deepEqual(
      await db.review.findUniqueOrThrow({ where: { id } }),
      before,
    );
    assert.deepEqual(await moderationAudits(id), []);
  } finally {
    await sql.query('DROP TRIGGER m606_audit_failure');
  }
});
