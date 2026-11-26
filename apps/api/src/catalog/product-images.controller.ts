import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { requireJson } from '../auth/session-http';
import { adminCatalogId } from './admin-catalog.service';
import { AdminWebGuard, type AdminWebRequest } from './admin-web.guard';
import type { StoredProductImage } from './image-storage';
import {
  MAX_PRODUCT_IMAGE_BYTES,
  type UploadedProductImage,
} from './product-image-policy';
import {
  CreateProductImageDto,
  UpdateProductImageDto,
} from './product-images.dto';
import { ProductImagesService } from './product-images.service';

// Trả bytes ảnh với MIME và độ dài do server xác định.
function imageResponse({ bytes, contentType }: StoredProductImage) {
  return new StreamableFile(bytes, { type: contentType, length: bytes.length });
}

@Controller('products/:productId/images')
export class PublicProductImagesController {
  constructor(private readonly images: ProductImagesService) {}

  /** Phục vụ ảnh thuộc sản phẩm đang hiển thị trong catalog công khai. */
  @Get(':imageId/file')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Cache-Control', 'no-store')
  async read(
    @Param('productId') productId: string,
    @Param('imageId') imageId: string,
  ) {
    const image = await this.images.readImage(
      adminCatalogId(productId),
      adminCatalogId(imageId),
      'public',
    );
    return imageResponse(image);
  }
}

@Controller('admin/products/:productId/images')
@UseGuards(AdminWebGuard)
export class AdminProductImagesController {
  constructor(private readonly images: ProductImagesService) {}

  /** Liệt kê ảnh của sản phẩm cho Admin Web. */
  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Param('productId') productId: string) {
    return this.images.listImages(adminCatalogId(productId));
  }

  /** Gắn ảnh đã lưu vào sản phẩm và ghi audit. */
  @Post()
  create(
    @Req() request: AdminWebRequest,
    @Param('productId') productId: string,
    @Body() data: CreateProductImageDto,
  ) {
    requireJson(request);
    return this.images.createImage(
      request.adminUserId,
      adminCatalogId(productId),
      data,
    );
  }

  /** Nhận một ảnh JPEG/PNG và tạo metadata sản phẩm. */
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      preservePath: true,
      // Cho parser nhận đúng 5 MiB; policy từ chối ngay khi vượt giới hạn.
      limits: {
        fileSize: MAX_PRODUCT_IMAGE_BYTES + 1,
        files: 1,
        fields: 0,
        parts: 2,
      },
    }),
  )
  upload(
    @Req() request: AdminWebRequest,
    @Param('productId') productId: string,
    @UploadedFile() file: UploadedProductImage | undefined,
  ) {
    if (!file || !Buffer.isBuffer(file.buffer)) throw new BadRequestException();
    return this.images.uploadImage(
      request.adminUserId,
      adminCatalogId(productId),
      file,
    );
  }

  /** Sửa metadata của ảnh thuộc đúng sản phẩm. */
  @Patch(':imageId')
  update(
    @Req() request: AdminWebRequest,
    @Param('productId') productId: string,
    @Param('imageId') imageId: string,
    @Body() data: UpdateProductImageDto,
  ) {
    requireJson(request);
    return this.images.updateImage(
      request.adminUserId,
      adminCatalogId(productId),
      adminCatalogId(imageId),
      data,
    );
  }

  /** Gỡ liên kết ảnh của đúng sản phẩm, trả 204. */
  @Delete(':imageId')
  @HttpCode(204)
  remove(
    @Req() request: AdminWebRequest,
    @Param('productId') productId: string,
    @Param('imageId') imageId: string,
  ) {
    return this.images.removeImage(
      request.adminUserId,
      adminCatalogId(productId),
      adminCatalogId(imageId),
    );
  }

  /** Phục vụ ảnh xem trước cho Admin, kể cả sản phẩm chưa công khai. */
  @Get(':imageId/file')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Cache-Control', 'no-store')
  async read(
    @Param('productId') productId: string,
    @Param('imageId') imageId: string,
  ) {
    const image = await this.images.readImage(
      adminCatalogId(productId),
      adminCatalogId(imageId),
      'admin',
    );
    return imageResponse(image);
  }
}
