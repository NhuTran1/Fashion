require('reflect-metadata');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { after, before, test } = require('node:test');
const { setTimeout: delay } = require('node:timers/promises');
const { InventoryService } = require('../dist/catalog/inventory.service');
const { DatabaseService } = require('../dist/database/database.service');
const { CheckoutService } = require('../dist/orders/checkout.service');
const {
  OrderSnapshotService,
} = require('../dist/orders/order-snapshot.service');

const database = new DatabaseService();
const checkout = new CheckoutService(
  database,
  new OrderSnapshotService(),
  new InventoryService(database),
);
let db;
let holder;
let observer;
let category;

before(async () => {
  const url = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(url.protocol, 'mysql:');
  assert.equal(url.hostname, '127.0.0.1');
  assert.match(url.pathname, /^\/fashioncommerce_[a-z0-9_]+_test$/);
  assert(url.port && !['3306', '3307'].includes(url.port), 'Use a test port');

  const options = {
    host: url.hostname,
    port: Number(url.port),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
  };
  const requireFromAdapter = createRequire(
    require.resolve('@prisma/adapter-mariadb'),
  );
  const { createConnection } = requireFromAdapter('mariadb');
  holder = await createConnection(options);
  observer = await createConnection(options);
  db = database.client;
  category = await db.category.create({
    data: { name: 'Danh mục test', slug: 'm506', status: 'ACTIVE' },
  });
});

after(async () => {
  await Promise.all([
    database.onModuleDestroy(),
    holder?.end(),
    observer?.end(),
  ]);
});

