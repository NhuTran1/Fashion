import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ApiHttpException } from '../api-http.exception';
import { DatabaseService } from '../database/database.service';
import { Prisma, type InventoryMovement } from '../generated/prisma/client';
import {
  MAX_STOCK_QUANTITY,
  type InventoryAdjustmentDto,
} from './inventory.dto';
import type { CatalogPageQuery } from './product-list.query';

interface OrderStockLine {
  variantId: bigint;
  quantity: number;
}

// Chỉ xuất các trường của lịch sử biến động theo OpenAPI.
function movementHistory({
  id,
  variantId,
  delta,
  reason,
  createdAt,
}: InventoryMovement) {
  return {
    id: id.toString(),
    variantId: variantId.toString(),
    delta,
    reason,
    createdAt: createdAt.toISOString(),
  };
}

@Injectable()
export class InventoryService {
  constructor(private readonly database: DatabaseService) {}

  /** Trừ tồn trong transaction checkout theo thứ tự ID của các dòng giỏ đã sắp. */
  async decrementForCheckout(
    tx: Prisma.TransactionClient,
    items: ReadonlyArray<OrderStockLine>,
  ) {
    for (const { variantId, quantity } of items) {
      const count = await tx.$executeRaw`
        UPDATE product_variants v
        JOIN products p ON p.id = v.product_id
        JOIN categories c ON c.id = p.category_id
        SET v.stock_quantity = v.stock_quantity - ${quantity}
        WHERE v.id = ${variantId}
          AND v.stock_quantity >= ${quantity}
          AND v.status = 'ACTIVE' AND p.status = 'ACTIVE' AND c.status = 'ACTIVE'
      `;
      if (count !== 1) {
        throw new ApiHttpException(409, 'OUT_OF_STOCK', 'Insufficient stock.');
      }
    }
  }

  /** Ghi biến động âm gắn với đơn và Customer trong cùng transaction checkout. */
  async recordCheckoutMovements(
    tx: Prisma.TransactionClient,
    order: {
      id: bigint;
      userId: bigint;
      items: ReadonlyArray<OrderStockLine>;
    },
  ) {
    await tx.inventoryMovement.createMany({
      data: order.items.map(({ variantId, quantity }) => ({
        variantId,
        orderId: order.id,
        actorUserId: order.userId,
        delta: -quantity,
        reason: 'CHECKOUT',
      })),
    });
  }

  /** Hoàn tồn theo thứ tự ID biến thể của snapshot, kể cả SKU đã ngừng bán. */
  async restoreForCancellation(
    tx: Prisma.TransactionClient,
    order: { id: bigint; items: ReadonlyArray<OrderStockLine> },
    actorUserId: bigint,
    reason: string,
  ) {
    for (const { variantId, quantity } of order.items) {
      const count = await tx.$executeRaw`
        UPDATE product_variants
        SET stock_quantity = stock_quantity + ${quantity}
        WHERE id = ${variantId}
          AND stock_quantity <= ${MAX_STOCK_QUANTITY - quantity}
      `;
      if (count !== 1) throw new InternalServerErrorException();

      await tx.inventoryMovement.create({
        data: {
          orderId: order.id,
          variantId,
          actorUserId,
          delta: quantity,
          reason,
        },
      });
    }
  }

  /** Điều chỉnh tồn và ghi movement/audit cùng một transaction MySQL. */
  adjust(
    actorUserId: bigint,
    variantId: bigint,
    input: InventoryAdjustmentDto,
  ) {
    const { delta } = input;
    const reason = input.reason.trim();
    if (!reason || Buffer.byteLength(reason, 'utf8') > 65_535)
      throw new BadRequestException();

    return this.database.client.$transaction(async (tx) => {
      // Đặt điều kiện ngay trong UPDATE để các request đồng thời dùng tồn mới nhất.
      const count = await tx.$executeRaw`
        UPDATE product_variants
        SET stock_quantity = stock_quantity + ${delta}
        WHERE id = ${variantId}
          AND stock_quantity + ${delta} BETWEEN 0 AND ${MAX_STOCK_QUANTITY}
      `;
      const variant = await tx.productVariant.findUnique({
        where: { id: variantId },
        select: { stockQuantity: true },
      });
      if (!variant) throw new NotFoundException();
      if (count !== 1) {
        if (delta < 0)
          throw new ApiHttpException(
            409,
            'INSUFFICIENT_STOCK',
            'Insufficient stock.',
          );
        throw new BadRequestException();
      }

      const { stockQuantity } = variant;
      const movement = await tx.inventoryMovement.create({
        data: { actorUserId, variantId, delta, reason },
      });
      await tx.adminAuditLog.create({
        data: {
          actorUserId,
          action: 'ADJUST_INVENTORY',
          targetType: 'VARIANT',
          targetId: variantId,
          metadata: {
            movementId: movement.id.toString(),
            delta,
            reason,
            stockQuantity,
          },
        },
      });
      return { ...movementHistory(movement), stockQuantity };
    });
  }

  /** Đọc lịch sử phân trang mới nhất trước và phá hòa theo ID giảm dần. */
  listAdjustments(variantId: bigint, { page, pageSize }: CatalogPageQuery) {
    return this.database.client.$transaction(
      async (tx) => {
        const variant = await tx.productVariant.findUnique({
          where: { id: variantId },
          select: { id: true },
        });
        if (!variant) throw new NotFoundException();

        const where = { variantId };
        const total = await tx.inventoryMovement.count({ where });
        const skip = (page - 1) * pageSize;
        if (skip >= total) return { items: [], page, pageSize, total };

        const rows = await tx.inventoryMovement.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip,
          take: pageSize,
        });
        return { items: rows.map(movementHistory), page, pageSize, total };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
