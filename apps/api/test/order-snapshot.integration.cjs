require('reflect-metadata');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { createRequire } = require('node:module');
const { after, before, test } = require('node:test');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
const { Prisma, PrismaClient } = require('../dist/generated/prisma/client');
const {
  OrderSnapshotService,
} = require('../dist/orders/order-snapshot.service');

const snapshots = new OrderSnapshotService();
const shippingAddress = {
  name: 'Khách demo',
  phone: '0900000000',
  addressText: '12 Đường demo, Phường 1',
};
let db;
let sql;
let categoryId;

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
  db = new PrismaClient({
    adapter: new PrismaMariaDb({ ...options, connectionLimit: 2 }),
  });
  const requireFromAdapter = createRequire(
    require.resolve('@prisma/adapter-mariadb'),
  );
  sql = await requireFromAdapter('mariadb').createConnection(options);

  const category = await db.category.create({
    data: { slug: 'm504', name: 'Danh mục demo', status: 'ACTIVE' },
  });
  categoryId = category.id;
});

after(async () => {
  await Promise.all([db?.$disconnect(), sql?.end()]);
});

// Tạo dữ liệu riêng cho từng ca trên MySQL, không dùng tài khoản thật.
async function seedCheckout(label) {
  const customer = await db.user.create({
    data: {
      email: `m504-${label}@example.test`,
      passwordHash: 'fixture-no-login',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      addresses: { create: shippingAddress },
    },
    include: { addresses: true },
  });
  const product = await db.product.create({
    data: {
      categoryId,
      name: 'Áo demo',
      slug: `m504-${label}`,
      description: '',
      status: 'ACTIVE',
    },
  });
  const first = await db.productVariant.create({
    data: {
      productId: product.id,
      sku: `M504-${label}-1`,
      size: 'M',
      color: 'Đen',
      price: '0.10',
      stockQuantity: 10,
      status: 'ACTIVE',
    },
  });
  const second = await db.productVariant.create({
    data: {
      productId: product.id,
      sku: `M504-${label}-2`,
      size: 'L',
      color: 'Trắng',
      price: '0.20',
      stockQuantity: 10,
      status: 'ACTIVE',
    },
  });
  const items = [
    { variantId: first.id, quantity: 3 },
    { variantId: second.id, quantity: 1 },
  ];
  const cart = await db.cart.create({
    data: { userId: customer.id, items: { create: items } },
  });
  return {
    address: customer.addresses[0],
    cart,
    product,
    first,
    second,
    input: {
      userId: customer.id,
      addressId: customer.addresses[0].id,
      items,
      idempotencyKey: `m504-${label}`,
      requestFingerprint: createHash('sha256').update(label).digest('hex'),
    },
  };
}

// Dùng cùng transaction client như luồng checkout sẽ truyền cho service.
function createSnapshot(input) {
  return db.$transaction((tx) => snapshots.create(tx, input), {
    isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
  });
}

test('persists the order snapshot independently of later address, catalog and cart edits', async () => {
  const { address, cart, product, first, second, input } =
    await seedCheckout('immutable');
  const order = await createSnapshot({
    ...input,
    items: [...input.items].reverse(),
  });

  assert.equal(order.userId, input.userId);
  assert.equal(order.status, 'PENDING');
  assert.deepEqual(order.addressSnapshot, shippingAddress);
  assert.equal(order.subtotal.toFixed(2), '0.50');
  assert.equal(order.shippingFee.toFixed(2), '0.00');
  assert.equal(order.total.toFixed(2), '0.50');
  assert.equal(order.idempotencyKey, input.idempotencyKey);
  assert.equal(order.requestFingerprint, input.requestFingerprint);
  assert.deepEqual(
    order.items.map(({ id, orderId, unitPrice, lineTotal, ...line }) => ({
      ...line,
      unitPrice: unitPrice.toFixed(2),
      lineTotal: lineTotal.toFixed(2),
    })),
    [
      {
        variantId: first.id,
        skuSnapshot: first.sku,
        nameSnapshot: product.name,
        sizeSnapshot: 'M',
        colorSnapshot: 'Đen',
        quantity: 3,
        unitPrice: '0.10',
        lineTotal: '0.30',
      },
      {
        variantId: second.id,
        skuSnapshot: second.sku,
        nameSnapshot: product.name,
        sizeSnapshot: 'L',
        colorSnapshot: 'Trắng',
        quantity: 1,
        unitPrice: '0.20',
        lineTotal: '0.20',
      },
    ],
  );

  await db.$transaction([
    db.address.update({
      where: { id: address.id },
      data: {
        name: 'Tên mới',
        phone: '0911111111',
        addressText: '34 Đường mới',
      },
    }),
    db.product.update({
      where: { id: product.id },
      data: { name: 'Áo đổi tên' },
    }),
    db.productVariant.update({
      where: { id: first.id },
      data: { sku: 'M504-UPDATED', size: 'XL', color: 'Xanh', price: '90.15' },
    }),
    db.productVariant.update({
      where: { id: second.id },
      data: { price: '14.99' },
    }),
    db.cartItem.update({
      where: { cartId_variantId: { cartId: cart.id, variantId: first.id } },
      data: { quantity: 2 },
    }),
  ]);

  const saved = await db.order.findUniqueOrThrow({
    where: { id: order.id },
    include: { items: { orderBy: { variantId: 'asc' } } },
  });
  assert.deepEqual(saved, order);
});

