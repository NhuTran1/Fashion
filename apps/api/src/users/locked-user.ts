import type { Prisma, User } from '../generated/prisma/client';

/** Đọc tài khoản dưới khóa ghi dùng chung cho đăng nhập và quản lý trạng thái. */
export async function lockUser(tx: Prisma.TransactionClient, id: bigint) {
  const [user] = await tx.$queryRaw<
    Pick<User, 'id' | 'email' | 'role' | 'status' | 'passwordHash'>[]
  >`
    SELECT id, email, role, status, password_hash AS passwordHash
    FROM users WHERE id = ${id} FOR UPDATE
  `;
  return user;
}
