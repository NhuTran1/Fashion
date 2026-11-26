import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Prisma } from '../generated/prisma/client';
import type {
  CreateCategoryDto,
  CreateProductDto,
  CreateVariantDto,
  UpdateCategoryDto,
  UpdateProductDto,
  UpdateVariantDto,
} from './admin-catalog.dto';
import {
  catalogCategory,
  catalogProduct,
  catalogVariant,
  IMAGE_ORDER,
} from './catalog-response';
import type { CatalogPageQuery } from './product-list.query';

const MAX_CATALOG_ID = 18_446_744_073_709_551_615n;
const PRODUCT_RELATIONS = {
  variants: { orderBy: { id: 'asc' } },
  images: { orderBy: IMAGE_ORDER },
} satisfies Prisma.ProductInclude;

type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';
type AuditTarget = 'CATEGORY' | 'PRODUCT' | 'VARIANT';

// Chuyển ID đường dẫn trong miền BIGINT UNSIGNED và giữ lỗi 404 chung.
export function adminCatalogId(value: string): bigint {
  if (!/^[1-9][0-9]{0,19}$/.test(value)) throw new NotFoundException();
  const id = BigInt(value);
  if (id > MAX_CATALOG_ID) throw new NotFoundException();
  return id;
}

// Chuẩn hóa FK trong body và kiểm tra giới hạn byte của cột TEXT.
function productFields(
  input: CreateProductDto,
): Prisma.ProductUncheckedCreateInput;
function productFields(
  input: UpdateProductDto,
): Prisma.ProductUncheckedUpdateInput;
function productFields({
  categoryId,
  ...fields
}: UpdateProductDto): Prisma.ProductUncheckedUpdateInput {
  const id = categoryId === undefined ? undefined : BigInt(categoryId);
  if (
    (id !== undefined && id > MAX_CATALOG_ID) ||
    (fields.description !== undefined &&
      Buffer.byteLength(fields.description, 'utf8') > 65_535)
  ) {
    throw new BadRequestException();
  }
  return { ...fields, categoryId: id };
}

@Injectable()
export class AdminCatalogService {
  constructor(private readonly database: DatabaseService) {}

  /** Liệt kê danh mục cho Admin, bao gồm dữ liệu đã ẩn. */
  async listCategories() {
    const rows = await this.database.client.category.findMany({
      orderBy: { id: 'asc' },
    });
    return rows.map(catalogCategory);
  }

  /** Tạo danh mục và ghi audit cho Admin thực hiện. */
  async createCategory(actorId: bigint, data: CreateCategoryDto) {
    const row = await this.write(actorId, 'CREATE', 'CATEGORY', (tx) =>
      tx.category.create({ data }),
    );
    return catalogCategory(row);
  }

  /** Sửa các trường danh mục được gửi trong PATCH. */
  async updateCategory(actorId: bigint, id: bigint, data: UpdateCategoryDto) {
    const row = await this.write(actorId, 'UPDATE', 'CATEGORY', (tx) =>
      tx.category.update({ where: { id }, data }),
    );
    return catalogCategory(row);
  }

  /** Xóa danh mục khi khóa ngoại cho phép. */
  async removeCategory(actorId: bigint, id: bigint): Promise<void> {
    await this.write(actorId, 'DELETE', 'CATEGORY', (tx) =>
      tx.category.delete({ where: { id } }),
    );
  }

  /** Liệt kê sản phẩm và biến thể mọi trạng thái trong cùng snapshot phân trang. */
  listProducts({ page, pageSize }: CatalogPageQuery) {
    return this.database.client.$transaction(
      async (tx) => {
        const total = await tx.product.count();
        const skip = (page - 1) * pageSize;
        if (skip >= total) return { items: [], page, pageSize, total };

        const rows = await tx.product.findMany({
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip,
          take: pageSize,
          include: PRODUCT_RELATIONS,
        });
        return {
          items: rows.map((row) => catalogProduct(row, 'admin')),
          page,
          pageSize,
          total,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  /** Tạo sản phẩm thuộc danh mục do Admin chọn. */
  async createProduct(actorId: bigint, input: CreateProductDto) {
    const data = productFields(input);
    const row = await this.write(actorId, 'CREATE', 'PRODUCT', (tx) =>
      tx.product.create({ data, include: PRODUCT_RELATIONS }),
    );
    return catalogProduct(row, 'admin');
  }

  /** Sửa sản phẩm và ghi audit trong cùng giao dịch. */
  async updateProduct(actorId: bigint, id: bigint, input: UpdateProductDto) {
    const data = productFields(input);
    const row = await this.write(actorId, 'UPDATE', 'PRODUCT', (tx) =>
      tx.product.update({ where: { id }, data, include: PRODUCT_RELATIONS }),
    );
    return catalogProduct(row, 'admin');
  }

  /** Xóa sản phẩm khi không còn bản ghi tham chiếu. */
  async removeProduct(actorId: bigint, id: bigint): Promise<void> {
    await this.write(actorId, 'DELETE', 'PRODUCT', (tx) =>
      tx.product.delete({ where: { id } }),
    );
  }

  /** Trả các biến thể thuộc sản phẩm yêu cầu, gồm cả biến thể đã ẩn. */
  async listVariants(productId: bigint) {
    const product = await this.database.client.product.findUnique({
      where: { id: productId },
      select: { variants: PRODUCT_RELATIONS.variants },
    });
    if (!product) throw new NotFoundException();
    return product.variants.map(catalogVariant);
  }

  /** Tạo SKU mới với tồn mặc định 0 và ràng buộc đúng sản phẩm cha. */
  async createVariant(
    actorId: bigint,
    productId: bigint,
    data: CreateVariantDto,
  ) {
    const row = await this.write(actorId, 'CREATE', 'VARIANT', (tx) =>
      tx.productVariant.create({
        data: { ...data, product: { connect: { id: productId } } },
      }),
    );
    return catalogVariant(row);
  }

  /** Chỉ sửa biến thể khi ID khớp với sản phẩm cha trong URL. */
  async updateVariant(
    actorId: bigint,
    productId: bigint,
    id: bigint,
    data: UpdateVariantDto,
  ) {
    const row = await this.write(actorId, 'UPDATE', 'VARIANT', (tx) =>
      tx.productVariant.update({ where: { id, productId }, data }),
    );
    return catalogVariant(row);
  }

  /** Chỉ xóa biến thể thuộc sản phẩm yêu cầu và còn đủ điều kiện xóa. */
  async removeVariant(
    actorId: bigint,
    productId: bigint,
    id: bigint,
  ): Promise<void> {
    await this.write(actorId, 'DELETE', 'VARIANT', (tx) =>
      tx.productVariant.delete({ where: { id, productId } }),
    );
  }

  /** Ghi audit cùng transaction để lỗi audit hủy cả thay đổi catalog. */
  private async write<T extends { id: bigint }>(
    actorUserId: bigint,
    action: AuditAction,
    targetType: AuditTarget,
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.database.client.$transaction(async (tx) => {
        const row = await operation(tx);
        await tx.adminAuditLog.create({
          data: { actorUserId, action, targetType, targetId: row.id },
        });
        return row;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') throw new NotFoundException();
        if (error.code === 'P2002' || error.code === 'P2003')
          throw new ConflictException();
      }
      throw error;
    }
  }
}
