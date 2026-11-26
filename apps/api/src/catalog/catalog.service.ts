import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Prisma } from '../generated/prisma/client';
import { catalogProduct, IMAGE_ORDER } from './catalog-response';
import type { ProductListQuery } from './product-list.query';

const MAX_CATALOG_ID = 18_446_744_073_709_551_615n;
const ACTIVE_VARIANT = { status: 'ACTIVE' };
export const PUBLIC_PRODUCT_VISIBILITY = {
  status: 'ACTIVE',
  category: { status: 'ACTIVE' },
  variants: { some: ACTIVE_VARIANT },
} satisfies Prisma.ProductWhereInput;
const SORT_SQL = {
  NEWEST: Prisma.sql`p.created_at DESC, p.id DESC`,
  PRICE_ASC: Prisma.sql`MIN(v.price) ASC, p.id ASC`,
  PRICE_DESC: Prisma.sql`MIN(v.price) DESC, p.id ASC`,
};

@Injectable()
export class CatalogService {
  constructor(private readonly database: DatabaseService) {}

  /** Chỉ trả sản phẩm công khai và các biến thể ACTIVE, gồm cả hết hàng. */
  async getProduct(productId: string) {
    if (!/^[1-9][0-9]{0,19}$/.test(productId)) throw new NotFoundException();

    const id = BigInt(productId);
    if (id > MAX_CATALOG_ID) throw new NotFoundException();

    const product = await this.database.client.product.findFirst({
      where: {
        id,
        ...PUBLIC_PRODUCT_VISIBILITY,
      },
      include: {
        variants: { where: ACTIVE_VARIANT, orderBy: { id: 'asc' } },
        images: { orderBy: IMAGE_ORDER },
      },
    });
    if (!product) throw new NotFoundException();

    return catalogProduct(product);
  }

  /** Lọc và xếp hạng sản phẩm theo biến thể hợp lệ trước khi phân trang. */
  async listProducts({
    page,
    pageSize,
    q,
    categoryId,
    size,
    color,
    sort,
  }: ProductListQuery) {
    const category = categoryId === undefined ? undefined : BigInt(categoryId);
    if (category !== undefined && category > MAX_CATALOG_ID)
      throw new BadRequestException();

    const matches = Prisma.sql`
      FROM products p
      JOIN categories c ON c.id = p.category_id AND c.status = 'ACTIVE'
      JOIN product_variants v ON v.product_id = p.id AND v.status = 'ACTIVE'
      WHERE p.status = 'ACTIVE'
      ${category === undefined ? Prisma.empty : Prisma.sql`AND p.category_id = ${category}`}
      ${q === undefined ? Prisma.empty : Prisma.sql`AND (LOCATE(${q}, p.name) > 0 OR LOCATE(${q}, p.slug) > 0)`}
      ${size === undefined ? Prisma.empty : Prisma.sql`AND v.size = ${size}`}
      ${color === undefined ? Prisma.empty : Prisma.sql`AND v.color = ${color}`}
    `;
    const offset = (page - 1) * pageSize;

    // Cùng snapshot giúp total, thứ tự và dữ liệu của trang nhất quán.
    return this.database.client.$transaction(
      async (tx) => {
        const [{ total: matchingProducts }] = await tx.$queryRaw<
          { total: bigint }[]
        >`
        SELECT COUNT(DISTINCT p.id) AS total ${matches}
      `;
        const total = Number(matchingProducts);
        if (offset >= total) return { items: [], page, pageSize, total };

        const ranked = await tx.$queryRaw<{ id: bigint }[]>`
        SELECT p.id ${matches}
        GROUP BY p.id, p.created_at
        ORDER BY ${SORT_SQL[sort]}
        LIMIT ${pageSize} OFFSET ${offset}
      `;
        const products = await tx.product.findMany({
          where: { id: { in: ranked.map(({ id }) => id) } },
          include: {
            images: { orderBy: IMAGE_ORDER },
            variants: {
              where: { status: 'ACTIVE', size, color },
              orderBy: { id: 'asc' },
            },
          },
        });

        const productsById = new Map(
          products.map((product) => [product.id, product]),
        );
        const items = ranked.map(({ id }) =>
          catalogProduct(productsById.get(id)!),
        );
        return { items, page, pageSize, total };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
