import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getScaffoldStatus(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
