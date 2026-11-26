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
const snapshots = new OrderSnapshotService();
const checkout = new CheckoutService(
  database,
  snapshots,
  new InventoryService(database),
);
let db;
let holder;
let observer;

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
});

after(async () => {
  await Promise.all([
    database.onModuleDestroy(),
    holder?.end(),
    observer?.end(),
  ]);
});

// Tạo các SKU riêng và giữ thứ tự ID nhất quán cho ca rollback dòng thứ hai.
async function seedVariants(label, stocks) {
  const category = await db.category.create({
    data: { name: 'Danh mục test', slug: `m505-${label}`, status: 'ACTIVE' },
  });
  const product = await db.product.create({
    data: {
      categoryId: category.id,
      name: 'Áo test',
      slug: `m505-${label}`,
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
          sku: `M505-${label}-${index}`,
          size: 'M',
          color: 'Đen',
          price: '12.34',
          stockQuantity,
          status: 'ACTIVE',
        },
      }),
    );
  }
  return { category, product, variants };
}

// Test gọi service nội bộ với Customer, địa chỉ và giỏ được lưu trên MySQL.
async function seedIntent(label, items) {
  const user = await db.user.create({
    data: {
      email: `m505-${label}@example.test`,
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
    idempotencyKey: `m505-${label}`,
    method: 'COD',
  };
}

async function assertStock(variants, expected) {
  const rows = await db.productVariant.findMany({
    where: { id: { in: variants.map(({ id }) => id) } },
    orderBy: { id: 'asc' },
    select: { stockQuantity: true },
  });
  assert.deepEqual(
    rows.map(({ stockQuantity }) => stockQuantity),
    expected,
  );
}

async function assertNoCheckout(userId) {
  assert.equal(await db.order.count({ where: { userId } }), 0);
  assert.equal(await db.orderItem.count({ where: { order: { userId } } }), 0);
  assert.equal(
    await db.inventoryMovement.count({ where: { actorUserId: userId } }),
    0,
  );
}

// Chờ InnoDB xác nhận các transaction đã thật sự chạm vào hàng đang khóa.
async function waitForStockWaiters(expected, heldVariantId = null) {
  const deadline = performance.now() + 2500;
  while (performance.now() < deadline) {
    const [row] = await observer.query(
      `
      SELECT COUNT(DISTINCT w.REQUESTING_THREAD_ID) AS total
      FROM performance_schema.data_lock_waits w
      JOIN performance_schema.data_locks l
        ON l.ENGINE_LOCK_ID = w.REQUESTING_ENGINE_LOCK_ID
      WHERE l.OBJECT_SCHEMA = DATABASE()
        AND l.OBJECT_NAME IN ('product_variants', 'products', 'categories')
        AND (? IS NULL OR EXISTS (
          SELECT 1 FROM performance_schema.data_locks held
          WHERE held.THREAD_ID = w.REQUESTING_THREAD_ID
            AND held.OBJECT_SCHEMA = DATABASE()
            AND held.OBJECT_NAME = 'product_variants'
            AND held.INDEX_NAME = 'PRIMARY'
            AND held.LOCK_STATUS = 'GRANTED'
            AND held.LOCK_MODE LIKE 'X%'
            AND held.LOCK_DATA = ?
        ))
    `,
      [heldVariantId, heldVariantId],
    );
    if (Number(row.total) >= expected) return;
    await delay(20);
  }
  assert.fail(
    `Expected ${expected} checkout transaction(s) to wait for stock locks`,
  );
}

test('two Customers really contend for stock one and exactly one checkout commits', async () => {
  const { variants } = await seedVariants('race', [1]);
  const [{ id: variantId }] = variants;
  const items = [{ variantId, quantity: 1 }];
  const first = await seedIntent('race-a', items);
  const second = await seedIntent('race-b', items);

  await holder.beginTransaction();
  let checkouts;
  try {
    await holder.query(
      'SELECT id FROM product_variants WHERE id = ? FOR UPDATE',
      [variantId],
    );
    checkouts = Promise.allSettled([
      checkout.createOrder(first),
      checkout.createOrder(second),
    ]);
    await waitForStockWaiters(2);
  } finally {
    await holder.rollback();
    await checkouts;
  }

  const outcomes = await checkouts;
  const winner = outcomes.find(({ status }) => status === 'fulfilled');
  const loser = outcomes.find(({ status }) => status === 'rejected');
  assert.ok(winner && loser);
  assert.equal(loser.reason.status, 409);
  assert.equal(loser.reason.code, 'OUT_OF_STOCK');
  const userIds = [first.userId, second.userId];
  const orders = await db.order.findMany({
    where: { userId: { in: userIds } },
    include: { items: true, inventoryMovements: true },
  });
  assert.equal(orders.length, 1);
  const [order] = orders;
  assert.equal(order.id, winner.value.order.id);
  assert.equal(order.total.toFixed(2), '12.34');
  assert.deepEqual(
    order.items.map(({ variantId, quantity }) => ({ variantId, quantity })),
    items,
  );
  assert.deepEqual(
    order.inventoryMovements.map(
      ({ orderId, actorUserId, variantId, delta }) => ({
        orderId,
        actorUserId,
        variantId,
        delta,
      }),
    ),
    [{ orderId: order.id, actorUserId: order.userId, variantId, delta: -1 }],
  );
  await assertNoCheckout(userIds.find((userId) => userId !== order.userId));
  await assertStock(variants, [0]);
});

test('checkout with multiple SKUs decrements the exact quantities and records each movement', async () => {
  const { variants } = await seedVariants('multiple', [4, 6]);
  const [first, second] = variants;
  const input = await seedIntent('multiple', [
    { variantId: second.id, quantity: 3 },
    { variantId: first.id, quantity: 2 },
  ]);
  const { order } = await checkout.createOrder(input);
  assert.equal(order.total.toFixed(2), '61.70');
  assert.deepEqual(
    order.items.map(({ variantId }) => variantId),
    [first.id, second.id],
  );
  const movements = await db.inventoryMovement.findMany({
    where: { orderId: order.id },
    orderBy: { variantId: 'asc' },
    select: { variantId: true, delta: true, actorUserId: true, reason: true },
  });
  assert.deepEqual(movements, [
    {
      variantId: first.id,
      delta: -2,
      actorUserId: input.userId,
      reason: 'CHECKOUT',
    },
    {
      variantId: second.id,
      delta: -3,
      actorUserId: input.userId,
      reason: 'CHECKOUT',
    },
  ]);
  await assertStock(variants, [2, 3]);
});

test('insufficient second SKU rolls back the first decrement', async () => {
  const { variants } = await seedVariants('insufficient', [4, 0]);
  const input = await seedIntent(
    'insufficient',
    variants.map(({ id: variantId }) => ({ variantId, quantity: 1 })),
  );
  await assert.rejects(checkout.createOrder(input), {
    status: 409,
    code: 'OUT_OF_STOCK',
  });
  await assertStock(variants, [4, 0]);
  await assertNoCheckout(input.userId);
});

test('checkout rejects an inactive variant, product or category with available stock', async () => {
  const { category, product, variants } = await seedVariants('inactive', [4]);
  const [{ id: variantId }] = variants;
  const input = await seedIntent('inactive', [{ variantId, quantity: 1 }]);
  for (const [table, id] of [
    [db.productVariant, variantId],
    [db.product, product.id],
    [db.category, category.id],
  ]) {
    await table.update({ where: { id }, data: { status: 'INACTIVE' } });
    await assert.rejects(checkout.createOrder(input), {
      status: 409,
      code: 'OUT_OF_STOCK',
    });
    await assertStock(variants, [4]);
    await assertNoCheckout(input.userId);
    await table.update({ where: { id }, data: { status: 'ACTIVE' } });
  }
});

test('movement insert failure rolls back the saved order, order lines and stock', async () => {
  const { variants } = await seedVariants('rollback', [4, 3]);
  const input = await seedIntent(
    'rollback',
    variants.map(({ id: variantId }) => ({ variantId, quantity: 1 })),
  );
  await observer.query(`
    CREATE TRIGGER m505_reject_checkout_movement BEFORE INSERT ON inventory_movements
    FOR EACH ROW
    BEGIN
      IF NEW.variant_id = ${variants[1].id} THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Checkout test movement failure';
      END IF;
    END
  `);
  try {
    await assert.rejects(
      checkout.createOrder(input),
      /Checkout test movement failure/i,
    );
    await assertStock(variants, [4, 3]);
    await assertNoCheckout(input.userId);
  } finally {
    await observer.query('DROP TRIGGER m505_reject_checkout_movement');
  }
});

test('retries the whole checkout after InnoDB rolls it back as the deadlock victim', async (t) => {
  const { variants } = await seedVariants('deadlock', [
    4,
    3,
    ...Array(20).fill(4),
  ]);
  const [first, second, ...extra] = variants;
  const input = await seedIntent('deadlock', [
    { variantId: first.id, quantity: 2 },
    { variantId: second.id, quantity: 1 },
  ]);
  const attempts = t.mock.method(snapshots, 'validateIntent');
  await holder.beginTransaction();
  let result;
  try {
    // Dùng từng khóa chính để tăng trọng số mà vẫn chừa SKU đầu tiên cho checkout.
    for (const { id } of [second, ...extra]) {
      await holder.query(
        'UPDATE product_variants SET stock_quantity = stock_quantity + 1 WHERE id = ?',
        [id],
      );
    }
    result = Promise.allSettled([checkout.createOrder(input)]);
    await waitForStockWaiters(1, String(first.id));
    await holder.query(
      'SELECT id FROM product_variants WHERE id = ? FOR UPDATE',
      [first.id],
    );
  } finally {
    await holder.rollback();
    await result;
  }
  const [outcome] = await result;
  assert.equal(
    outcome.status,
    'fulfilled',
    `Attempts: ${attempts.mock.callCount()}. Prisma: ${JSON.stringify({
      code: outcome.reason?.code,
      meta: outcome.reason?.meta,
    })}. ${outcome.reason?.stack ?? ''}`,
  );
  assert.equal(attempts.mock.callCount(), 2);
  assert.equal(await db.order.count({ where: { userId: input.userId } }), 1);
  assert.equal(
    await db.inventoryMovement.count({
      where: { orderId: outcome.value.order.id },
    }),
    2,
  );
  await assertStock(variants, [
    2,
    2,
    ...extra.map(({ stockQuantity }) => stockQuantity),
  ]);
});
