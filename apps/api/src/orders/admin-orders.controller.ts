import {
  Body,
  Controller,
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
  AdminWebGuard,
  type AdminWebRequest,
} from '../catalog/admin-web.guard';
import {
  AdminOrderPageQuery,
  CancellationDto,
  OrderTransitionDto,
  parseOrderId,
} from './order-query.dto';
import { OrdersService } from './orders.service';

@Controller('admin/orders')
@UseGuards(AdminWebGuard)
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}

  /** Liệt kê đơn cửa hàng, có thể lọc theo trạng thái. */
  @Get()
  @Header('Cache-Control', 'no-store')
  listAdminOrders(@Query() query: AdminOrderPageQuery) {
    return this.orders.list({ status: query.status }, query);
  }

  /** Trả snapshot đơn cho Admin Web. */
  @Get(':orderId')
  @Header('Cache-Control', 'no-store')
  getAdminOrder(@Param('orderId') orderId: string) {
    return this.orders.detail({ id: parseOrderId(orderId) });
  }

  /** Chuyển đơn đến trạng thái kế tiếp dưới phiên Admin đã xác thực. */
  @Patch(':orderId/status')
  @Header('Cache-Control', 'no-store')
  advanceAdminOrder(
    @Req() request: AdminWebRequest,
    @Param('orderId') orderId: string,
    @Body() input: OrderTransitionDto,
  ) {
    requireJson(request);
    return this.orders.advance(
      request.adminUserId,
      parseOrderId(orderId),
      input.status,
    );
  }

  /** Xác nhận giao và thu COD mô phỏng cho đơn đang vận chuyển. */
  @Post(':orderId/deliver')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  confirmDeliveryAndCod(
    @Req() request: AdminWebRequest,
    @Param('orderId') orderId: string,
  ) {
    return this.orders.deliver(request.adminUserId, parseOrderId(orderId));
  }

  /** Hủy đơn trước khi giao cho vận chuyển và ghi lý do của Admin. */
  @Post(':orderId/cancel')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  cancelAdminOrder(
    @Req() request: AdminWebRequest,
    @Param('orderId') orderId: string,
    @Body() input: CancellationDto,
  ) {
    requireJson(request);
    return this.orders.cancel(parseOrderId(orderId), {
      role: 'ADMIN',
      userId: request.adminUserId,
      reason: input.reason,
    });
  }
}
