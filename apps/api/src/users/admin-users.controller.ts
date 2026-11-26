import {
  Body,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { requireJson } from '../auth/session-http';
import {
  AdminWebGuard,
  type AdminWebRequest,
} from '../catalog/admin-web.guard';
import { AccountStatusDto, AdminUserPageQuery } from './admin-users.dto';
import { AdminUsersService } from './admin-users.service';

/** Chuyển tham số đường dẫn thành ID trong miền khóa unsigned BIGINT. */
function parseUserId(value: string): bigint {
  if (!/^[1-9][0-9]{0,19}$/.test(value)) throw new NotFoundException();
  const id = BigInt(value);
  if (id > 18_446_744_073_709_551_615n) throw new NotFoundException();
  return id;
}

@Controller('admin/users')
@UseGuards(AdminWebGuard)
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  /** Liệt kê tài khoản Customer theo trang và trạng thái. */
  @Get()
  @Header('Cache-Control', 'no-store')
  listAdminUsers(@Query() query: AdminUserPageQuery) {
    return this.users.listCustomers(query);
  }

  /** Khóa hoặc mở khóa Customer bằng phiên Admin Web đã xác thực. */
  @Patch(':userId/status')
  @Header('Cache-Control', 'no-store')
  setAccountStatus(
    @Req() request: AdminWebRequest,
    @Param('userId') userId: string,
    @Body() input: AccountStatusDto,
  ) {
    requireJson(request);
    return this.users.setStatus(
      parseUserId(userId),
      input.status,
      request.adminUserId,
    );
  }
}
