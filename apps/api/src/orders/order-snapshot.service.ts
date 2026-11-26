import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ApiHttpException } from '../api-http.exception';
import { Prisma } from '../generated/prisma/client';

const MAX_ORDER_AMOUNT = new Prisma.Decimal('9999999999.99');
const DEMO_SHIPPING_FEE = new Prisma.Decimal(0);

export const ORDER_SNAPSHOT_INCLUDE = {
  items: { orderBy: { variantId: 'asc' } },
} satisfies Prisma.OrderInclude;

export interface OrderSnapshotInput {
  userId: bigint;
  addressId: bigint;
  items: ReadonlyArray<{ variantId: bigint; quantity: number }>;
  idempotencyKey: string;
  requestFingerprint: string;
}

interface ValidatedOrderIntent {
  address: { name: string; phone: string; addressText: string };
  items: ReadonlyArray<{ variantId: bigint; quantity: number }>;
}

@Injectable()
export class OrderSnapshotService {
  /** Lưu snapshot từ dữ liệu của Customer trong transaction do checkout truyền vào. */
  async create(tx: Prisma.TransactionClient, input: OrderSnapshotInput) {
    const intent = await this.validateIntent(tx, input);
    return this.persist(tx, input, intent);
  }

  /** Xác minh chủ địa chỉ và đối chiếu giỏ trước khi checkout thay đổi tồn. */
  async validateIntent(
    tx: Prisma.TransactionClient,
    input: OrderSnapshotInput,
  ): Promise<ValidatedOrderIntent> {
    const address = await tx.address.findUnique({
      where: { id: input.addressId, userId: input.userId },
      select: { name: true, phone: true, addressText: true },
    });
    if (!address) throw new NotFoundException();

    const cartItems = await tx.cartItem.findMany({
      where: { cart: { userId: input.userId } },
      orderBy: { variantId: 'asc' },
      select: { variantId: true, quantity: true },
    });
    const requestedQuantities = new Map(
      input.items.map(({ variantId, quantity }) => [variantId, quantity]),
    );
    if (
      cartItems.length === 0 ||
      cartItems.length !== input.items.length ||
      requestedQuantities.size !== input.items.length ||
      cartItems.some(
        ({ variantId, quantity }) =>
          requestedQuantities.get(variantId) !== quantity,
      )
    ) {
      throw new ApiHttpException(409, 'CART_CHANGED', 'The cart has changed.');
    }

    return { address, items: cartItems };
  }

  /** Lấy giá catalog và ghi snapshot từ các dòng giỏ đã được xác minh. */
  async persist(
    tx: Prisma.TransactionClient,
    input: Pick<
      OrderSnapshotInput,
      'userId' | 'idempotencyKey' | 'requestFingerprint'
    >,
    intent: ValidatedOrderIntent,
  ) {
    const variants = await tx.productVariant.findMany({
      where: { id: { in: intent.items.map(({ variantId }) => variantId) } },
      select: {
        id: true,
        sku: true,
        size: true,
        color: true,
        price: true,
        product: { select: { name: true } },
      },
    });
    const variantsById = new Map(
      variants.map((variant) => [variant.id, variant]),
    );

    let subtotal = new Prisma.Decimal(0);
    const items = intent.items.map(({ variantId, quantity }) => {
      const variant = variantsById.get(variantId);
      if (!variant) throw new InternalServerErrorException();
      const lineTotal = variant.price.times(quantity);
      subtotal = subtotal.plus(lineTotal);
      return {
        variantId,
        quantity,
        skuSnapshot: variant.sku,
        nameSnapshot: variant.product.name,
        sizeSnapshot: variant.size,
        colorSnapshot: variant.color,
        unitPrice: variant.price,
        lineTotal,
      };
    });
    const total = subtotal.plus(DEMO_SHIPPING_FEE);
    if (total.gt(MAX_ORDER_AMOUNT)) throw new InternalServerErrorException();

    return tx.order.create({
      data: {
        userId: input.userId,
        status: 'PENDING',
        addressSnapshot: intent.address,
        subtotal,
        shippingFee: DEMO_SHIPPING_FEE,
        total,
        idempotencyKey: input.idempotencyKey,
        requestFingerprint: input.requestFingerprint,
        items: { create: items },
      },
      include: ORDER_SNAPSHOT_INCLUDE,
    });
  }
}
