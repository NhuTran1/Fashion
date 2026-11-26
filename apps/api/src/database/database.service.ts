import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client';

// Dùng chung một Prisma Client, chỉ kết nối khi module cần truy cập MySQL.
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private prisma?: PrismaClient;

  get client(): PrismaClient {
    if (this.prisma) return this.prisma;
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (url.protocol !== 'mysql:' || !url.pathname.slice(1)) {
      throw new Error('Set DATABASE_URL to a MySQL database.');
    }

    const adapter = new PrismaMariaDb({
      host: url.hostname === '[::1]' ? '::1' : url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: decodeURIComponent(url.pathname.slice(1)),
      connectionLimit: 5,
    });
    this.prisma = new PrismaClient({ adapter });
    return this.prisma;
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma?.$disconnect();
  }
}
