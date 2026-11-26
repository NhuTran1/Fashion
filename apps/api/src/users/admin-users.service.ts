import { Injectable, NotFoundException } from '@nestjs/common';
import { ApiHttpException } from '../api-http.exception';
import { publicUser } from '../auth/auth.service';
import { DatabaseService } from '../database/database.service';
import { retryWriteTransaction } from '../database/transaction-retry';
import { Prisma } from '../generated/prisma/client';
import type { AccountStatus, AdminUserPageQuery } from './admin-users.dto';
import { lockUser } from './locked-user';

const userFields = { id: true, email: true, role: true, status: true } as const;

@Injectable()
export class AdminUsersService {
  constructor(private readonly database: DatabaseService) {}

  /** Đếm và đọc danh sách Customer trong cùng snapshot MySQL. */
  listCustomers({ page, pageSize, status }: AdminUserPageQuery) {
    return this.database.client.$transaction(
      async (tx) => {
        const where = { role: 'CUSTOMER', status };
        const total = await tx.user.count({ where });
        const skip = (page - 1) * pageSize;
        if (skip >= total) return { items: [], page, pageSize, total };

        const users = await tx.user.findMany({
          where,
          select: userFields,
          orderBy: { id: 'desc' },
          skip,
          take: pageSize,
        });
        return { items: users.map(publicUser), page, pageSize, total };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  /** Đổi trạng thái Customer, thu hồi phiên khi khóa và ghi audit nguyên tử. */
  setStatus(id: bigint, status: AccountStatus, actorUserId: bigint) {
    return retryWriteTransaction(() =>
      this.database.client.$transaction(
        async (tx) => {
          const current = await lockUser(tx, id);
          if (!current) throw new NotFoundException();
          if (current.role !== 'CUSTOMER') {
            throw new ApiHttpException(
              409,
              'ACCOUNT_STATUS_CONFLICT',
              'Only Customer accounts can be managed.',
            );
          }
          if (current.status === status) return publicUser(current);

          const user = await tx.user.update({
            where: { id },
            data: { status },
            select: userFields,
          });
          if (status === 'DISABLED') {
            await tx.session.updateMany({
              where: { userId: id, revokedAt: null },
              data: { revokedAt: new Date() },
            });
          }
          await tx.adminAuditLog.create({
            data: {
              actorUserId,
              action: 'SET_ACCOUNT_STATUS',
              targetType: 'USER',
              targetId: id,
              metadata: { previousStatus: current.status, status },
            },
          });
          return publicUser(user);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      ),
    );
  }
}
