require('reflect-metadata');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { createRequire } = require('node:module');
const { after, before, test } = require('node:test');
const { NestFactory } = require('@nestjs/core');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
const { argon2id, hash } = require('argon2');
const { AppModule } = require('../dist/app.module');
const { configureHttp } = require('../dist/http');
const { PrismaClient } = require('../dist/generated/prisma/client');

const origin = 'https://fashioncommerce.example.test';
const password = randomBytes(24).toString('hex');
const missingVariantId = '18446744073709551615';
let app;
let db;
let base;
let dbOptions;
let actorId;
let productId;
let admin;
let customer;

before(async () => {
  const url = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(url.protocol, 'mysql:');
  assert.equal(url.hostname, '127.0.0.1');
  assert.match(url.pathname, /^\/fashioncommerce_[a-z0-9_]+_test$/);
  assert(
    url.port && !['3306', '3307'].includes(url.port),
    'Use an isolated test port',
  );
  process.env.AUTH_WEB_ORIGIN = origin;

  dbOptions = {
    host: url.hostname,
    port: Number(url.port),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
  };
  db = new PrismaClient({
    adapter: new PrismaMariaDb({ ...dbOptions, connectionLimit: 2 }),
  });
  const adminEmail = 'admin-m405@example.test';
  const customerEmail = 'customer-m405@example.test';
  const stored = await db.user.create({
    data: {
      email: adminEmail,
      passwordHash: await hash(password, { type: argon2id }),
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });
  actorId = stored.id;
  const category = await db.category.create({
    data: {
      name: 'Inventory fixtures',
      slug: 'm405-inventory',
      status: 'ACTIVE',
    },
  });
  const product = await db.product.create({
    data: {
      categoryId: category.id,
      name: 'Inventory product',
      slug: 'm405-product',
      description: '',
      status: 'ACTIVE',
    },
  });
  productId = product.id;
  app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false,
  });
  configureHttp(app);
  await app.listen(0, '127.0.0.1');
  base = (await app.getUrl()) + '/api/v1';

  assert.equal(
    (
      await send('/auth/register', {
        method: 'POST',
        body: { email: customerEmail, password },
      })
    ).status,
    201,
  );
  admin = await webLogin(adminEmail);
  customer = await webLogin(customerEmail);
});

after(async () => {
  try {
    await app?.close();
  } finally {
    await db?.$disconnect();
  }
});

