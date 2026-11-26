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
const emails = [
  'a',
  'b',
  'empty',
  'admin',
  'crud',
  'unavailable',
  'overflow',
  'concurrent',
].map((account) => `cart-${account}@example.test`);
const noItems = { items: [], subtotal: '0.00' };
const sessions = new Map();
let app;
let db;
let connection;
let base;
let users;
let carts;
let product;
let variants;

before(async () => {
  const url = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(url.protocol, 'mysql:');
  assert.equal(url.hostname, '127.0.0.1');
  assert.match(url.pathname, /^\/fashioncommerce_[a-z0-9_]+_test$/);
  assert(url.port && !['3306', '3307'].includes(url.port), 'Use a test port');
  process.env.AUTH_WEB_ORIGIN = origin;

  const options = {
    host: url.hostname,
    port: Number(url.port),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
  };
  db = new PrismaClient({
    adapter: new PrismaMariaDb({ ...options, connectionLimit: 2 }),
  });
  const requireFromAdapter = createRequire(
    require.resolve('@prisma/adapter-mariadb'),
  );
  connection = await requireFromAdapter('mariadb').createConnection(options);

  const passwordHash = await hash(password, { type: argon2id });
  users = await Promise.all(
    emails.map((email, index) =>
      db.user.create({
        data: {
          email,
          passwordHash,
          role: index === 3 ? 'ADMIN' : 'CUSTOMER',
          status: 'ACTIVE',
        },
      }),
    ),
  );
  carts = await Promise.all(
    users
      .slice(0, 2)
      .map(({ id: userId }) => db.cart.create({ data: { userId } })),
  );
  const category = await db.category.create({
    data: { name: 'M5-01', slug: 'm501', status: 'ACTIVE' },
  });
  product = await db.product.create({
    data: {
      categoryId: category.id,
      name: 'M5-01 Test',
      slug: 'm501-product',
      description: '',
      status: 'ACTIVE',
    },
  });
  variants = await Promise.all(
    ['0.10', '0.20', '19.99', '9999999999.99'].map((price, index) =>
      db.productVariant.create({
        data: {
          productId: product.id,
          sku: `M501-${index}`,
          size: 'M',
          color: 'Black',
          price,
          stockQuantity: 5,
          status: 'ACTIVE',
        },
      }),
    ),
  );
  await db.cartItem.createMany({
    data: [
      { cartId: carts[0].id, variantId: variants[0].id, quantity: 3 },
      { cartId: carts[0].id, variantId: variants[1].id, quantity: 1 },
      { cartId: carts[1].id, variantId: variants[2].id, quantity: 2 },
    ],
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
  await Promise.all([app?.close(), db?.$disconnect(), connection?.end()]);
});

// Dùng lại phiên HTTP của mỗi tài khoản/kênh để chạy trong giới hạn đăng nhập.
function login(index, channel) {
  const key = `${index}:${channel}`;
  if (!sessions.has(key)) sessions.set(key, createSession(index, channel));
  return sessions.get(key);
}

// Đăng nhập qua API thật và lấy thông tin phiên dùng cho kiểm thử.
async function createSession(index, channel) {
  const web = channel === 'web';
  const response = await fetch(
    base + (web ? '/auth/web/login' : '/auth/login'),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(web ? { Origin: origin } : {}),
      },
      body: JSON.stringify({ email: emails[index], password }),
    },
  );
  assert.equal(response.status, 200);
  if (web) {
    const cookie = response.headers.get('set-cookie')?.split(';')[0];
    assert.ok(cookie?.startsWith('__Host-session='));
    const { csrfToken } = await response.json();
    return { read: { Origin: origin, Cookie: cookie }, csrfToken };
  }
  const { token } = await response.json();
  assert.ok(token?.startsWith('native_'));
  return { read: { Authorization: `Bearer ${token}` } };
}

// Kiểm tra response giỏ và header ngăn lưu cache dữ liệu riêng tư.
async function readCart(headers, query = '') {
  const response = await fetch(base + '/cart' + query, { headers });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  return response.json();
}

