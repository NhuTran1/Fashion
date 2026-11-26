import type { IncomingMessage } from 'node:http';
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { hasUserRole } from '../users/user-role.policy';
import { CreateAddressDto, UpdateAddressDto } from './address.dto';
import { AuthService, publicUser } from './auth.service';
import { MeService } from './me.service';
import { requireJson, requireSessionCredentials } from './session-http';

const MAX_ADDRESS_ID = 18_446_744_073_709_551_615n;

// Chuyển ID API sang BigInt trong giới hạn BIGINT UNSIGNED của MySQL.
function parseAddressId(value: string): bigint {
  if (!/^[1-9][0-9]{0,19}$/.test(value)) throw new BadRequestException();
  const id = BigInt(value);
  if (id > MAX_ADDRESS_ID) throw new BadRequestException();
  return id;
}

@Controller('me')
export class MeController {
  constructor(
    private readonly auth: AuthService,
    private readonly me: MeService,
  ) {}

  /** Trả hồ sơ của tài khoản đang dùng phiên hợp lệ. */
  @Get()
  @Header('Cache-Control', 'no-store')
  async getMe(@Req() request: IncomingMessage) {
    const { token, channel } = requireSessionCredentials(request, 'read');
    const session = await this.auth.requireActiveSession(token, channel);
    return publicUser(session.user);
  }

  /** Liệt kê địa chỉ thuộc Customer trong phiên hiện tại. */
  @Get('addresses')
  @Header('Cache-Control', 'no-store')
  async listAddresses(@Req() request: IncomingMessage) {
    const userId = await this.requireCustomerId(request, 'read');
    return this.me.listAddresses(userId);
  }

  /** Tạo địa chỉ cho Customer đã xác thực. */
  @Post('addresses')
  async createAddress(
    @Req() request: IncomingMessage,
    @Body() body: CreateAddressDto,
  ) {
    const userId = await this.requireCustomerId(request, 'write');
    requireJson(request);
    return this.me.createAddress(userId, body);
  }

  /** Cập nhật địa chỉ của Customer đang đăng nhập. */
  @Patch('addresses/:addressId')
  async updateAddress(
    @Req() request: IncomingMessage,
    @Param('addressId') addressId: string,
    @Body() body: UpdateAddressDto,
  ) {
    const userId = await this.requireCustomerId(request, 'write');
    requireJson(request);
    return this.me.updateAddress(userId, parseAddressId(addressId), body);
  }

  /** Lấy ID chủ sở hữu từ phiên và kiểm tra quyền Customer. */
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