test('rejects addresses outside the Customer scope and mismatched cart intent', async () => {
  const { input } = await seedCheckout('validation');
  const foreign = await seedCheckout('foreign');
  const lineCount = await db.orderItem.count();

  for (const addressId of [foreign.address.id, foreign.address.id + 999_999n]) {
    await assert.rejects(createSnapshot({ ...input, addressId }), {
      status: 404,
    });
  }
  const [first, second] = input.items;
  for (const items of [
    [],
    [first],
    [first, first],
    [{ ...first, quantity: first.quantity + 1 }, second],
    [first, { ...second, variantId: foreign.first.id }],
  ]) {
    await assert.rejects(createSnapshot({ ...input, items }), {
      code: 'CART_CHANGED',
      status: 409,
    });
  }
  assert.equal(await db.order.count({ where: { userId: input.userId } }), 0);
  assert.equal(await db.orderItem.count(), lineCount);
});

test('rejects a sum above the DECIMAL limit even when both line amounts fit', async () => {
  const { input, first, second } = await seedCheckout('overflow');
  const lineCount = await db.orderItem.count();
  await db.productVariant.update({
    where: { id: first.id },
    data: { price: '3333333333.33' },
  });
  await assert.rejects(createSnapshot(input), { status: 500 });
  assert.equal(await db.order.count({ where: { userId: input.userId } }), 0);
  assert.equal(await db.orderItem.count(), lineCount);

  await db.productVariant.update({
    where: { id: second.id },
    data: { price: '0.00' },
  });
  const order = await createSnapshot(input);
  assert.equal(order.total.toFixed(2), '9999999999.99');
});

test('rolls back the order and all lines when MySQL rejects a line insert', async () => {
  const { input } = await seedCheckout('rollback');
  const lineCount = await db.orderItem.count();
  // Gây lỗi ở dòng thứ hai để kiểm tra hoàn tác cả header và dòng trước đó.
  await sql.query(`
    CREATE TRIGGER m504_reject_second_line BEFORE INSERT ON order_items
    FOR EACH ROW
    BEGIN
      IF NEW.sku_snapshot = 'M504-rollback-2' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Snapshot test write failure';
      END IF;
    END
  `);
  try {
    await assert.rejects(createSnapshot(input), /Snapshot test write failure/i);
    assert.equal(await db.order.count({ where: { userId: input.userId } }), 0);
    assert.equal(await db.orderItem.count(), lineCount);
  } finally {
    await sql.query('DROP TRIGGER m504_reject_second_line');
  }
});

test('MySQL enforces snapshot amounts, quantity, key uniqueness and foreign keys', async () => {
  const { input, first } = await seedCheckout('constraints');
  const order = await createSnapshot(input);
  const [line] = order.items;
  const missingId = 18_446_744_073_709_551_615n;
  await assert.rejects(createSnapshot(input), { code: 'P2002' });
  const differentKey = await createSnapshot({
    ...input,
    idempotencyKey: input.idempotencyKey.toUpperCase(),
  });
  assert.notEqual(differentKey.id, order.id);

  for (const statement of [
    'UPDATE orders SET subtotal = -0.01 WHERE id = ?',
    'UPDATE orders SET shipping_fee = -0.01 WHERE id = ?',
    'UPDATE orders SET total = -0.01 WHERE id = ?',
  ]) {
    await assert.rejects(sql.query(statement, [order.id]), { errno: 3819 });
  }
  for (const statement of [
    'UPDATE order_items SET unit_price = -0.01 WHERE id = ?',
    'UPDATE order_items SET line_total = -0.01 WHERE id = ?',
    'UPDATE order_items SET quantity = 0 WHERE id = ?',
  ]) {
    await assert.rejects(sql.query(statement, [line.id]), { errno: 3819 });
  }
  await assert.rejects(
    sql.query('UPDATE orders SET user_id = ? WHERE id = ?', [
      missingId,
      order.id,
    ]),
    { errno: 1452 },
  );
  for (const statement of [
    'UPDATE order_items SET order_id = ? WHERE id = ?',
    'UPDATE order_items SET variant_id = ? WHERE id = ?',
  ]) {
    await assert.rejects(sql.query(statement, [missingId, line.id]), {
      errno: 1452,
    });
  }
  await assert.rejects(
    sql.query('DELETE FROM orders WHERE id = ?', [order.id]),
    {
      errno: 1451,
    },
  );

  const movement = await db.inventoryMovement.create({
    data: {
      variantId: first.id,
      actorUserId: input.userId,
      delta: -1,
      reason: 'Fixture kiểm tra FK',
    },
  });
  assert.equal(movement.orderId, null);
  await assert.rejects(
    sql.query('UPDATE inventory_movements SET order_id = ? WHERE id = ?', [
      missingId,
      movement.id,
    ]),
    { errno: 1452 },
  );
  const linked = await db.inventoryMovement.update({
    where: { id: movement.id },
    data: { orderId: order.id },
  });
  assert.equal(linked.orderId, order.id);
});
