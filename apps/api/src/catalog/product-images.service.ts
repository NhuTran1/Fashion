import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Prisma, type ProductImage } from '../generated/prisma/client';
import { catalogImage, IMAGE_ORDER } from './catalog-response';
import { PUBLIC_PRODUCT_VISIBILITY } from './catalog.service';
import { LocalImageStorage } from './image-storage';
import {
  isProductImageKey,
  validateImageContent,
  validateUpload,
  type UploadedProductImage,
} from './product-image-policy';
import type {
  CreateProductImageDto,
  UpdateProductImageDto,
} from './product-images.dto';

@Injectable()
export class ProductImagesService {
  private readonly logger = new Logger(ProductImagesService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly storage: LocalImageStorage,
  ) {}

  /** Chỉ phục vụ file có metadata gắn đúng sản phẩm và đúng phạm vi hiển thị. */
  async readImage(
    productId: bigint,
    imageId: bigint,
    audience: 'public' | 'admin',
  ) {
    const image = await this.database.client.productImage.findFirst({
      where: {
        id: imageId,
        productId,
        product: audience === 'public' ? PUBLIC_PRODUCT_VISIBILITY : undefined,
      },
      select: { storageKey: true },
    });
    if (!image) throw new NotFoundException();
    return this.storage.read(image.storageKey);
  }

  /** Liệt kê metadata ảnh của đúng sản phẩm để Admin xem trước. */
  async listImages(productId: bigint) {
    const product = await this.database.client.product.findUnique({
      where: { id: productId },
      select: { images: { orderBy: IMAGE_ORDER } },
    });
    if (!product) throw new NotFoundException();
    return product.images.map((image) => catalogImage(image, 'admin'));
  }

  /** Kiểm tra file đã có trong kho trước khi gắn metadata vào sản phẩm. */
  async createImage(
    actorId: bigint,
    productId: bigint,
    input: CreateProductImageDto,
  ) {
    await this.requireValidStoredImage(input.storageKey);
    const image = await this.insertImage(actorId, productId, input);
    return catalogImage(image, 'admin');
  }

  /** Lưu file hợp lệ rồi gắn vào sản phẩm cùng bản ghi audit. */
  async uploadImage(
    actorId: bigint,
    productId: bigint,
    file: UploadedProductImage,
  ) {
    const format = validateUpload(file);
    const product = await this.database.client.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException();

    const storageKey = await this.storage.save(file.buffer, format);
    try {
      const image = await this.insertImage(actorId, productId, { storageKey });
      return catalogImage(image, 'admin');
    } catch (error) {
      // Nếu mất kết nối lúc commit, chỉ xóa file khi xác minh DB không tham chiếu.
      try {
        const reference = await this.database.client.productImage.findFirst({
          where: { storageKey },
          select: { id: true },
        });
        if (!reference) await this.storage.remove(storageKey);
      } catch {
        this.logger.error(
          'Unable to confirm cleanup after product image upload.',
        );
      }
      throw error;
    }
  }

  /** Sửa metadata khi ảnh thuộc sản phẩm trong URL. */
  async updateImage(
    actorId: bigint,
    productId: bigint,
    imageId: bigint,
    data: UpdateProductImageDto,
  ) {
    if (Object.values(data).every((value) => value === undefined))
      throw new BadRequestException();
    if (data.storageKey !== undefined) {
      const image = await this.database.client.productImage.findUnique({
        where: { id: imageId, productId },
        select: { id: true },
      });
      if (!image) throw new NotFoundException();
      await this.requireValidStoredImage(data.storageKey);
    }
    const image = await this.write(actorId, 'UPDATE', (tx) =>
      tx.productImage.update({ where: { id: imageId, productId }, data }),
    );
    return catalogImage(image, 'admin');
  }

  /** Gỡ liên kết ảnh và giữ file vì cùng khóa có thể được tham chiếu ở nơi khác. */
  async removeImage(
    actorId: bigint,
    productId: bigint,
    imageId: bigint,
  ): Promise<void> {
    await this.write(actorId, 'DELETE', (tx) =>
      tx.productImage.delete({ where: { id: imageId, productId } }),
    );
  }

  /** Chỉ nhận khóa hợp lệ trỏ đến file JPEG/PNG đã lưu. */
  private async requireValidStoredImage(storageKey: string): Promise<void> {
    if (!isProductImageKey(storageKey)) throw new BadRequestException();
    try {
      const { bytes, format } = await this.storage.read(storageKey);
      validateImageContent(bytes, format);
    } catch (error) {
      if (error instanceof NotFoundException) throw new ConflictException();
      if (error instanceof HttpException) throw new BadRequestException();
      throw error;
    }
  }

  /** Tạo metadata và khóa ngoại tới đúng sản phẩm với audit cùng giao dịch. */
  private insertImage(
    actorId: bigint,
    productId: bigint,
    input: CreateProductImageDto,
  ) {
    return this.write(actorId, 'CREATE', (tx) =>
      tx.productImage.create({
        data: { ...input, product: { connect: { id: productId } } },
      }),
    );
  }

  /** Ghi thay đổi metadata và audit trong cùng transaction. */
  private async write(
    actorUserId: bigint,
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    operation: (tx: Prisma.TransactionClient) => Promise<ProductImage>,
  ) {
    try {
      return await this.database.client.$transaction(async (tx) => {
        const image = await operation(tx);
        await tx.adminAuditLog.create({
          data: {
            actorUserId,
            action,
            targetType: 'PRODUCT_IMAGE',
            targetId: image.id,
          },
        });
        return image;
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