for (const channel of ['web', 'native']) {
  test(`only the authenticated Customer's cart is returned over ${channel}`, async () => {
    const a = await login(0, channel);
    const b = await login(1, channel);
    const expectedA = {
      items: [
        {
          variantId: String(variants[0].id),
          quantity: 3,
          unitPrice: '0.10',
          lineTotal: '0.30',
        },
        {
          variantId: String(variants[1].id),
          quantity: 1,
          unitPrice: '0.20',
          lineTotal: '0.20',
        },
      ],
      subtotal: '0.50',
    };
    assert.deepEqual(await readCart(a.read), expectedA);
    assert.deepEqual(
      await readCart(a.read, `?cartId=${carts[1].id}&userId=${users[1].id}`),
      expectedA,
    );
    assert.deepEqual(await readCart(b.read), {
      items: [
        {
          variantId: String(variants[2].id),
          quantity: 2,
          unitPrice: '19.99',
          lineTotal: '39.98',
        },
      ],
      subtotal: '39.98',
    });
    const foreignPath = await fetch(base + `/cart/${carts[1].id}`, {
      headers: a.read,
    });
    assert.equal(foreignPath.status, 404);
  });
}

test('missing or unknown credentials are rejected and Admin has no cart access', async () => {
  const admin = await login(3, 'web');
  for (const [status, code, headers] of [
    [401, 'UNAUTHENTICATED', {}],
    [
      401,
      'UNAUTHENTICATED',
      {
        Authorization: `Bearer native_${randomBytes(32).toString('base64url')}`,
      },
    ],
    [403, 'FORBIDDEN', admin.read],
  ]) {
    const response = await fetch(base + '/cart', { headers });
    assert.equal(response.status, status);
    assert.equal((await response.json()).code, code);
  }
});

test('a Customer without a cart gets an empty response without creating a row', async () => {
  const empty = await login(2, 'web');
  assert.deepEqual(await readCart(empty.read), noItems);
  assert.equal(
    await db.cart.findUnique({ where: { userId: users[2].id } }),
    null,
  );
});

test('MySQL enforces cart item constraints and cascade', async () => {
  const insert = (cartId, variantId, quantity) =>
    connection.query(
      'INSERT INTO cart_items (cart_id, variant_id, quantity) VALUES (?, ?, ?)',
      [cartId, variantId, quantity],
    );
  const missing = 18446744073709551615n;
  await assert.rejects(insert(carts[0].id, variants[0].id, 1), { errno: 1062 });
  for (const quantity of [0, -1]) {
    await assert.rejects(insert(carts[0].id, variants[3].id, quantity), {
      errno: 3819,
    });
  }
  await assert.rejects(insert(missing, variants[0].id, 1), { errno: 1452 });
  await assert.rejects(insert(carts[0].id, missing, 1), { errno: 1452 });

  const cart = await db.cart.create({ data: { userId: users[2].id } });
  try {
    await insert(cart.id, variants[0].id, 1);
    assert.equal(await db.cartItem.count({ where: { cartId: cart.id } }), 1);
  } finally {
    await db.cart.delete({ where: { id: cart.id } });
  }
  assert.equal(await db.cartItem.count({ where: { cartId: cart.id } }), 0);
});

test('deleting a referenced variant returns 409 and leaves the cart intact', async () => {
  const admin = await login(3, 'web');
  const response = await fetch(
    base + `/admin/products/${product.id}/variants/${variants[2].id}`,
    {
      method: 'DELETE',
      headers: { ...admin.read, 'X-CSRF-Token': admin.csrfToken },
    },
  );
  assert.equal(response.status, 409);
  assert.equal(
    await db.cartItem.count({
      where: { cartId: carts[1].id, variantId: variants[2].id },
    }),
    1,
  );
});

test('a subtotal beyond the response schema does not return an out-of-contract price', async () => {
  const empty = await login(2, 'web');
  const cart = await db.cart.create({
    data: {
      userId: users[2].id,
      items: { create: { variantId: variants[3].id, quantity: 2 } },
    },
  });
  try {
    const response = await fetch(base + '/cart', { headers: empty.read });
    assert.equal(response.status, 500);
    assert.equal((await response.json()).code, 'INTERNAL_ERROR');
  } finally {
    await db.cart.delete({ where: { id: cart.id } });
  }
});

