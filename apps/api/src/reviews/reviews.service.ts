import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApiHttpException } from '../api-http.exception';
import { PUBLIC_PRODUCT_VISIBILITY } from '../catalog/catalog.service';
import type { CatalogPageQuery } from '../catalog/product-list.query';
import { DatabaseService } from '../database/database.service';
import { retryWriteTransaction } from '../database/transaction-retry';
import { Prisma, type Review } from '../generated/prisma/client';
import type {
  AdminReviewPageQuery,
  CreateReviewDto,
  ReviewVisibility,
} from './review.dto';

const ORDER_ITEM_REVIEW_INDEX = 'reviews_order_item_id_key';

/** Chỉ trả các trường Review công khai theo contract. */
function publicReview({ id, productId, rating, content, createdAt }: Review) {
  return {
    id: id.toString(),
    productId: productId.toString(),
    rating,
    content,
    createdAt: createdAt.toISOString(),
  };
}

/** Thêm thông tin quản trị vào phản hồi chỉ dành cho Admin. */
function adminReview(review: Review) {
  return {
    ...publicReview(review),
    orderItemId: review.orderItemId.toString(),
    userId: review.userId.toString(),
    status: review.status,
  };
}

/** Nhận diện lỗi UNIQUE của dòng mua từ Prisma và adapter MySQL. */
function isDuplicateReview(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) {
    return false;
  }
  const adapterError = error.meta?.driverAdapterError as
    { cause?: { constraint?: { index?: unknown } } } | undefined;
  return (
    error.meta?.target === ORDER_ITEM_REVIEW_INDEX ||
    adapterError?.cause?.constraint?.index === ORDER_ITEM_REVIEW_INDEX
  );
}

@Injectable()
export class ReviewsService {
  constructor(private readonly database: DatabaseService) {}

  /** Tạo review cho dòng đã giao của Customer và suy ra sản phẩm từ dữ liệu mua. */
  async create(
    userId: bigint,
    orderItemId: bigint,
    { rating, content }: CreateReviewDto,
  ) {
    if (
      content.trim().length === 0 ||
      Buffer.byteLength(content, 'utf8') > 65_535
    ) {
      throw new BadRequestException();
    }

    try {
      const review = await this.database.client.$transaction(
        async (tx) => {
          const item = await tx.orderItem.findUnique({
            where: { id: orderItemId, order: { userId } },
            select: {
              order: { select: { status: true } },
              variant: { select: { productId: true } },
            },
          });
          if (!item) throw new NotFoundException();
          if (item.order.status !== 'DELIVERED') {
            throw new ApiHttpException(
              409,
              'REVIEW_NOT_ELIGIBLE',
              'The order has not been delivered.',
            );
          }

          return tx.review.create({
            data: {
              userId,
              productId: item.variant.productId,
              orderItemId,
              rating,
              content,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      );
      return publicReview(review);
    } catch (error) {
      if (isDuplicateReview(error)) {
        throw new ApiHttpException(
          409,
          'REVIEW_ALREADY_EXISTS',
          'This order item has already been reviewed.',
        );
      }
      throw error;
    }
  }

  /** Trả review hiển thị và tổng cùng bộ lọc trong một snapshot MySQL. */
  listPublic(productId: bigint, query: CatalogPageQuery) {
    return this.database.client.$transaction(
      async (tx) => {
        const product = await tx.product.findUnique({
          where: { id: productId, ...PUBLIC_PRODUCT_VISIBILITY },
          select: { id: true },
        });
        if (!product) throw new NotFoundException();

        return this.readPage(
          tx,
          { productId, status: 'VISIBLE' },
          query,
          publicReview,
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  /** Liệt kê review và tổng theo bộ lọc trạng thái của Admin. */
  listAdmin(query: AdminReviewPageQuery) {
    return this.database.client.$transaction(
      (tx) => this.readPage(tx, { status: query.status }, query, adminReview),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  /** Đổi trạng thái hiển thị và ghi audit trong cùng transaction. */
  moderate(id: bigint, status: ReviewVisibility, actorUserId: bigint) {
    return retryWriteTransaction(() =>
      this.database.client.$transaction(
        async (tx) => {
          // Khóa review trước khi xác định trạng thái nguồn để xử lý PATCH đồng thời.
          const [current] = await tx.$queryRaw<{ status: string }[]>`
            SELECT status FROM reviews WHERE id = ${id} FOR UPDATE
          `;
          if (!current) throw new NotFoundException();
          if (current.status === status) {
            return adminReview(
              await tx.review.findUniqueOrThrow({ where: { id } }),
            );
          }

          const review = await tx.review.update({
            where: { id, status: current.status },
            data: { status },
          });
          await tx.adminAuditLog.create({
            data: {
              actorUserId,
              action: 'MODERATE_REVIEW',
              targetType: 'REVIEW',
              targetId: id,
              metadata: { previousStatus: current.status, status },
            },
          });
          return adminReview(review);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      ),
    );
  }

  /** Đếm và phân trang review trong cùng snapshot và dùng một thứ tự ổn định. */
  private async readPage<T>(
    tx: Prisma.TransactionClient,
    where: Prisma.ReviewWhereInput,
    { page, pageSize }: CatalogPageQuery,
    serialize: (review: Review) => T,
  ) {
    const total = await tx.review.count({ where });
    const skip = (page - 1) * pageSize;
    if (skip >= total) return { items: [], page, pageSize, total };

    const reviews = await tx.review.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take: pageSize,
    });
    return { items: reviews.map(serialize), page, pageSize, total };
  }
}
