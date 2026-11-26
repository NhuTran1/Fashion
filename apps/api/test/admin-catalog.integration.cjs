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
const categoryInput = {
  name: 'Admin Catalog Test',
  slug: 'm404-catalog',
  status: 'ACTIVE',
};
const variantInput = {
  sku: 'M404-SKU-01',
  size: 'M',
  color: 'Đen',
  price: '179000.01',
  status: 'ACTIVE',
};
const missingId = '18446744073709551615';
let app;
let db;
let base;
let admin;
let customer;
let actorId;
let connectionOptions;

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

  connectionOptions = {
    host: url.hostname,
    port: Number(url.port),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
  };
  db = new PrismaClient({
    adapter: new PrismaMariaDb({ ...connectionOptions, connectionLimit: 2 }),
  });
  const passwordHash = await hash(password, { type: argon2id });
  const adminEmail = 'admin-m404@example.test';
  const customerEmail = 'customer-m404@example.test';
  const stored = await db.user.create({
    data: { email: adminEmail, passwordHash, role: 'ADMIN', status: 'ACTIVE' },
  });
  actorId = stored.id;

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

// Gửi request thật qua HTTP, với thông tin phiên và loại nội dung tương ứng.
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

// Đăng nhập qua Web và giữ thông tin phiên trong bộ nhớ kiểm thử.
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

// Mở response thành công hoặc xác minh mã lỗi theo contract.
async function expectStatus(response, status, code) {
  assert.equal(response.status, status);
  if (status === 204) {
    assert.equal(await response.text(), '');
    return;
  }
  const body = await response.json();
  if (code) {
    assert.equal(body.code, code);
    assert.ok(body.requestId);
    assert.equal(response.headers.get('x-request-id'), body.requestId);
  }
  return body;
}

test('same Admin route accepts Admin Web and denies Customer, unauthenticated and invalid CSRF requests', async () => {
  const path = '/admin/categories';
  const auditCount = await db.adminAuditLog.count({
    where: { actorUserId: actorId },
  });
  await expectStatus(await send(path), 401, 'UNAUTHENTICATED');
  await expectStatus(await send(path, { headers: admin.read }), 200);
  await expectStatus(
    await send(path, { headers: customer.read }),
    403,
    'FORBIDDEN',
  );
  await expectStatus(
    await send(path, {
      method: 'POST',
      headers: customer.write,
      body: categoryInput,
    }),
    403,
    'FORBIDDEN',
  );
  await expectStatus(
    await send(path, {
      method: 'POST',
      headers: admin.read,
      body: categoryInput,
    }),
    403,
    'CSRF_INVALID',
  );
  await expectStatus(
    await send(path, {
      method: 'POST',
      headers: { ...admin.write, Origin: 'https://untrusted.example.test' },
      body: categoryInput,
    }),
    403,
    'FORBIDDEN',
  );
  assert.equal(
    await db.category.count({ where: { slug: categoryInput.slug } }),
    0,
  );
  assert.equal(
    await db.adminAuditLog.count({ where: { actorUserId: actorId } }),
    auditCount,
  );
});

