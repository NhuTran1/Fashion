import { Controller, Get, Header } from '@nestjs/common';

@Controller()
export class AppController {
  // Route GET / xác nhận API scaffold đang nhận và trả HTTP.
  @Get()
  getScaffoldStatus(): { status: 'ok' } {
    return { status: 'ok' };
  }

  // Health check xác nhận tiến trình HTTP sẵn sàng nhận request.
  @Get('health')
  @Header('Cache-Control', 'no-store')
  getHealthStatus(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
