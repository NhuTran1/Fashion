require('reflect-metadata');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { mkdtemp, readdir, rm } = require('node:fs/promises');
const { createRequire } = require('node:module');
const { tmpdir } = require('node:os');
const { basename, dirname, join, resolve } = require('node:path');
const { after, before, test } = require('node:test');
const { NestFactory } = require('@nestjs/core');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
const { argon2id, hash } = require('argon2');
const { encode: encodeJpeg } = require('jpeg-js');
const { PNG } = require('pngjs');
const { AppModule } = require('../dist/app.module');
const { configureHttp } = require('../dist/http');
const { PrismaClient } = require('../dist/generated/prisma/client');

const origin = 'https://fashioncommerce.example.test';
const password = randomBytes(24).toString('hex');
const rgba = Buffer.from([0x23, 0x45, 0x67, 0xff]);
const png = PNG.sync.write({ width: 1, height: 1, data: rgba });
const jpeg = encodeJpeg({ width: 1, height: 1, data: rgba }, 90).data;
let app;
let db;
let databaseOptions;
let base;
let imageDir;
let admin;
let customer;
let actorId;
let publicProductId;
let hiddenProductId;
let firstImage;
let storedKey;

before(async () => {
  const url = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(url.protocol, 'mysql:');
  assert.equal(url.hostname, '127.0.0.1');
  assert.match(url.pathname, /^\/fashioncommerce_[a-z0-9_]+_test$/);
  assert(
    url.port && !['3306', '3307'].includes(url.port),
    'Use an isolated test port',
  );

  imageDir = await mkdtemp(join(tmpdir(), 'fashioncommerce-m406-images-'));
  process.env.PRODUCT_IMAGE_DIR = imageDir;
  process.env.AUTH_WEB_ORIGIN = origin;
  databaseOptions = {
    host: url.hostname,
    port: Number(url.port),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
  };
  db = new PrismaClient({
    adapter: new PrismaMariaDb({ ...databaseOptions, connectionLimit: 2 }),
  });
  const adminEmail = 'admin-m406@example.test';
  const customerEmail = 'customer-m406@example.test';
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
    data: { name: 'Image fixtures', slug: 'm406-images', status: 'ACTIVE' },
  });
  for (const status of ['ACTIVE', 'INACTIVE']) {
    const product = await db.product.create({
      data: {
        categoryId: category.id,
        name: 'Image test ' + status,
        slug: 'm406-' + status.toLowerCase(),
        description: '',
        status,
        variants: {
          create: {
            sku: 'M406-' + status,
            size: 'M',
            color: 'Black',
            price: '179000.00',
            status: 'ACTIVE',
          },
        },
      },
    });
    if (status === 'ACTIVE') publicProductId = product.id.toString();
    else hiddenProductId = product.id.toString();
  }
  await startApp();
  assert.equal(
    (
      await request('/auth/register', {
        method: 'POST',
        json: { email: customerEmail, password },
      })
    ).status,
    201,
  );
  admin = await login(adminEmail);
  customer = await login(customerEmail);
});

after(async () => {
  try {
    await app?.close();
  } finally {
    try {
      await db?.$disconnect();
    } finally {
      if (imageDir) {
        const target = resolve(imageDir);
        assert.equal(dirname(target), resolve(tmpdir()));
        assert(basename(target).startsWith('fashioncommerce-m406-images-'));
        await rm(target, { recursive: true, force: true });
      }
    }
  }
});

// Khởi tạo lại API để xác minh thư mục ảnh tồn tại qua lần khởi động mới.
async function startApp() {
  app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false,
  });
  configureHttp(app);
  await app.listen(0, '127.0.0.1');
  base = await app.getUrl();
}

