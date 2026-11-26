import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { argon2id, hash } from 'argon2';
import { Prisma, PrismaClient } from './generated/prisma/client';

// Phân biệt xung đột vai trò để người vận hành nhận được lỗi cụ thể.
class DemoAdminRoleConflict extends Error {}

// Chỉ cho phép seed trên MySQL cục bộ dành cho dev hoặc test.
function readLocalSeedUrl(): URL {
  let url: URL;
  try {
    url = new URL(process.env.DATABASE_URL ?? '');
  } catch {
    throw new Error(
      'Set DATABASE_URL to the local MySQL dev or test database.',
    );
  }

  if (
    process.env.NODE_ENV === 'production' ||
    url.protocol !== 'mysql:' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    !/^\/fashioncommerce_(?:dev|[a-z0-9_]+_test|test)$/.test(url.pathname)
  ) {
    throw new Error(
      'Seed only runs on a local FashionCommerce dev or test database.',
    );
  }
  return url;
}

function readPassword(key: string): string {
  const password = process.env[key];
  if (!password || password.length < 12) {
    throw new Error(`${key} must contain at least 12 characters.`);
  }
  return password;
}

/** Khởi tạo dữ liệu demo trong một transaction và giữ nguyên các bản ghi hiện có. */
async function seed(): Promise<void> {
  const url = readLocalSeedUrl();
  const passwords = [
    readPassword('SEED_ADMIN_PASSWORD'),
    readPassword('SEED_CUSTOMER_PASSWORD'),
  ];
  if (passwords[0] === passwords[1]) {
    throw new Error('Use different passwords for the two demo accounts.');
  }
  const [adminHash, customerHash] = await Promise.all(
    passwords.map((password) => hash(password, { type: argon2id })),
  );

  const adapter = new PrismaMariaDb({
    host: url.hostname === '[::1]' ? '::1' : url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    connectionLimit: 1,
  });
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.$transaction(async (tx) => {
      const users = [
        {
          email: 'demo-admin@example.test',
          role: 'ADMIN',
          passwordHash: adminHash,
        },
        {
          email: 'demo-customer@example.test',
          role: 'CUSTOMER',
          passwordHash: customerHash,
        },
      ];
      for (const user of users) {
        const stored = await tx.user.upsert({
          where: { email: user.email },
          create: { ...user, status: 'ACTIVE' },
          update: {},
          select: { role: true },
        });
        // Dừng transaction nếu email Admin demo đã thuộc tài khoản khác vai trò.
        if (user.role === 'ADMIN' && stored.role !== 'ADMIN') {
          throw new DemoAdminRoleConflict(
            'Demo admin email belongs to an account without the ADMIN role.',
          );
        }
      }

      const category = await tx.category.upsert({
        where: { slug: 'demo-ao' },
        create: { slug: 'demo-ao', name: 'Áo mẫu', status: 'ACTIVE' },
        update: {},
      });
      const product = await tx.product.upsert({
        where: { slug: 'demo-ao-thun-basic' },
        create: {
          slug: 'demo-ao-thun-basic',
          categoryId: category.id,
          name: 'Áo thun basic',
          description: 'Sản phẩm giả dùng để thử catalog FashionCommerce.',
          status: 'ACTIVE',
        },
        update: {},
      });
      const variants = [
        { sku: 'DEMO-TEE-BLK-M', size: 'M', stockQuantity: 12 },
        { sku: 'DEMO-TEE-BLK-L', size: 'L', stockQuantity: 0 },
      ];
      for (const variant of variants) {
        await tx.productVariant.upsert({
          where: { sku: variant.sku },
          create: {
            ...variant,
            productId: product.id,
            color: 'Đen',
            price: '179000.00',
            status: 'ACTIVE',
          },
          update: {},
        });
      }
    });
  } catch (error) {
    if (error instanceof DemoAdminRoleConflict) throw error;
    const code =
      error instanceof Prisma.PrismaClientKnownRequestError
        ? ` (${error.code})`
        : '';
    throw new Error(
      `Seed transaction failed${code}. Check the connection and migration status.`,
      { cause: error },
    );
  } finally {
    await prisma.$disconnect();
  }
}

seed()
  .then(() => console.log('Synthetic users and catalog are ready.'))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Seed failed.');
    process.exitCode = 1;
  });
