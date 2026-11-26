import { defineConfig } from 'prisma/config';

// Prisma CLI yêu cầu URL của database đích từ môi trường khi chạy migration.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL },
});