test('Admin CRUD preserves parent relationships and audits successful writes only', async () => {
  const write = (path, method, body) =>
    send(path, { method, headers: admin.write, body });
  const category = await expectStatus(
    await write('/admin/categories', 'POST', categoryInput),
    201,
  );
  const categoryPath = '/admin/categories/' + category.id;
  const renamed = await expectStatus(
    await write(categoryPath, 'PATCH', { status: 'INACTIVE' }),
    200,
  );
  assert.deepEqual(renamed, { ...category, status: 'INACTIVE' });
  const categories = await expectStatus(
    await send('/admin/categories', { headers: admin.read }),
    200,
  );
  assert(categories.some(({ id }) => id === category.id));

  const productInput = {
    categoryId: category.id,
    name: 'Admin product',
    slug: 'm404-product',
    description: '',
    status: 'ACTIVE',
  };
  const product = await expectStatus(
    await write('/admin/products', 'POST', productInput),
    201,
  );
  const other = await expectStatus(
    await write('/admin/products', 'POST', {
      ...productInput,
      slug: 'm404-other-product',
    }),
    201,
  );
  const productPath = '/admin/products/' + product.id;
  const otherPath = '/admin/products/' + other.id;
  const editedProduct = await expectStatus(
    await write(productPath, 'PATCH', { description: 'Đã sửa' }),
    200,
  );
  assert.equal(editedProduct.description, 'Đã sửa');
  const page = await expectStatus(
    await send('/admin/products?page=1&pageSize=1', { headers: admin.read }),
    200,
  );
  assert.equal(page.pageSize, 1);
  assert.equal(page.items.length, 1);
  assert.equal(page.total, await db.product.count());

  const variantsPath = productPath + '/variants';
  const variant = await expectStatus(
    await write(variantsPath, 'POST', variantInput),
    201,
  );
  assert.equal(variant.stockQuantity, 0);
  assert.equal(variant.price, '179000.01');
  const variantPath = variantsPath + '/' + variant.id;
  const updated = await expectStatus(
    await write(variantPath, 'PATCH', {
      price: '9999999999.99',
      status: 'INACTIVE',
    }),
    200,
  );
  assert.equal(updated.price, '9999999999.99');
  const variants = await expectStatus(
    await send(variantsPath, { headers: admin.read }),
    200,
  );
  assert.deepEqual(variants, [updated]);

  const beforeErrors = await db.adminAuditLog.count({
    where: { actorUserId: actorId },
  });
  const wrongParent = otherPath + '/variants/' + variant.id;
  await expectStatus(
    await write(wrongParent, 'PATCH', { price: '1.00' }),
    404,
    'NOT_FOUND',
  );
  await expectStatus(await write(wrongParent, 'DELETE'), 404, 'NOT_FOUND');
  await expectStatus(
    await send('/admin/products/' + missingId + '/variants', {
      headers: admin.read,
    }),
    404,
    'NOT_FOUND',
  );
  await expectStatus(
    await write(
      '/admin/products/' + missingId + '/variants',
      'POST',
      variantInput,
    ),
    404,
    'NOT_FOUND',
  );
  await expectStatus(
    await write(otherPath + '/variants', 'POST', variantInput),
    409,
    'RESOURCE_CONFLICT',
  );
  await expectStatus(
    await write('/admin/categories', 'POST', categoryInput),
    409,
    'RESOURCE_CONFLICT',
  );
  await expectStatus(
    await write('/admin/products', 'POST', productInput),
    409,
    'RESOURCE_CONFLICT',
  );
  await expectStatus(
    await write('/admin/products', 'POST', {
      ...productInput,
      categoryId: missingId,
      slug: 'm404-orphan-product',
    }),
    409,
    'RESOURCE_CONFLICT',
  );
  await expectStatus(
    await write(categoryPath, 'DELETE'),
    409,
    'RESOURCE_CONFLICT',
  );
  await expectStatus(
    await write(productPath, 'DELETE'),
    409,
    'RESOURCE_CONFLICT',
  );
  assert.equal(
    await db.adminAuditLog.count({ where: { actorUserId: actorId } }),
    beforeErrors,
  );
  assert.deepEqual(
    await expectStatus(await send(variantsPath, { headers: admin.read }), 200),
    [updated],
  );

  for (const path of [variantPath, productPath, otherPath, categoryPath]) {
    await expectStatus(await write(path, 'DELETE'), 204);
    await expectStatus(await write(path, 'DELETE'), 404, 'NOT_FOUND');
  }
  const audit = await db.adminAuditLog.findMany({
    where: { actorUserId: actorId },
    orderBy: { id: 'asc' },
  });
  assert.deepEqual(
    audit.map(({ action, targetType, targetId }) => [
      action,
      targetType,
      targetId.toString(),
    ]),
    [
      ['CREATE', 'CATEGORY', category.id],
      ['UPDATE', 'CATEGORY', category.id],
      ['CREATE', 'PRODUCT', product.id],
      ['CREATE', 'PRODUCT', other.id],
      ['UPDATE', 'PRODUCT', product.id],
      ['CREATE', 'VARIANT', variant.id],
      ['UPDATE', 'VARIANT', variant.id],
      ['DELETE', 'VARIANT', variant.id],
      ['DELETE', 'PRODUCT', product.id],
      ['DELETE', 'PRODUCT', other.id],
      ['DELETE', 'CATEGORY', category.id],
    ],
  );
});

test('Admin writes reject invalid fields, empty patches and malformed DTOs', async () => {
  const check = async (path, method, body) => {
    await expectStatus(
      await send(path, { method, headers: admin.write, body }),
      400,
      'VALIDATION_ERROR',
    );
  };
  await check('/admin/categories', 'POST', {
    ...categoryInput,
    status: 'PUBLIC',
  });
  await check('/admin/categories/' + missingId, 'PATCH', {});
  await check('/admin/categories/' + missingId, 'PATCH', { name: null });
  await check('/admin/categories', 'POST', {
    ...categoryInput,
    actorUserId: '1',
  });
  await check('/admin/products/' + missingId + '/variants', 'POST', {
    ...variantInput,
    stockQuantity: 1,
  });
  await check('/admin/products/' + missingId + '/variants', 'POST', {
    ...variantInput,
    price: 179000,
  });
  await check('/admin/products/' + missingId + '/variants', 'POST', {
    ...variantInput,
    price: '179000.001',
  });
  await expectStatus(
    await send('/admin/products?pageSize=101', { headers: admin.read }),
    400,
    'VALIDATION_ERROR',
  );
});

test('audit insertion failure rolls back the catalog write', async () => {
  const countBefore = await db.adminAuditLog.count({
    where: { actorUserId: actorId },
  });
  // MySQL chỉ cho CREATE TRIGGER qua giao thức text của driver.
  const requireFromAdapter = createRequire(
    require.resolve('@prisma/adapter-mariadb'),
  );
  const { createConnection } = requireFromAdapter('mariadb');
  const ddl = await createConnection(connectionOptions);
  try {
    await ddl.query(
      "CREATE TRIGGER m404_reject_audit BEFORE INSERT ON admin_audit_logs FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'M4-04 test audit failure'",
    );
    try {
      await expectStatus(
        await send('/admin/categories', {
          method: 'POST',
          headers: admin.write,
          body: { ...categoryInput, slug: 'm404-rollback' },
        }),
        500,
        'INTERNAL_ERROR',
      );
      assert.equal(
        await db.category.count({ where: { slug: 'm404-rollback' } }),
        0,
      );
      assert.equal(
        await db.adminAuditLog.count({ where: { actorUserId: actorId } }),
        countBefore,
      );
    } finally {
      await ddl.query('DROP TRIGGER m404_reject_audit');
    }
  } finally {
    await ddl.end();
  }
});
