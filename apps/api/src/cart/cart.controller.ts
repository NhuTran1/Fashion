import type { IncomingMessage } from 'node:http';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { requireJson, requireSessionCredentials } from '../auth/session-http';
import { hasUserRole } from '../users/user-role.policy';
import {
  AddCartItemDto,
  CartQuantityDto,
  VARIANT_ID_PATTERN,
} from './cart.dto';
import { CartService } from './cart.service';

const MAX_VARIANT_ID = 18_446_744_073_709_551_615n;

/** Chuyển ID chuỗi sang BigInt trong miền ID của MySQL. */
function parseVariantId(value: string, InvalidId: typeof BadRequestException) {
  if (!VARIANT_ID_PATTERN.test(value)) throw new InvalidId();
  const id = BigInt(value);
  if (id > MAX_VARIANT_ID) throw new InvalidId();
  return id;
}

@Controller('cart')
export class CartController {
  constructor(
    private readonly auth: AuthService,
    private readonly cart: CartService,
  ) {}

  /** Trả giỏ hàng của Customer đang dùng phiên hợp lệ. */
  @Get()
  @Header('Cache-Control', 'no-store')
  async getCart(@Req() request: IncomingMessage) {
    return this.cart.getCart(await this.requireCustomerId(request, 'read'));
  }

  /** Cộng số lượng SKU vào giỏ của Customer trong phiên. */
  @Post('items')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async addCartItem(
    @Req() request: IncomingMessage,
    @Body() { variantId, quantity }: AddCartItemDto,
  ) {
    const userId = await this.requireCustomerId(request, 'write');
    requireJson(request);
    return this.cart.addCartItem(
      userId,
      parseVariantId(variantId, BadRequestException),
      quantity,
    );
  }

  /** Đặt số lượng tuyệt đối cho SKU đã có trong giỏ của Customer. */
  @Patch('items/:variantId')
  @Header('Cache-Control', 'no-store')
  async setCartItemQuantity(
    @Req() request: IncomingMessage,
    @Param('variantId') variantId: string,
    @Body() { quantity }: CartQuantityDto,
  ) {
    const userId = await this.requireCustomerId(request, 'write');
    requireJson(request);
    return this.cart.setCartItemQuantity(
      userId,
      parseVariantId(variantId, BadRequestException),
      quantity,
    );
  }

  /** Xóa SKU khỏi giỏ của Customer, kể cả khi SKU đã ngừng bán. */
  @Delete('items/:variantId')
  @HttpCode(204)
  async removeCartItem(
    @Req() request: IncomingMessage,
    @Param('variantId') variantId: string,
  ) {
    const userId = await this.requireCustomerId(request, 'write');
    await this.cart.removeCartItem(
      userId,
      parseVariantId(variantId, NotFoundException),
    );
  }

  /** Lấy ID chủ giỏ từ phiên Customer và kiểm tra Origin/CSRF khi ghi qua Web. */
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
