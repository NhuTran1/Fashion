import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ApiHttpException } from '../api-http.exception';
import { DatabaseService } from '../database/database.service';
import { Prisma } from '../generated/prisma/client';

const MAX_CART_AMOUNT = new Prisma.Decimal('9999999999.99');

/** Tuần tự hóa checkout và ghi giỏ của cùng Customer, kể cả khi giỏ chưa tồn tại. */
export async function lockCartOwner(
  tx: Prisma.TransactionClient,
  userId: bigint,
) {
  await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
}

@Injectable()
export class CartService {
  constructor(private readonly database: DatabaseService) {}

  /** Đọc các dòng giỏ theo chủ sở hữu và tính tiền từ giá biến thể. */
  getCart(userId: bigint) {
    return this.readCart(this.database.client, userId);
  }

  /** Tạo hoặc cộng dồn dòng SKU theo tồn hiện tại. */
  addCartItem(userId: bigint, variantId: bigint, quantity: number) {
    return this.writeQuantity(userId, variantId, quantity, 'add');
  }

  /** Thay số lượng của dòng SKU đã có trong giỏ. */
  setCartItemQuantity(userId: bigint, variantId: bigint, quantity: number) {
    return this.writeQuantity(userId, variantId, quantity, 'set');
  }

  /** Xóa theo giỏ của chủ phiên và giữ lại giỏ khi dòng cuối được xóa. */
  async removeCartItem(userId: bigint, variantId: bigint) {
    await this.database.client.$transaction(async (tx) => {
      const cart = await this.lockOwnerCart(tx, userId);
      if (!cart) throw new NotFoundException();
      const removed = await tx.cartItem.deleteMany({
        where: { cartId: cart.id, variantId },
      });
      if (removed.count !== 1) throw new NotFoundException();
      await tx.cart.update({
        where: { id: cart.id },
        data: { updatedAt: new Date() },
      });
    });
  }

  /** Kiểm tra catalog, ghi số lượng và dựng phản hồi trong cùng transaction. */
  private writeQuantity(
    userId: bigint,
    variantId: bigint,
    quantity: number,
    operation: 'add' | 'set',
  ) {
    return this.database.client.$transaction(
      async (tx) => {
        const cart = await this.lockOwnerCart(tx, userId);
        const item =
          cart &&
          (await tx.cartItem.findUnique({
            where: { cartId_variantId: { cartId: cart.id, variantId } },
            select: { id: true, quantity: true },
          }));
        if (operation === 'set' && !item) throw new NotFoundException();

        // Khóa chia sẻ giữ tồn, giá và trạng thái bán ổn định đến lúc commit.
        const [variant] = await tx.$queryRaw<{ stockQuantity: number }[]>`
        SELECT v.stock_quantity AS stockQuantity
        FROM product_variants v
        JOIN products p ON p.id = v.product_id
        JOIN categories c ON c.id = p.category_id
        WHERE v.id = ${variantId}
          AND v.status = 'ACTIVE' AND p.status = 'ACTIVE' AND c.status = 'ACTIVE'
        FOR SHARE
      `;
        const previousQuantity =
          operation === 'add' ? (item?.quantity ?? 0) : 0;
        if (!variant || quantity > variant.stockQuantity - previousQuantity) {
          throw new ApiHttpException(
            409,
            'OUT_OF_STOCK',
            'Insufficient stock.',
          );
        }

        const nextQuantity = previousQuantity + quantity;
        const { id: cartId } = cart
          ? await tx.cart.update({
              where: { id: cart.id },
              data: { updatedAt: new Date() },
              select: { id: true },
            })
          : await tx.cart.create({ data: { userId }, select: { id: true } });

        if (item) {
          await tx.cartItem.update({
            where: { id: item.id },
            data: { quantity: nextQuantity },
          });
        } else {
          await tx.cartItem.create({
            data: { cartId, variantId, quantity: nextQuantity },
          });
        }

        return this.readCart(tx, userId);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  /** Khóa chủ giỏ trước lần đọc đầu tiên để tuần tự hóa cả lần tạo giỏ. */
  private async lockOwnerCart(tx: Prisma.TransactionClient, userId: bigint) {
    await lockCartOwner(tx, userId);
    return tx.cart.findUnique({ where: { userId }, select: { id: true } });
  }

  /** Tính tổng Decimal và dùng cùng cách dựng giỏ cho GET và thao tác ghi. */
  private async readCart(db: Prisma.TransactionClient, userId: bigint) {
    const rows = await db.cartItem.findMany({
      where: { cart: { userId } },
      orderBy: { id: 'asc' },
      select: {
        variantId: true,
        quantity: true,
        variant: { select: { price: true } },
      },
    });

    let subtotal = new Prisma.Decimal(0);
    const items = rows.map(({ variantId, quantity, variant: { price } }) => {
      const lineTotal = price.times(quantity);
      subtotal = subtotal.plus(lineTotal);
      return {
        variantId: variantId.toString(),
        quantity,
        unitPrice: price.toFixed(2),
        lineTotal: lineTotal.toFixed(2),
      };
    });

    // Mọi giá trị đều không âm, nên tổng vượt miền cũng bao gồm mọi dòng vượt miền.
    if (subtotal.gt(MAX_CART_AMOUNT)) throw new InternalServerErrorException();
    return { items, subtotal: subtotal.toFixed(2) };
  }
}
