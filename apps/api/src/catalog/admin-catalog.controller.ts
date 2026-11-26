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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { requireJson } from '../auth/session-http';
import {
  CreateCategoryDto,
  CreateProductDto,
  CreateVariantDto,
  UpdateCategoryDto,
  UpdateProductDto,
  UpdateVariantDto,
} from './admin-catalog.dto';
import { adminCatalogId, AdminCatalogService } from './admin-catalog.service';
import { AdminWebGuard, type AdminWebRequest } from './admin-web.guard';
import { CatalogPageQuery } from './product-list.query';

// PATCH phải có ít nhất một trường hợp lệ sau khi DTO được chuyển đổi.
function requirePatch(request: AdminWebRequest, body: object): void {
  requireJson(request);
  if (Object.values(body).every((value) => value === undefined))
    throw new BadRequestException();
}

@Controller('admin')
@UseGuards(AdminWebGuard)
export class AdminCatalogController {
  constructor(private readonly admin: AdminCatalogService) {}

  /** Liệt kê toàn bộ danh mục cho Admin Web. */
  @Get('categories')
  @Header('Cache-Control', 'no-store')
  listCategories() {
    return this.admin.listCategories();
  }

  /** Tạo danh mục theo DTO đã kiểm tra. */
  @Post('categories')
  createCategory(
    @Req() request: AdminWebRequest,
    @Body() body: CreateCategoryDto,
  ) {
    requireJson(request);
    return this.admin.createCategory(request.adminUserId, body);
  }

  /** Sửa danh mục và giữ những trường không có trong PATCH. */
  @Patch('categories/:categoryId')
  updateCategory(
    @Req() request: AdminWebRequest,
    @Param('categoryId') id: string,
    @Body() body: UpdateCategoryDto,
  ) {
    requirePatch(request, body);
    return this.admin.updateCategory(
      request.adminUserId,
      adminCatalogId(id),
      body,
    );
  }

  /** Xóa danh mục đủ điều kiện, trả 204. */
  @Delete('categories/:categoryId')
  @HttpCode(204)
  removeCategory(
    @Req() request: AdminWebRequest,
    @Param('categoryId') id: string,
  ) {
    return this.admin.removeCategory(request.adminUserId, adminCatalogId(id));
  }

  /** Trả một trang sản phẩm quản trị. */
  @Get('products')
  @Header('Cache-Control', 'no-store')
  listProducts(@Query() query: CatalogPageQuery) {
    return this.admin.listProducts(query);
  }

  /** Tạo sản phẩm thuộc danh mục hợp lệ. */
  @Post('products')
  createProduct(
    @Req() request: AdminWebRequest,
    @Body() body: CreateProductDto,
  ) {
    requireJson(request);
    return this.admin.createProduct(request.adminUserId, body);
  }

  /** Sửa thông tin sản phẩm theo PATCH. */
  @Patch('products/:productId')
  updateProduct(
    @Req() request: AdminWebRequest,
    @Param('productId') id: string,
    @Body() body: UpdateProductDto,
  ) {
    requirePatch(request, body);
    return this.admin.updateProduct(
      request.adminUserId,
      adminCatalogId(id),
      body,
    );
  }

  /** Xóa sản phẩm đủ điều kiện, trả 204. */
  @Delete('products/:productId')
  @HttpCode(204)
  removeProduct(
    @Req() request: AdminWebRequest,
    @Param('productId') id: string,
  ) {
    return this.admin.removeProduct(request.adminUserId, adminCatalogId(id));
  }

  /** Liệt kê các biến thể thuộc sản phẩm yêu cầu. */
  @Get('products/:productId/variants')
  @Header('Cache-Control', 'no-store')
  listVariants(@Param('productId') productId: string) {
    return this.admin.listVariants(adminCatalogId(productId));
  }

  /** Tạo biến thể cho sản phẩm cha trong URL. */
  @Post('products/:productId/variants')
  createVariant(
    @Req() request: AdminWebRequest,
    @Param('productId') productId: string,
    @Body() body: CreateVariantDto,
  ) {
    requireJson(request);
    return this.admin.createVariant(
      request.adminUserId,
      adminCatalogId(productId),
      body,
    );
  }

  /** Sửa biến thể thuộc đúng sản phẩm cha. */
  @Patch('products/:productId/variants/:variantId')
  updateVariant(
    @Req() request: AdminWebRequest,
    @Param('productId') productId: string,
    @Param('variantId') id: string,
    @Body() body: UpdateVariantDto,
  ) {
    requirePatch(request, body);
    return this.admin.updateVariant(
      request.adminUserId,
      adminCatalogId(productId),
      adminCatalogId(id),
      body,
    );
  }

  /** Xóa biến thể thuộc đúng sản phẩm cha, trả 204. */
  @Delete('products/:productId/variants/:variantId')
  @HttpCode(204)
  removeVariant(
    @Req() request: AdminWebRequest,
    @Param('productId') productId: string,
    @Param('variantId') id: string,
  ) {
    return this.admin.removeVariant(
      request.adminUserId,
      adminCatalogId(productId),
      adminCatalogId(id),
    );
  }
}