// Gửi HTTP tới API tạm và tự đặt content type khi dùng JSON.
function request(path, { method = 'GET', headers = {}, json, form } = {}) {
  const url = path.startsWith('/api/v1/')
    ? base + path
    : base + '/api/v1' + path;
  return fetch(url, {
    method,
    headers: {
      ...(json === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: form ?? (json === undefined ? undefined : JSON.stringify(json)),
  });
}

// Lấy thông tin phiên trong bộ nhớ để kiểm tra đúng quyền qua HTTP.
async function login(email) {
  const response = await request('/auth/web/login', {
    method: 'POST',
    headers: { Origin: origin },
    json: { email, password },
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  const { csrfToken } = await response.json();
  assert(Boolean(cookie && csrfToken));
  const read = { Cookie: cookie, Origin: origin };
  return { read, write: { ...read, 'X-CSRF-Token': csrfToken } };
}

// Gửi multipart thật với tên và MIME theo từng ca kiểm thử.
function upload(
  productId,
  bytes,
  filename,
  mime,
  headers = admin.write,
  field = 'file',
) {
  const form = new FormData();
  form.append(field, new Blob([bytes], { type: mime }), filename);
  return request(imagesPath(productId) + '/upload', {
    method: 'POST',
    headers,
    form,
  });
}

function imagesPath(productId) {
  return '/admin/products/' + productId + '/images';
}

function publicUrl(productId, imageId) {
  return '/api/v1/products/' + productId + '/images/' + imageId + '/file';
}

// Đối chiếu status và lỗi công khai theo contract.
async function expectStatus(response, status, code) {
  assert.equal(response.status, status);
  if (status === 204) return assert.equal(await response.text(), '');
  const result = await response.json();
  if (code) {
    assert.equal(result.code, code);
    assert.ok(result.requestId);
  }
  return result;
}

// Đối chiếu kiểu nội dung và bytes mà API thực sự phục vụ.
async function expectImage(response, mime, bytes) {
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), mime);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
}

test('uploads PNG and JPEG and serves linked catalog URLs after API restart', async () => {
  firstImage = await expectStatus(
    await upload(publicProductId, png, 'demo.png', 'image/png'),
    201,
  );
  const secondImage = await expectStatus(
    await upload(publicProductId, jpeg, 'demo.jpeg', 'image/jpeg'),
    201,
  );
  const metadata = await db.productImage.findUniqueOrThrow({
    where: { id: BigInt(firstImage.id) },
  });
  storedKey = metadata.storageKey;
  assert.match(storedKey, /^[0-9a-f-]{36}\.png$/);
  assert.deepEqual((await readdir(imageDir)).length, 2);
  assert.equal(
    await db.adminAuditLog.count({
      where: {
        actorUserId: actorId,
        targetType: 'PRODUCT_IMAGE',
        action: 'CREATE',
      },
    }),
    2,
  );

  await app.close();
  app = undefined;
  await startApp();

  await expectImage(
    await request(firstImage.url, { headers: admin.read }),
    'image/png',
    png,
  );
  await expectImage(
    await request(publicUrl(publicProductId, secondImage.id)),
    'image/jpeg',
    jpeg,
  );
  const detail = await expectStatus(
    await request('/products/' + publicProductId),
    200,
  );
  const list = await expectStatus(
    await request('/products?q=m406-active'),
    200,
  );
  assert.deepEqual(
    detail.images.map(({ url }) => url),
    [
      publicUrl(publicProductId, firstImage.id),
      publicUrl(publicProductId, secondImage.id),
    ],
  );
  assert.deepEqual(list.items[0].images, detail.images);
  await expectStatus(
    await request(publicUrl(hiddenProductId, firstImage.id)),
    404,
    'NOT_FOUND',
  );
});

test('validates image metadata, safeguards unpublished previews and unpublishes unlinked images', async () => {
  const path = imagesPath(hiddenProductId);
  const linked = await expectStatus(
    await request(path, {
      method: 'POST',
      headers: admin.write,
      json: {
        storageKey: storedKey,
        altText: 'Ảnh trước xuất bản',
        sortOrder: 2,
      },
    }),
    201,
  );
  const updated = await expectStatus(
    await request(path + '/' + linked.id, {
      method: 'PATCH',
      headers: admin.write,
      json: { sortOrder: 1 },
    }),
    200,
  );
  assert.equal(updated.sortOrder, 1);
  const rows = await expectStatus(
    await request(path, { headers: admin.read }),
    200,
  );
  assert.deepEqual(rows, [updated]);
  await expectStatus(
    await request(publicUrl(hiddenProductId, linked.id)),
    404,
    'NOT_FOUND',
  );
  await expectImage(
    await request(updated.url, { headers: admin.read }),
    'image/png',
    png,
  );
  await expectStatus(
    await request(updated.url, { headers: customer.read }),
    403,
    'FORBIDDEN',
  );
  await expectStatus(
    await request(path, {
      method: 'POST',
      headers: admin.write,
      json: { storageKey: '../outside.png' },
    }),
    400,
    'VALIDATION_ERROR',
  );
  await expectStatus(
    await request(path, {
      method: 'POST',
      headers: admin.write,
      json: { storageKey: '00000000-0000-4000-8000-000000000000.png' },
    }),
    409,
    'RESOURCE_CONFLICT',
  );
  await expectStatus(
    await request(path + '/' + linked.id, {
      method: 'DELETE',
      headers: admin.write,
    }),
    204,
  );
  await expectStatus(
    await request(updated.url, { headers: admin.read }),
    404,
    'NOT_FOUND',
  );
  await expectImage(
    await request(publicUrl(publicProductId, firstImage.id)),
    'image/png',
    png,
  );
});

test('rejects wrong MIME, oversized or corrupt images, paths and requests without Admin CSRF', async () => {
  await expectStatus(
    await upload(publicProductId, png, 'demo.png', 'image/png', customer.write),
    403,
    'FORBIDDEN',
  );
  await expectStatus(
    await upload(publicProductId, png, 'demo.png', 'image/png', admin.read),
    403,
    'CSRF_INVALID',
  );
  await expectStatus(
    await upload(publicProductId, png, 'demo.jpg', 'image/jpeg'),
    415,
    'UNSUPPORTED_MEDIA_TYPE',
  );
  await expectStatus(
    await upload(publicProductId, png, 'demo.png', 'image/jpeg'),
    415,
    'UNSUPPORTED_MEDIA_TYPE',
  );
  await expectStatus(
    await upload(
      publicProductId,
      png.subarray(0, 24),
      'broken.png',
      'image/png',
    ),
    400,
    'VALIDATION_ERROR',
  );
  const corrupt = Buffer.from(png);
  corrupt[corrupt.length - 1] ^= 1;
  await expectStatus(
    await upload(publicProductId, corrupt, 'corrupt.png', 'image/png'),
    400,
    'VALIDATION_ERROR',
  );
  await expectStatus(
    await upload(publicProductId, png, '../outside.png', 'image/png'),
    400,
    'VALIDATION_ERROR',
  );
  await expectStatus(
    await upload(
      publicProductId,
      Buffer.alloc(5 * 1024 * 1024 + 1),
      'large.png',
      'image/png',
    ),
    413,
    'PAYLOAD_TOO_LARGE',
  );
  await expectStatus(
    await upload(
      publicProductId,
      png,
      'demo.png',
      'image/png',
      admin.write,
      'wrongField',
    ),
    400,
    'VALIDATION_ERROR',
  );
  assert.equal((await readdir(imageDir)).length, 2);
});

test('removes the new file when inserting audit fails and rolls back metadata', async () => {
  const beforeFiles = (await readdir(imageDir)).sort();
  const beforeRows = await db.productImage.count({
    where: { productId: BigInt(publicProductId) },
  });
  const requireFromAdapter = createRequire(
    require.resolve('@prisma/adapter-mariadb'),
  );
  const { createConnection } = requireFromAdapter('mariadb');
  const ddl = await createConnection(databaseOptions);
  try {
    await ddl.query(
      "CREATE TRIGGER m406_reject_image_audit BEFORE INSERT ON admin_audit_logs FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'M4-06 image audit test failure'",
    );
    try {
      await expectStatus(
        await upload(publicProductId, png, 'rollback.png', 'image/png'),
        500,
        'INTERNAL_ERROR',
      );
      assert.deepEqual((await readdir(imageDir)).sort(), beforeFiles);
      assert.equal(
        await db.productImage.count({
          where: { productId: BigInt(publicProductId) },
        }),
        beforeRows,
      );
    } finally {
      await ddl.query('DROP TRIGGER m406_reject_image_audit');
    }
  } finally {
    await ddl.end();
  }
});