// Gửi thao tác ghi với phiên Android hoặc Web và cho phép ghi đè header để kiểm tra CSRF.
function writeCart(session, method, variantId, body, headers = {}) {
  const path = variantId === undefined ? '' : '/' + variantId;
  return fetch(base + '/cart/items' + path, {
    method,
    headers: {
      ...session.read,
      ...(session.csrfToken ? { 'X-CSRF-Token': session.csrfToken } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

async function expectCartError(response, status, code) {
  assert.equal(response.status, status);
  assert.equal((await response.json()).code, code);
}

test('Android adds a SKU, accumulates up to stock, sets quantity and deletes it', async () => {
  const session = await login(4, 'native');
  const { id, stockQuantity } = variants[0];
  const variantId = String(id);

  async function expectQuantity(response, quantity, subtotal) {
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const expected = {
      items: [{ variantId, quantity, unitPrice: '0.10', lineTotal: subtotal }],
      subtotal,
    };
    assert.deepEqual(await response.json(), expected);
    assert.deepEqual(await readCart(session.read), expected);
  }

  const send = (quantity) =>
    writeCart(session, 'POST', undefined, { variantId, quantity });
  assert.equal(
    await db.cart.findUnique({ where: { userId: users[4].id } }),
    null,
  );
  await expectQuantity(await send(2), 2, '0.20');
  await expectQuantity(await send(3), 5, '0.50');
  await expectCartError(await send(1), 409, 'OUT_OF_STOCK');
  await expectCartError(
    await writeCart(session, 'PATCH', variantId, { quantity: 6 }),
    409,
    'OUT_OF_STOCK',
  );
  assert.equal((await readCart(session.read)).items[0].quantity, 5);
  await expectQuantity(
    await writeCart(session, 'PATCH', variantId, { quantity: 1 }),
    1,
    '0.10',
  );

  const deleted = await writeCart(session, 'DELETE', variantId);
  assert.equal(deleted.status, 204);
  assert.equal(await deleted.text(), '');
  assert.deepEqual(await readCart(session.read), noItems);
  await expectCartError(
    await writeCart(session, 'DELETE', variantId),
    404,
    'NOT_FOUND',
  );
  assert.equal(
    (await db.productVariant.findUniqueOrThrow({ where: { id } }))
      .stockQuantity,
    stockQuantity,
  );
});

test('POST and PATCH reject invalid quantities and fields outside their DTOs', async () => {
  const session = await login(0, 'native');
  const variantId = String(variants[0].id);
  const before = await readCart(session.read);
  for (const body of [
    {},
    { quantity: 0 },
    { quantity: -1 },
    { quantity: 1.5 },
    { quantity: '1' },
    { quantity: null },
    { quantity: Number.MAX_SAFE_INTEGER + 1 },
    { quantity: 1, cartId: String(carts[1].id) },
  ]) {
    await expectCartError(
      await writeCart(session, 'POST', undefined, { variantId, ...body }),
      400,
      'VALIDATION_ERROR',
    );
    await expectCartError(
      await writeCart(session, 'PATCH', variantId, body),
      400,
      'VALIDATION_ERROR',
    );
  }
  for (const invalidId of ['0', 'abc', '18446744073709551616']) {
    await expectCartError(
      await writeCart(session, 'POST', undefined, {
        variantId: invalidId,
        quantity: 1,
      }),
      400,
      'VALIDATION_ERROR',
    );
    await expectCartError(
      await writeCart(session, 'PATCH', invalidId, { quantity: 1 }),
      400,
      'VALIDATION_ERROR',
    );
    await expectCartError(
      await writeCart(session, 'DELETE', invalidId),
      404,
      'NOT_FOUND',
    );
  }
  assert.deepEqual(await readCart(session.read), before);
});

test('stock and catalog availability are enforced, and unavailable lines can be removed', async () => {
  const session = await login(5, 'native');
  const { id } = variants[0];
  const variantId = String(id);
  const add = () =>
    writeCart(session, 'POST', undefined, { variantId, quantity: 1 });
  assert.equal((await add()).status, 200);

  for (const [model, recordId, update, restore] of [
    [db.productVariant, id, { stockQuantity: 0 }, { stockQuantity: 5 }],
    [db.productVariant, id, { status: 'INACTIVE' }, { status: 'ACTIVE' }],
    [db.product, product.id, { status: 'INACTIVE' }, { status: 'ACTIVE' }],
    [
      db.category,
      product.categoryId,
      { status: 'INACTIVE' },
      { status: 'ACTIVE' },
    ],
  ]) {
    await model.update({ where: { id: recordId }, data: update });
    try {
      await expectCartError(await add(), 409, 'OUT_OF_STOCK');
      await expectCartError(
        await writeCart(session, 'PATCH', variantId, { quantity: 1 }),
        409,
        'OUT_OF_STOCK',
      );
      assert.equal((await readCart(session.read)).items[0].quantity, 1);
      if (model === db.category) {
        assert.equal(
          (await writeCart(session, 'DELETE', variantId)).status,
          204,
        );
      }
    } finally {
      await model.update({ where: { id: recordId }, data: restore });
    }
  }
  await expectCartError(
    await writeCart(session, 'POST', undefined, {
      variantId: '18446744073709551615',
      quantity: 1,
    }),
    409,
    'OUT_OF_STOCK',
  );
  assert.deepEqual(await readCart(session.read), noItems);
});

test('Web writes enforce Customer ownership, authentication, Origin and CSRF', async () => {
  const a = await login(0, 'web');
  const b = await login(1, 'web');
  const admin = await login(3, 'web');
  const variantId = String(variants[2].id);
  const bBefore = await readCart(b.read);
  const aBefore = await readCart(a.read);

  for (const [method, pathId, body] of [
    ['POST', undefined, { variantId, quantity: 1 }],
    ['PATCH', variantId, { quantity: 1 }],
    ['DELETE', variantId, undefined],
  ]) {
    await expectCartError(
      await writeCart({}, method, pathId, body),
      401,
      'UNAUTHENTICATED',
    );
    await expectCartError(
      await writeCart(admin, method, pathId, body),
      403,
      'FORBIDDEN',
    );
    await expectCartError(
      await writeCart({ read: a.read }, method, pathId, body),
      403,
      'CSRF_INVALID',
    );
    await expectCartError(
      await writeCart(a, method, pathId, body, { 'X-CSRF-Token': b.csrfToken }),
      403,
      'CSRF_INVALID',
    );
    await expectCartError(
      await writeCart(a, method, pathId, body, {
        Origin: 'https://other.example.test',
      }),
      403,
      'FORBIDDEN',
    );
  }

  await expectCartError(
    await writeCart(a, 'PATCH', variantId, { quantity: 1 }),
    404,
    'NOT_FOUND',
  );
  await expectCartError(
    await writeCart(a, 'DELETE', variantId),
    404,
    'NOT_FOUND',
  );
  assert.deepEqual(await readCart(a.read), aBefore);
  const added = await writeCart(a, 'POST', undefined, {
    variantId,
    quantity: 1,
  });
  assert.equal(added.status, 200);
  assert.equal(
    (await added.json()).items.find((item) => item.variantId === variantId)
      .quantity,
    1,
  );
  const patched = await writeCart(a, 'PATCH', variantId, { quantity: 3 });
  assert.equal(patched.status, 200);
  assert.equal(
    (await patched.json()).items.find((item) => item.variantId === variantId)
      .quantity,
    3,
  );
  assert.equal((await writeCart(a, 'DELETE', variantId)).status, 204);
  assert.deepEqual(await readCart(a.read), aBefore);
  assert.deepEqual(await readCart(b.read), bBefore);
});

test('overflowing the Cart response rolls back first cart creation and quantity updates', async () => {
  const session = await login(6, 'native');
  const { id } = variants[3];
  const variantId = String(id);
  const where = { userId: users[6].id };
  const add = (quantity) =>
    writeCart(session, 'POST', undefined, { variantId, quantity });
  await expectCartError(await add(2), 500, 'INTERNAL_ERROR');
  assert.equal(await db.cart.findUnique({ where }), null);
  assert.equal((await add(1)).status, 200);
  const original = await readCart(session.read);
  await expectCartError(await add(1), 500, 'INTERNAL_ERROR');
  await expectCartError(
    await writeCart(session, 'PATCH', variantId, { quantity: 2 }),
    500,
    'INTERNAL_ERROR',
  );
  assert.deepEqual(await readCart(session.read), original);
  assert.equal((await writeCart(session, 'DELETE', variantId)).status, 204);
});

test('two concurrent first adds to one cart yield one successful add at stock one', async () => {
  const session = await login(7, 'native');
  const { id } = variants[0];
  const variantId = String(id);
  const where = { userId: users[7].id };
  assert.equal(await db.cart.findUnique({ where }), null);
  await db.productVariant.update({ where: { id }, data: { stockQuantity: 1 } });
  try {
    const responses = await Promise.all(
      [1, 1].map((quantity) =>
        writeCart(session, 'POST', undefined, { variantId, quantity }),
      ),
    );
    responses.sort((a, b) => a.status - b.status);
    assert.equal(responses[0].status, 200);
    assert.equal((await responses[0].json()).items[0].quantity, 1);
    await expectCartError(responses[1], 409, 'OUT_OF_STOCK');
    const cart = await db.cart.findUniqueOrThrow({
      where,
      include: { items: true },
    });
    assert.equal(cart.items.length, 1);
    assert.equal(cart.items[0].variantId, id);
    assert.equal(cart.items[0].quantity, 1);
    assert.equal(
      (await db.productVariant.findUniqueOrThrow({ where: { id } }))
        .stockQuantity,
      1,
    );
  } finally {
    await db.productVariant.update({
      where: { id },
      data: { stockQuantity: 5 },
    });
  }
});

test('cart writes reject client money fields without changing the cart', async () => {
  const session = await login(0, 'web');
  const variantId = String(variants[0].id);
  const readStoredCart = () =>
    db.cart.findUniqueOrThrow({
      where: { id: carts[0].id },
      include: { items: { orderBy: { id: 'asc' } } },
    });
  const before = await readCart(session.read);
  const storedBefore = await readStoredCart();

  for (const field of ['price', 'unitPrice', 'lineTotal', 'subtotal']) {
    const money = { [field]: '0.01' };
    await expectCartError(
      await writeCart(session, 'POST', undefined, {
        variantId,
        quantity: 1,
        ...money,
      }),
      400,
      'VALIDATION_ERROR',
    );
    assert.deepEqual(await readCart(session.read), before);
    assert.deepEqual(await readStoredCart(), storedBefore);

    await expectCartError(
      await writeCart(session, 'PATCH', variantId, { quantity: 2, ...money }),
      400,
      'VALIDATION_ERROR',
    );
    assert.deepEqual(await readCart(session.read), before);
    assert.deepEqual(await readStoredCart(), storedBefore);
  }
});

test('GET, POST and PATCH recalculate all lines from current catalog prices', async (t) => {
  const session = await login(0, 'native');
  const [first, second] = variants;
  const cartId = carts[0].id;
  const before = await readCart(session.read);
  assert.equal(before.subtotal, '0.50');
  t.after(async () => {
    await db.$transaction([
      ...[first, second].map(({ id, price }) =>
        db.productVariant.update({ where: { id }, data: { price } }),
      ),
      ...before.items.map(({ variantId, quantity }) =>
        db.cartItem.update({
          where: { cartId_variantId: { cartId, variantId: BigInt(variantId) } },
          data: { quantity },
        }),
      ),
    ]);
  });

  // Đối chiếu từng dòng và tổng bằng chuỗi tiền kỳ vọng độc lập với cách tính của API.
  function expectAmounts(cart, expectedLines, subtotal) {
    assert.deepEqual(cart, {
      items: expectedLines.map(([variant, quantity, unitPrice, lineTotal]) => ({
        variantId: String(variant.id),
        quantity,
        unitPrice,
        lineTotal,
      })),
      subtotal,
    });
  }

  await db.productVariant.update({
    where: { id: first.id },
    data: { price: '0.17' },
  });
  expectAmounts(
    await readCart(session.read),
    [
      [first, 3, '0.17', '0.51'],
      [second, 1, '0.20', '0.20'],
    ],
    '0.71',
  );

  await db.productVariant.update({
    where: { id: second.id },
    data: { price: '0.21' },
  });
  const added = await writeCart(session, 'POST', undefined, {
    variantId: String(first.id),
    quantity: 1,
  });
  assert.equal(added.status, 200);
  expectAmounts(
    await added.json(),
    [
      [first, 4, '0.17', '0.68'],
      [second, 1, '0.21', '0.21'],
    ],
    '0.89',
  );

  await db.productVariant.update({
    where: { id: first.id },
    data: { price: '0.19' },
  });
  const patched = await writeCart(session, 'PATCH', String(second.id), {
    quantity: 2,
  });
  assert.equal(patched.status, 200);
  const patchedCart = await patched.json();
  expectAmounts(
    patchedCart,
    [
      [first, 4, '0.19', '0.76'],
      [second, 2, '0.21', '0.42'],
    ],
    '1.18',
  );
  assert.deepEqual(await readCart(session.read), patchedCart);
});
