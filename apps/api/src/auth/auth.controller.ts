import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CredentialsDto } from './credentials.dto';
import {
  COOKIE_ATTRIBUTES,
  COOKIE_NAME,
  WEB_TOKEN_PATTERN,
  csrfToken,
  getWebCookie,
  requireJson,
  requireNative,
  requireSessionCredentials,
  requireWebOrigin,
} from './session-http';

// Controller HTTP cho đăng ký và phiên Android/Web.
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(
    @Req() request: IncomingMessage,
    @Body() credentials: CredentialsDto,
  ) {
    requireJson(request);
    if (
      request.headers.origin !== undefined ||
      request.headers['sec-fetch-site'] !== undefined
    ) {
      requireWebOrigin(request);
    }
    this.auth.limitAttempts(
      'register',
      request.socket.remoteAddress ?? 'unknown',
    );
    return this.auth.register(credentials);
  }

  @Post('login')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async loginNative(
    @Req() request: IncomingMessage,
    @Body() credentials: CredentialsDto,
  ) {
    requireJson(request);
    requireNative(request);
    this.auth.limitAttempts('login', request.socket.remoteAddress ?? 'unknown');
    const { user, token, expiresAt } = await this.auth.login(
      credentials,
      'native',
    );
    return { user, token, expiresAt };
  }

  @Post('web/login')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async loginWeb(
    @Req() request: IncomingMessage,
    @Body() credentials: CredentialsDto,
    @Res({ passthrough: true }) response: ServerResponse,
  ) {
    requireJson(request);
    requireWebOrigin(request);
    this.auth.limitAttempts('login', request.socket.remoteAddress ?? 'unknown');
    const { user, token, expiresAt, maxAge } = await this.auth.login(
      credentials,
      'web',
    );
    response.setHeader(
      'Set-Cookie',
      COOKIE_NAME +
        '=' +
        token +
        '; Max-Age=' +
        maxAge +
        '; ' +
        COOKIE_ATTRIBUTES,
    );
    return { user, expiresAt, csrfToken: csrfToken(token) };
  }

  /** Trả lại CSRF token của phiên khi Web tải lại trang. */
  @Get('csrf')
  @Header('Cache-Control', 'no-store')
  async readWebCsrf(
    @Req() request: IncomingMessage,
  ): Promise<{ csrfToken: string }> {
    requireWebOrigin(request, 'INVALID_ORIGIN', 'read');
    const token = getWebCookie(request);
    if (!token || !WEB_TOKEN_PATTERN.test(token))
      throw new UnauthorizedException();

    await this.auth.requireActiveSession(token, 'web');
    return { csrfToken: csrfToken(token) };
  }

  /** Thu hồi phiên và xóa cookie nếu request đến từ Web. */
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: IncomingMessage,
    @Res({ passthrough: true }) response: ServerResponse,
  ): Promise<void> {
    const { token, channel } = requireSessionCredentials(request, 'write');
    await this.auth.logout(token, channel);
    if (channel === 'native') return;

    response.setHeader(
      'Set-Cookie',
      COOKIE_NAME + '=; Max-Age=0; ' + COOKIE_ATTRIBUTES,
    );
  }
}
