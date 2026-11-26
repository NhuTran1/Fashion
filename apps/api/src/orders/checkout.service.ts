import { createHash } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ApiHttpException } from '../api-http.exception';
import { lockCartOwner } from '../cart/cart.service';
import { InventoryService } from '../catalog/inventory.service';
import { DatabaseService } from '../database/database.service';
import { retryWriteTransaction } from '../database/transaction-retry';
import { Prisma } from '../generated/prisma/client';
import {
  ORDER_SNAPSHOT_INCLUDE,
  OrderSnapshotService,
  type OrderSnapshotInput,
} from './order-snapshot.service';

const ORDER_KEY_INDEX = 'orders_user_id_idempotency_key_key';

export interface CheckoutInput extends Omit<
  OrderSnapshotInput,
  'requestFingerprint'
> {
  method: 'COD';
}

/** Băm ý định mua độc lập với thứ tự dòng hàng trong yêu cầu. */
function fingerprintCheckout({ addressId, method, items }: CheckoutInput) {
  const sortedItems = [...items].sort((first, second) => {
    if (first.variantId < second.variantId) return -1;
    if (first.variantId > second.variantId) return 1;
    return 0;
  });
  const intent = [
    addressId.toString(),
    method,
    sortedItems.map(({ variantId, quantity }) => [
      variantId.toString(),
      quantity,
    ]),
  ];
  return createHash('sha256').update(JSON.stringify(intent)).digest('hex');
}

/** Chỉ phục hồi replay từ lỗi unique của đúng chỉ mục key theo Customer. */
function isOrderKeyConflict(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) {
    return false;
  }
  const adapterError = error.meta?.driverAdapterError as
    { cause?: { constraint?: { index?: unknown } } } | undefined;
  return (
    error.meta?.target === ORDER_KEY_INDEX ||
    adapterError?.cause?.constraint?.index === ORDER_KEY_INDEX
  );
}

@Injectable()
export class CheckoutService {
  constructor(
    private readonly database: DatabaseService,
    private readonly snapshots: OrderSnapshotService,
    private readonly inventory: InventoryService,
  ) {}

  /** Replay đơn đã commit hoặc ghi đơn, tồn và COD trong cùng giao dịch MySQL. */
  async createOrder(request: CheckoutInput) {
    const { idempotencyKey, method } = request;
    if (
      typeof idempotencyKey !== 'string' ||
      idempotencyKey.trim().length === 0 ||
      [...idempotencyKey].length > 128 ||
      method !== 'COD'
    ) {
      throw new BadRequestException();
    }
    const input: OrderSnapshotInput = {
      ...request,
      requestFingerprint: fingerprintCheckout(request),
    };

    try {
      return await retryWriteTransaction(() =>
        this.database.client.$transaction(
          async (tx) => {
            await lockCartOwner(tx, input.userId);
            const replay = await this.findReplay(tx, input);
            if (replay) return replay;

            const intent = await this.snapshots.validateIntent(tx, input);
            // Giành khóa ghi trên biến thể trước khi chèn dòng đơn có FK tới biến thể.
            await this.inventory.decrementForCheckout(tx, intent.items);
            const order = await this.snapshots.persist(tx, input, intent);
            await this.inventory.recordCheckoutMovements(tx, order);
            const payment = await tx.paymentRecord.create({
              data: {
                orderId: order.id,
                method,
                status: 'UNPAID',
                idempotencyKey: input.idempotencyKey,
              },
              select: { status: true },
            });
            return { order, paymentStatus: payment.status, replayed: false };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
        ),
      );
    } catch (error) {
      if (isOrderKeyConflict(error)) {
        // Prisma đã rollback lượt ghi thất bại trước khi đọc lại đơn đã commit.
        const replay = await this.findReplay(this.database.client, input);
        if (replay) return replay;
      }
      throw error;
    }
  }

  /** Kiểm tra fingerprint rồi đọc snapshot và trạng thái COD đã lưu để replay. */
  private async findReplay(
    db: Pick<Prisma.TransactionClient, 'order'>,
    input: OrderSnapshotInput,
  ) {
    const stored = await db.order.findUnique({
      where: {
        userId_idempotencyKey: {
          userId: input.userId,
          idempotencyKey: input.idempotencyKey,
        },
      },
      include: {
        ...ORDER_SNAPSHOT_INCLUDE,
        payment: { select: { status: true } },
      },
    });
    if (!stored) return null;
    const { payment, ...order } = stored;
    if (order.requestFingerprint !== input.requestFingerprint) {
      throw new ApiHttpException(
        409,
        'IDEMPOTENCY_CONFLICT',
        'The idempotency key was already used for a different checkout.',
      );
    }
    if (!payment) throw new InternalServerErrorException();
    return { order, paymentStatus: payment.status, replayed: true };
  }
}
