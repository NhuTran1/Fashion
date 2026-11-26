import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { requireJson, requireSessionCredentials } from '../auth/session-http';
import { CatalogPageQuery } from '../catalog/product-list.query';
import { hasUserRole } from '../users/user-role.policy';
import { CheckoutDto } from './checkout.dto';
import { CheckoutService } from './checkout.service';
import { parseOrderId } from './order-query.dto';
import { orderResponse } from './order-response';
import { OrdersService } from './orders.service';

const MAX_MYSQL_ID = 18_446_744_073_709_551_615n;

/** Chuyển ID đã qua DTO sang BigInt, kiểm tra cận trên của MySQL. */
function parseCheckoutId(value: string): bigint {
  const id = BigInt(value);
  if (id > MAX_MYSQL_ID) throw new BadRequestException();
  return id;
}

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly auth: AuthService,
    private readonly checkout: CheckoutService,
    private readonly orders: OrdersService,
  ) {}

  /** Liệt kê đơn của Customer lấy từ phiên hiện tại. */
  @Get('me')
  @Header('Cache-Control', 'no-store')
  async listMyOrders(
    @Req() request: IncomingMessage,
    @Query() query: CatalogPageQuery,
  ) {
    const userId = await this.requireCustomerId(request, 'read');
    return this.orders.list({ userId }, query);
  }

  /** Đọc snapshot của đơn thuộc Customer trong phiên. */
  @Get(':orderId')
  @Header('Cache-Control', 'no-store')
  async getMyOrder(
    @Req() request: IncomingMessage,
    @Param('orderId') orderId: string,
  ) {
    const userId = await this.requireCustomerId(request, 'read');
    return this.orders.detail({ id: parseOrderId(orderId), userId });
  }

  /** Hủy đơn PENDING của Customer và trả snapshot nếu gửi lại yêu cầu. */
  @Post(':orderId/cancel')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async cancelMyOrder(
    @Req() request: IncomingMessage,
    @Param('orderId') orderId: string,
  ) {
    const userId = await this.requireCustomerId(request, 'write');
    return this.orders.cancel(parseOrderId(orderId), {
      role: 'CUSTOMER',
      userId,
    });
  }

  /** Tạo đơn COD cho Customer đã xác thực hoặc trả lại đơn từ cùng key. */
  @Post()
  @Header('Cache-Control', 'no-store')
  async checkoutCod(
    @Req() request: IncomingMessage,
    @Res({ passthrough: true }) response: ServerResponse,
    @Body() input: CheckoutDto,
  ) {
    const userId = await this.requireCustomerId(request, 'write');
    requireJson(request);

    const keys = request.headersDistinct['idempotency-key'];
    if (keys?.length !== 1) throw new BadRequestException();
    const { order, paymentStatus, replayed } = await this.checkout.createOrder({
      userId,
      addressId: parseCheckoutId(input.addressId),
      method: input.method,
      items: input.items.map(({ variantId, quantity }) => ({
        variantId: parseCheckoutId(variantId),
        quantity,
      })),
      idempotencyKey: keys[0],
    });
    response.statusCode = replayed ? 200 : 201;
    return orderResponse(order, paymentStatus);
  }

  /** Xác thực phiên và lấy ID Customer cho các thao tác trên đơn của mình. */
  private async requireCustomerId(
    request: IncomingMessage,
    mode: 'read' | 'write',
  ) {
    const { token, channel } = requireSessionCredentials(request, mode);
    const session = await this.auth.requireActiveSession(token, channel);
    if (!hasUserRole(session.user, 'CUSTOMER')) throw new ForbiddenException();
    return session.userId;
  }
}
