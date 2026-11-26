require('reflect-metadata');
const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { NestFactory } = require('@nestjs/core');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
const { AppModule } = require('../dist/app.module');
const { configureHttp } = require('../dist/http');
const { PrismaClient } = require('../dist/generated/prisma/client');

let app;
let db;
let endpoint;
let categoryId;
const productIds = {};

before(async () => {
  const url = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(url.protocol, 'mysql:');
  assert.equal(url.hostname, '127.0.0.1');
  assert.match(url.pathname, /^\/fashioncommerce_[a-z0-9_]+_test$/);
  assert(
    url.port && !['3306', '3307'].includes(url.port),
    'Use an isolated test port',
  );

  db = new PrismaClient({
    adapter: new PrismaMariaDb({
      host: url.hostname,
      port: Number(url.port),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.slice(1),
      connectionLimit: 2,
    }),
  });
  assert.equal(
    await db.category.count({ where: { slug: 'm402-category' } }),
    0,
  );

  const active = await db.category.create({
    data: { name: 'Áo thử nghiệm', slug: 'm402-category', status: 'ACTIVE' },
  });
  const inactive = await db.category.create({
    data: { name: 'Danh mục ẩn', slug: 'm402-hidden', status: 'INACTIVE' },
  });
  categoryId = active.id.toString();

  // Tạo dữ liệu có đồng giá và các biến thể khác nhau để kiểm tra lọc trước khi sắp xếp.
  async function createProduct(
    slug,
    name,
    category,
    variants,
    status = 'ACTIVE',
  ) {
    const product = await db.product.create({
      data: {
        categoryId: category.id,
        slug,
        name,
        description: 'Catalog fixture',
        status,
        createdAt: new Date('2026-11-24T08:00:00.000Z'),
        variants: {
          create: variants.map(
            (
              [size, color, price, variantStatus = 'ACTIVE', stockQuantity = 0],
              index,
            ) => ({
              sku: slug + '-' + index,
              size,
              color,
              price,
              stockQuantity,
              status: variantStatus,
            }),
          ),
        },
      },
    });
    productIds[slug] = product.id.toString();
  }

  await createProduct('m402-basic', 'Áo Basic', active, [
    ['S', 'Black', '10.00', 'ACTIVE', 4],
    ['M', 'Black', '30.10'],
    ['M', 'Black', '1.00', 'INACTIVE'],
  ]);
  await createProduct('m402-rib', 'Áo Rib', active, [
    ['M', 'Black', '20.01'],
    ['M', 'Black', '35.00'],
  ]);
  await createProduct('m402-tie', 'Áo Rib Tie', active, [
    ['M', 'Black', '20.01'],
  ]);
  await createProduct('m402-split', 'Áo Split', active, [
    ['M', 'White', '16.00'],
    ['S', 'Black', '12.00'],
  ]);
  await createProduct('m402-no-active', 'Ẩn biến thể', active, [
    ['M', 'Black', '1.00', 'INACTIVE'],
  ]);
  await createProduct(
    'm402-hidden-product',
    'Ẩn sản phẩm',
    active,
    [['M', 'Black', '1.00']],
    'INACTIVE',
  );
  await createProduct('m402-hidden-category', 'Ẩn danh mục', inactive, [
    ['M', 'Black', '1.00'],
  ]);

  app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false,
  });
  configureHttp(app);
  await app.listen(0, '127.0.0.1');
  endpoint = (await app.getUrl()) + '/api/v1/products';
});

after(async () => {
  try {
    await app?.close();
  } finally {
    await db?.$disconnect();
  }
});

// Gọi API public qua HTTP và giải mã response phân trang.
async function readPage(params = {}) {
  const response = await fetch(endpoint + '?' + new URLSearchParams(params));
  assert.equal(response.status, 200);
  return response.json();
}

test('public catalog returns only visible products and active variants with decimal strings', async () => {
  const { items, page, pageSize, total } = await readPage();
  assert.equal(page, 1);
  assert.equal(pageSize, 20);
  assert.equal(total, 4);
  assert.deepEqual(
    items.map(({ id }) => id),
    [
      productIds['m402-split'],
      productIds['m402-tie'],
      productIds['m402-rib'],
      productIds['m402-basic'],
    ],
  );
  assert(items.every((product) => product.status === 'ACTIVE'));
  const basic = items.at(-1);
  assert.deepEqual(
    basic.variants.map(({ price, status }) => [price, status]),
    [
      ['10.00', 'ACTIVE'],
      ['30.10', 'ACTIVE'],
    ],
  );
  assert.deepEqual(basic.images, []);
});

