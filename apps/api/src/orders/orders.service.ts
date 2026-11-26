import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ApiHttpException } from '../api-http.exception';
import { InventoryService } from '../catalog/inventory.service';
import type { CatalogPageQuery } from '../catalog/product-list.query';
import { DatabaseService } from '../database/database.service';
import { retryWriteTransaction } from '../database/transaction-retry';
import { Prisma } from '../generated/prisma/client';
import type { AdvanceTarget } from './order-query.dto';
import { orderResponse } from './order-response';
import { ORDER_SNAPSHOT_INCLUDE } from './order-snapshot.service';

const ORDER_WITH_PAYMENT = {
  ...ORDER_SNAPSHOT_INCLUDE,
  payment: { select: { status: true } },
} satisfies Prisma.OrderInclude;

const SOURCE_STATUS: Record<AdvanceTarget, string> = {
  CONFIRMED: 'PENDING',
  PACKING: 'CONFIRMED',
  SHIPPING: 'PACKING',
};

const ADMIN_CANCELLABLE_STATUSES = ['PENDING', 'CONFIRMED', 'PACKING'];

type CancellationActor =
  | { role: 'CUSTOMER'; userId: bigint }
  | { role: 'ADMIN'; userId: bigint; reason: string };

/** Trả Order theo contract khi đơn có bản ghi thanh toán. */
function savedOrderResponse(
  order: Prisma.OrderGetPayload<{ include: typeof ORDER_WITH_PAYMENT }>,
) {
  if (!order.payment) throw new InternalServerErrorException();
  return orderResponse(order, order.payment.status);
}

/** Báo trạng thái hiện tại của đơn không cho phép thao tác yêu cầu. */
function invalidOrderState() {
  return new ApiHttpException(
    409,
    'INVALID_ORDER_STATE',
    'Invalid order state.',
  );
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly database: DatabaseService,
    private readonly inventory: InventoryService,
  ) {}

  /** Phân trang đơn theo bộ lọc đã được controller xác định từ phiên hoặc query. */
  list(where: Prisma.OrderWhereInput, { page, pageSize }: CatalogPageQuery) {
    return this.database.client.$transaction(
      async (tx) => {
        const total = await tx.order.count({ where });
        const skip = (page - 1) * pageSize;
        if (skip >= total) return { items: [], page, pageSize, total };

        const orders = await tx.order.findMany({
          where,
          include: ORDER_WITH_PAYMENT,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip,
          take: pageSize,
        });
        return { items: orders.map(savedOrderResponse), page, pageSize, total };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  /** Đọc snapshot theo ID và giới hạn chủ sở hữu khi Customer truy cập. */
  detail(where: { id: bigint; userId?: bigint }) {
    return this.database.client.$transaction(
      async (tx) => {
        const order = await tx.order.findUnique({
          where,
          include: ORDER_WITH_PAYMENT,
        });
        if (!order) throw new NotFoundException();
        return savedOrderResponse(order);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  /** Chuyển một bước và ghi audit trong cùng transaction. */
  advance(actorUserId: bigint, id: bigint, status: AdvanceTarget) {
    const previousStatus = SOURCE_STATUS[status];
    return this.database.client.$transaction(
      async (tx) => {
        const { count } = await tx.order.updateMany({
          where: { id, status: previousStatus },
          data: { status },
        });
        const order = await tx.order.findUnique({
          where: { id },
          include: ORDER_WITH_PAYMENT,
        });
        if (!order) throw new NotFoundException();
        if (count !== 1) throw invalidOrderState();
        await tx.adminAuditLog.create({
          data: {
            actorUserId,
            action: 'ADVANCE_ORDER_STATUS',
            targetType: 'ORDER',
            targetId: id,
            metadata: { previousStatus, status },
          },
        });
        return savedOrderResponse(order);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  /** Xác nhận giao và thu COD mô phỏng cùng audit, hỗ trợ gửi lại sau commit. */
  deliver(actorUserId: bigint, id: bigint) {
    return this.database.client.$transaction(
      async (tx) => {
        // Cập nhật có điều kiện trên đơn để phân xử các request giao đồng thời.
        const { count } = await tx.order.updateMany({
          where: { id, status: 'SHIPPING' },
          data: { status: 'DELIVERED' },
        });
        if (count === 1) {
          const payment = await tx.paymentRecord.updateMany({
            where: { orderId: id, method: 'COD', status: 'UNPAID' },
            data: { status: 'PAID' },
          });
          if (payment.count !== 1) throw invalidOrderState();
          await tx.adminAuditLog.create({
            data: {
              actorUserId,
              action: 'CONFIRM_ORDER_DELIVERY',
              targetType: 'ORDER',
              targetId: id,
              metadata: {
                previousStatus: 'SHIPPING',
                status: 'DELIVERED',
                previousPaymentStatus: 'UNPAID',
                paymentStatus: 'PAID',
              },
            },
          });
        }

        const order = await tx.order.findUnique({
          where: { id },
          include: ORDER_WITH_PAYMENT,
        });
        if (!order) throw new NotFoundException();
        if (order.status !== 'DELIVERED' || order.payment?.status !== 'PAID')
          throw invalidOrderState();
        return savedOrderResponse(order);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  /** Hủy đúng một lần, hoàn tồn và ghi biến động/audit trong cùng transaction. */
  cancel(id: bigint, actor: CancellationActor) {
    const isAdmin = actor.role === 'ADMIN';
    const reason = isAdmin ? actor.reason.trim() : 'CANCEL_ORDER';
    if (!reason || Buffer.byteLength(reason, 'utf8') > 65_535)
      throw new BadRequestException();

    const ownership = isAdmin
      ? Prisma.empty
      : Prisma.sql`AND user_id = ${actor.userId}`;
    const allowedStatuses = isAdmin ? ADMIN_CANCELLABLE_STATUSES : ['PENDING'];

    return retryWriteTransaction(() =>
      this.database.client.$transaction(
        async (tx) => {
          // Khóa cùng bản ghi với luồng chuyển sang SHIPPING trước khi đọc trạng thái.
          const [locked] = await tx.$queryRaw<{ id: bigint }[]>`
            SELECT id FROM orders WHERE id = ${id} ${ownership} FOR UPDATE
          `;
          if (!locked) throw new NotFoundException();
          const order = await tx.order.findUniqueOrThrow({
            where: { id },
            include: ORDER_WITH_PAYMENT,
          });
          if (order.status === 'CANCELLED') return savedOrderResponse(order);
          if (
            !allowedStatuses.includes(order.status) ||
            order.payment?.status !== 'UNPAID'
          )
            throw invalidOrderState();
          if (order.items.length === 0)
            throw new InternalServerErrorException();

          const { count } = await tx.order.updateMany({
            where: { id, status: order.status },
            data: { status: 'CANCELLED' },
          });
          if (count !== 1) throw invalidOrderState();
          await this.inventory.restoreForCancellation(
            tx,
            order,
            actor.userId,
            reason,
          );

          if (isAdmin) {
            await tx.adminAuditLog.create({
              data: {
                actorUserId: actor.userId,
                action: 'CANCEL_ORDER',
                targetType: 'ORDER',
                targetId: id,
                metadata: {
                  previousStatus: order.status,
                  status: 'CANCELLED',
                  reason,
                },
              },
            });
          }
          return savedOrderResponse({ ...order, status: 'CANCELLED' });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      ),
    );
  }
}
