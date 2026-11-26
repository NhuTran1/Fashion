import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { requireJson } from '../auth/session-http';
import { adminCatalogId } from './admin-catalog.service';
import { AdminWebGuard, type AdminWebRequest } from './admin-web.guard';
import { InventoryAdjustmentDto } from './inventory.dto';
import { InventoryService } from './inventory.service';
import { CatalogPageQuery } from './product-list.query';

@Controller('admin/inventory/:variantId/adjustments')
@UseGuards(AdminWebGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  /** Trả lịch sử biến động của một SKU cho Admin Web. */
  @Get()
  @Header('Cache-Control', 'no-store')
  listAdjustments(
    @Param('variantId') variantId: string,
    @Query() query: CatalogPageQuery,
  ) {
    return this.inventory.listAdjustments(adminCatalogId(variantId), query);
  }

  /** Điều chỉnh tồn theo delta và ghi actor từ phiên Admin đã xác thực. */
  @Post()
  adjust(
    @Req() request: AdminWebRequest,
    @Param('variantId') variantId: string,
    @Body() adjustment: InventoryAdjustmentDto,
  ) {
    requireJson(request);
    return this.inventory.adjust(
      request.adminUserId,
      adminCatalogId(variantId),
      adjustment,
    );
  }
}