test('filters address one variant and sort uses its product minimum before pagination', async () => {
  const filter = { categoryId, size: 'M', color: 'Black', pageSize: '1' };
  const a = await readPage({ ...filter, sort: 'PRICE_ASC' });
  const b = await readPage({ ...filter, sort: 'PRICE_ASC', page: '2' });
  const c = await readPage({ ...filter, sort: 'PRICE_ASC', page: '3' });
  const empty = await readPage({ ...filter, sort: 'PRICE_ASC', page: '4' });
  assert.deepEqual(
    [a, b, c].map((entry) => entry.items[0].id),
    [productIds['m402-rib'], productIds['m402-tie'], productIds['m402-basic']],
  );
  assert.deepEqual([a.total, b.total, c.total], [3, 3, 3]);
  assert.deepEqual(empty, { items: [], page: 4, pageSize: 1, total: 3 });
  assert.deepEqual(
    c.items[0].variants.map(({ price }) => price),
    ['30.10'],
  );
  const desc = await readPage({
    ...filter,
    pageSize: '20',
    sort: 'PRICE_DESC',
  });
  assert.deepEqual(
    desc.items.map(({ id }) => id),
    [productIds['m402-basic'], productIds['m402-rib'], productIds['m402-tie']],
  );
});

test('search uses product name or slug and combines with category and variant filters', async () => {
  assert.equal((await readPage({ q: 'rib', categoryId, size: 'M' })).total, 2);
  assert.equal(
    (await readPage({ q: 'm402-basic', categoryId })).items[0].slug,
    'm402-basic',
  );
  assert.equal((await readPage({ q: '%_' })).total, 0);
  assert.equal(
    (await readPage({ q: 'm402-split', size: 'M', color: 'Black' })).total,
    0,
  );
});

test('invalid catalog queries return the validation contract', async () => {
  for (const query of [
    'page=0',
    'page=1.5',
    'page=1e2',
    'page=1&page=2',
    'pageSize=101',
    'categoryId=18446744073709551616',
    'sort=UNKNOWN',
    'q=',
    'unknown=true',
  ]) {
    const response = await fetch(endpoint + '?' + query);
    assert.equal(response.status, 400, query);
    const body = await response.json();
    assert.equal(body.code, 'VALIDATION_ERROR', query);
    assert.equal(response.headers.get('x-request-id'), body.requestId);
  }
});

test('public detail exposes active size/color variants with their own prices and stock', async () => {
  const list = await readPage({ q: 'm402-basic', size: 'S' });
  assert.equal(list.items[0].variants.length, 1);
  const id = list.items[0].id;
  const response = await fetch(endpoint + '/' + id);
  assert.equal(response.status, 200);

  const detail = await response.json();
  assert.equal(detail.id, id);
  assert.equal(detail.categoryId, categoryId);
  assert.equal(detail.status, 'ACTIVE');
  assert.deepEqual(detail.images, []);
  assert.deepEqual(
    detail.variants.map(
      ({ sku, size, color, price, stockQuantity, status }) => [
        sku,
        size,
        color,
        price,
        stockQuantity,
        status,
      ],
    ),
    [
      ['m402-basic-0', 'S', 'Black', '10.00', 4, 'ACTIVE'],
      ['m402-basic-1', 'M', 'Black', '30.10', 0, 'ACTIVE'],
    ],
  );
  const [available, soldOut] = detail.variants;
  assert.equal(available.id, list.items[0].variants[0].id);
  assert.notEqual(available.id, soldOut.id);
});

test('hidden, missing and invalid public detail IDs share the 404 contract', async () => {
  for (const id of [
    productIds['m402-hidden-product'],
    productIds['m402-hidden-category'],
    productIds['m402-no-active'],
    '18446744073709551615',
    '18446744073709551616',
    'not-a-number',
    '0',
  ]) {
    const response = await fetch(endpoint + '/' + id);
    assert.equal(response.status, 404, id);
    const body = await response.json();
    assert.equal(body.code, 'NOT_FOUND', id);
    assert.equal(body.message, 'Resource not found.', id);
    assert.ok(body.requestId);
    assert.equal(response.headers.get('x-request-id'), body.requestId);
  }
});
