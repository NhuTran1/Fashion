import { Controller, Get, Param, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { ProductListQuery } from './product-list.query';

@Controller('products')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  /** Trả một trang sản phẩm công khai theo bộ lọc và thứ tự yêu cầu. */
  @Get()
  listProducts(@Query() query: ProductListQuery) {
    return this.catalog.listProducts(query);
  }

  /** Trả chi tiết công khai và danh sách biến thể để chọn size, màu. */
  @Get(':productId')
  getProduct(@Param('productId') productId: string) {
    return this.catalog.getProduct(productId);
  }
}