// Mỗi ca dùng mã SKU riêng và tồn do kiểm thử xác định.
async function seedVariants(label, stocks) {
  const product = await db.product.create({
    data: {
      categoryId: category.id,
      name: 'Áo test',
      slug: `m506-${label}`,
      description: '',
      status: 'ACTIVE',
    },
  });
  const variants = [];
  for (const [index, stockQuantity] of stocks.entries()) {
    variants.push(
      await db.productVariant.create({
        data: {
          productId: product.id,
          sku: `M506-${label}-${index}`,
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

// Tạo Customer demo với địa chỉ và dòng giỏ để gọi checkout nội bộ.
async function seedInput(label, variants) {
  const items = variants.map(({ id: variantId }) => ({
    variantId,
    quantity: 1,
  }));
  const user = await db.user.create({
    data: {
      email: `m506-${label}@example.test`,
      passwordHash: 'fixture-no-login',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      addresses: {
        create: {
          name: 'Khách test',
          phone: '0900000000',
          addressText: 'Địa chỉ test',
        },
      },
      cart: { create: { items: { create: items } } },
    },
    include: { addresses: true },
  });
  return {
    userId: user.id,
    addressId: user.addresses[0].id,
    items,
    method: 'COD',
    idempotencyKey: `m506-${label}`,
  };
}

async function assertCheckoutState(
  input,
  variants,
  expectedStocks,
  orderCount,
) {
  const userId = input.userId;
  assert.equal(await db.order.count({ where: { userId } }), orderCount);
  assert.equal(
    await db.orderItem.count({ where: { order: { userId } } }),
    orderCount * input.items.length,
  );
  assert.equal(
    await db.inventoryMovement.count({ where: { actorUserId: userId } }),
    orderCount * input.items.length,
  );
  const rows = await db.productVariant.findMany({
    where: { id: { in: variants.map(({ id }) => id) } },
    orderBy: { id: 'asc' },
    select: { stockQuantity: true },
  });
  assert.deepEqual(
    rows.map(({ stockQuantity }) => stockQuantity),
    expectedStocks,
  );
}

// Xác nhận cả hai checkout đã chạm khóa Customer trên hai kết nối MySQL.
async function waitForDoubleTap() {
  const deadline = performance.now() + 2500;
  while (performance.now() < deadline) {
    const [row] = await observer.query(`
      SELECT COUNT(DISTINCT w.REQUESTING_THREAD_ID) AS total
      FROM performance_schema.data_lock_waits w
      JOIN performance_schema.data_locks l
        ON l.ENGINE_LOCK_ID = w.REQUESTING_ENGINE_LOCK_ID
      WHERE l.OBJECT_SCHEMA = DATABASE() AND l.OBJECT_NAME = 'users'
    `);
    if (Number(row.total) === 2) return;
    await delay(20);
  }
  assert.fail('Expected both checkouts to wait for the Customer lock');
}

test('two concurrent checkouts with the same key commit one order and replay it', async () => {
  const variants = await seedVariants('double', [1]);
  const input = await seedInput('double', variants);
  await holder.beginTransaction();
  let pending;
  try {
    await holder.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [
      input.userId,
    ]);
    pending = Promise.allSettled([
      checkout.createOrder(input),
      checkout.createOrder(input),
    ]);
    await waitForDoubleTap();
  } finally {
    await holder.rollback();
    await pending;
  }

  const outcomes = await pending;
  assert.equal(outcomes[0].status, 'fulfilled', outcomes[0].reason?.stack);
  assert.equal(outcomes[1].status, 'fulfilled', outcomes[1].reason?.stack);
  const [first, second] = outcomes.map(({ value }) => value);
  assert.notEqual(first.replayed, second.replayed);
  assert.deepEqual(first.order, second.order);
  assert.match(first.order.requestFingerprint, /^[0-9a-f]{64}$/);
  await assertCheckoutState(input, variants, [0], 1);
});

test('retry after a lost response replays the snapshot despite reordered items and later edits', async () => {
  const variants = await seedVariants('reordered', [3, 4]);
  const input = await seedInput('reordered', variants);
  const created = await checkout.createOrder(input);
  assert.equal(created.replayed, false);
  await db.productVariant.update({
    where: { id: variants[0].id },
    data: { price: '99.99', status: 'INACTIVE' },
  });
  await db.cartItem.deleteMany({ where: { cart: { userId: input.userId } } });
  await db.address.delete({ where: { id: input.addressId } });

  const replay = await checkout.createOrder({
    ...input,
    items: [...input.items].reverse(),
  });
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.order, created.order);
  assert.equal(replay.order.total.toFixed(2), '24.68');
  await assertCheckoutState(input, variants, [2, 3], 1);
});

test('same key with changed address, SKU or quantity conflicts without touching inventory', async () => {
  const variants = await seedVariants('conflict', [4, 4]);
  const [first, second] = variants;
  const input = await seedInput('conflict', [first]);
  const created = await checkout.createOrder(input);
  const address = await db.address.create({
    data: {
      userId: input.userId,
      name: 'Khách test',
      phone: '0900000000',
      addressText: 'Địa chỉ khác',
    },
  });
  for (const change of [
    { addressId: address.id },
    { items: [{ variantId: second.id, quantity: 1 }] },
    { items: [{ variantId: first.id, quantity: 2 }] },
  ]) {
    await assert.rejects(checkout.createOrder({ ...input, ...change }), {
      status: 409,
      code: 'IDEMPOTENCY_CONFLICT',
    });
  }
  const replay = await checkout.createOrder(input);
  assert.deepEqual(replay.order, created.order);
  await assertCheckoutState(input, variants, [3, 4], 1);
});

test('two Customers can use the same 128-character key independently', async () => {
  const variants = await seedVariants('customer', [2]);
  const first = await seedInput('customer-a', variants);
  const second = await seedInput('customer-b', variants);
  const idempotencyKey = 'K'.repeat(128);
  const firstOrder = await checkout.createOrder({ ...first, idempotencyKey });
  const secondOrder = await checkout.createOrder({ ...second, idempotencyKey });
  assert.equal(firstOrder.replayed, false);
  assert.equal(secondOrder.replayed, false);
  assert.notEqual(firstOrder.order.id, secondOrder.order.id);
  assert.equal(firstOrder.order.userId, first.userId);
  assert.equal(secondOrder.order.userId, second.userId);
  await assertCheckoutState(first, variants, [0], 1);
  await assertCheckoutState(second, variants, [0], 1);
});

test('missing, empty, blank or oversized keys are rejected before writes', async () => {
  const variants = await seedVariants('bad-key', [2]);
  const input = await seedInput('bad-key', variants);
  for (const idempotencyKey of [undefined, '', '   ', 'K'.repeat(129)]) {
    await assert.rejects(checkout.createOrder({ ...input, idempotencyKey }), {
      status: 400,
    });
  }
  await assertCheckoutState(input, variants, [2], 0);
});

test('the same key remains available after the order and stock transaction rolls back', async () => {
  const variants = await seedVariants('rollback', [2]);
  const input = await seedInput('rollback', variants);
  await observer.query(`
    CREATE TRIGGER m506_reject_movement BEFORE INSERT ON inventory_movements
    FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Replay test movement failure'
  `);
  try {
    await assert.rejects(
      checkout.createOrder(input),
      /Replay test movement failure/i,
    );
    await assertCheckoutState(input, variants, [2], 0);
  } finally {
    await observer.query('DROP TRIGGER m506_reject_movement');
  }
  const result = await checkout.createOrder(input);
  assert.equal(result.replayed, false);
  assert.equal(result.order.idempotencyKey, input.idempotencyKey);
  await assertCheckoutState(input, variants, [1], 1);
});

test('actual duplicate order key rolls back before re-reading the committed order', async (t) => {
  const variants = await seedVariants('unique', [4]);
  const input = await seedInput('unique', variants);
  const created = await checkout.createOrder(input);
  const findReplay = checkout.findReplay.bind(checkout);
  let calls = 0;
  // Mô phỏng lần tra đầu bỏ sót đơn để MySQL thực sự kiểm tra UNIQUE khi INSERT.
  t.mock.method(checkout, 'findReplay', (client, request) => {
    calls += 1;
    if (calls === 1) return null;
    assert.equal(client, db);
    return findReplay(client, request);
  });
  const replay = await checkout.createOrder(input);
  assert.equal(calls, 2);
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.order, created.order);
  await assertCheckoutState(input, variants, [3], 1);
});