// Gửi request HTTP với thông tin phiên của ca kiểm thử.
function send(path, { method = 'GET', headers = {}, body } = {}) {
  return fetch(base + path, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

// Đăng nhập Web và giữ cookie/CSRF trong bộ nhớ.
async function webLogin(email) {
  const response = await send('/auth/web/login', {
    method: 'POST',
    headers: { Origin: origin },
    body: { email, password },
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  const { csrfToken } = await response.json();
  assert(Boolean(cookie && csrfToken));
  const read = { Origin: origin, Cookie: cookie };
  return { read, write: { ...read, 'X-CSRF-Token': csrfToken } };
}

// Xác minh status và cấu trúc lỗi chung trả về từ API.
async function expectStatus(response, status, code) {
  assert.equal(response.status, status);
  const body = await response.json();
  if (code) {
    assert.equal(body.code, code);
    assert.ok(body.requestId);
    assert.equal(response.headers.get('x-request-id'), body.requestId);
  }
  return body;
}

// Tạo SKU riêng cho từng ca để cô lập thay đổi tồn.
function makeVariant(suffix, stockQuantity) {
  return db.productVariant.create({
    data: {
      productId,
      sku: 'M405-' + suffix,
      size: 'M',
      color: 'Đen',
      price: '179000.00',
      status: 'ACTIVE',
      stockQuantity,
    },
  });
}

function adjustments(variantId) {
  return '/admin/inventory/' + variantId.toString() + '/adjustments';
}

// Gọi điều chỉnh bằng phiên Admin theo mặc định.
function adjust(variantId, delta, reason, headers = admin.write) {
  return send(adjustments(variantId), {
    method: 'POST',
    headers,
    body: { delta, reason },
  });
}

// Đọc trạng thái tồn và số dòng audit để đối chiếu sau mỗi thao tác.
async function inventoryState(variantId) {
  const variant = await db.productVariant.findUniqueOrThrow({
    where: { id: variantId },
  });
  return {
    stockQuantity: variant.stockQuantity,
    movements: await db.inventoryMovement.count({ where: { variantId } }),
    audits: await db.adminAuditLog.count({
      where: {
        action: 'ADJUST_INVENTORY',
        targetType: 'VARIANT',
        targetId: variantId,
      },
    }),
  };
}

test('Admin records deltas, reasons and exact resulting stock and can page movement history', async () => {
  const variant = await makeVariant('HISTORY', 0);
  const path = adjustments(variant.id);
  const empty = await expectStatus(
    await send(path, { headers: admin.read }),
    200,
  );
  assert.deepEqual(empty, { items: [], page: 1, pageSize: 20, total: 0 });

  const increment = await expectStatus(
    await adjust(variant.id, 5, ' Nhập kho demo '),
    201,
  );
  const decrement = await expectStatus(
    await adjust(variant.id, -2, 'Kiểm kê mẫu'),
    201,
  );
  assert.equal(increment.stockQuantity, 5);
  assert.equal(increment.reason, 'Nhập kho demo');
  assert.equal(decrement.stockQuantity, 3);
  assert.equal(decrement.variantId, variant.id.toString());
  assert.equal(decrement.delta, -2);
  assert.deepEqual(await inventoryState(variant.id), {
    stockQuantity: 3,
    movements: 2,
    audits: 2,
  });

  const rows = await db.inventoryMovement.findMany({
    where: { variantId: variant.id },
    orderBy: { id: 'asc' },
  });
  assert.deepEqual(
    rows.map(({ delta, reason, actorUserId, orderId }) => [
      delta,
      reason,
      actorUserId,
      orderId,
    ]),
    [
      [5, 'Nhập kho demo', actorId, null],
      [-2, 'Kiểm kê mẫu', actorId, null],
    ],
  );
  const audit = await db.adminAuditLog.findFirstOrThrow({
    where: {
      actorUserId: actorId,
      action: 'ADJUST_INVENTORY',
      targetType: 'VARIANT',
      targetId: variant.id,
    },
    orderBy: { id: 'desc' },
  });
  assert.deepEqual(audit.metadata, {
    movementId: decrement.id,
    delta: -2,
    reason: 'Kiểm kê mẫu',
    stockQuantity: 3,
  });
  const newestFirst = await expectStatus(
    await send(path, { headers: admin.read }),
    200,
  );
  assert.deepEqual(
    newestFirst.items.map(({ id }) => id),
    [decrement.id, increment.id],
  );

  // Cố định timestamp để kiểm tra thứ tự ID khi hai biến động cùng thời điểm.
  const tiedAt = new Date('2026-11-24T03:00:00.000Z');
  await db.inventoryMovement.updateMany({
    where: { variantId: variant.id },
    data: { createdAt: tiedAt },
  });
  const { stockQuantity: _firstStock, ...first } = increment;
  const { stockQuantity: _secondStock, ...second } = decrement;
  for (const [page, expected] of [
    [1, second],
    [2, first],
  ]) {
    const actual = await expectStatus(
      await send(path + '?pageSize=1&page=' + page, { headers: admin.read }),
      200,
    );
    assert.deepEqual(actual, {
      items: [{ ...expected, createdAt: tiedAt.toISOString() }],
      page,
      pageSize: 1,
      total: 2,
    });
  }
  await expectStatus(
    await send('/admin/products/' + productId + '/variants/' + variant.id, {
      method: 'DELETE',
      headers: admin.write,
    }),
    409,
    'RESOURCE_CONFLICT',
  );
});

test('two concurrent decrements from one unit commit exactly one movement and audit', async () => {
  const variant = await makeVariant('RACE', 1);
  const responses = await Promise.all([
    adjust(variant.id, -1, 'Điều chỉnh A'),
    adjust(variant.id, -1, 'Điều chỉnh B'),
  ]);
  assert.deepEqual(
    responses.map(({ status }) => status).sort((a, b) => a - b),
    [201, 409],
  );
  const success = await expectStatus(
    responses.find(({ status }) => status === 201),
    201,
  );
  await expectStatus(
    responses.find(({ status }) => status === 409),
    409,
    'INSUFFICIENT_STOCK',
  );
  assert.equal(success.stockQuantity, 0);
  assert.deepEqual(await inventoryState(variant.id), {
    stockQuantity: 0,
    movements: 1,
    audits: 1,
  });
  const movement = await db.inventoryMovement.findFirstOrThrow({
    where: { variantId: variant.id },
  });
  assert.equal(movement.reason, success.reason);
});

test('inventory rejects unauthenticated, Customer, missing CSRF and invalid or unsafe adjustments', async () => {
  const variant = await makeVariant('DENIED', 1);
  const path = adjustments(variant.id);
  await expectStatus(await send(path), 401, 'UNAUTHENTICATED');
  await expectStatus(
    await send(path, { headers: customer.read }),
    403,
    'FORBIDDEN',
  );
  await expectStatus(
    await adjust(variant.id, 1, 'Sai quyền', customer.write),
    403,
    'FORBIDDEN',
  );
  await expectStatus(
    await adjust(variant.id, 1, 'Thiếu CSRF', admin.read),
    403,
    'CSRF_INVALID',
  );
  await expectStatus(
    await send(path + '?pageSize=101', { headers: admin.read }),
    400,
    'VALIDATION_ERROR',
  );
  for (const body of [
    { delta: 0, reason: 'Zero' },
    { delta: 1.5, reason: 'Fraction' },
    { delta: 2147483648, reason: 'Delta overflow' },
    { delta: 1, reason: '  ' },
    { delta: 1, reason: 'ổ'.repeat(23000) },
    {
      delta: 1,
      reason: 'Không cho gửi actor',
      actorUserId: actorId.toString(),
    },
  ]) {
    await expectStatus(
      await send(path, {
        method: 'POST',
        headers: admin.write,
        body,
      }),
      400,
      'VALIDATION_ERROR',
    );
  }
  await expectStatus(
    await adjust(variant.id, 2147483647, 'Tồn vượt INT'),
    400,
    'VALIDATION_ERROR',
  );
  await expectStatus(
    await adjust(variant.id, -2147483648, 'Tồn không đủ'),
    409,
    'INSUFFICIENT_STOCK',
  );
  await expectStatus(
    await adjust(missingVariantId, 1, 'SKU không tồn tại'),
    404,
    'NOT_FOUND',
  );
  await expectStatus(
    await send(adjustments(missingVariantId), { headers: admin.read }),
    404,
    'NOT_FOUND',
  );
  assert.deepEqual(await inventoryState(variant.id), {
    stockQuantity: 1,
    movements: 0,
    audits: 0,
  });
});

test('audit error rolls back both stock and the movement on MySQL', async () => {
  const variant = await makeVariant('ROLLBACK', 2);
  const requireFromAdapter = createRequire(
    require.resolve('@prisma/adapter-mariadb'),
  );
  const { createConnection } = requireFromAdapter('mariadb');
  const ddl = await createConnection(dbOptions);
  try {
    // Trigger chỉ tồn tại trên DB test và khiến bước audit trong transaction thất bại.
    await ddl.query(
      "CREATE TRIGGER m405_reject_audit BEFORE INSERT ON admin_audit_logs FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'M4-05 test audit failure'",
    );
    try {
      await expectStatus(
        await adjust(variant.id, -1, 'Kiểm thử rollback'),
        500,
        'INTERNAL_ERROR',
      );
      assert.deepEqual(await inventoryState(variant.id), {
        stockQuantity: 2,
        movements: 0,
        audits: 0,
      });
    } finally {
      await ddl.query('DROP TRIGGER m405_reject_audit');
    }
  } finally {
    await ddl.end();
  }
});
