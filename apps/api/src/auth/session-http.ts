import { createHmac, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ApiHttpException } from '../api-http.exception';

export const COOKIE_NAME = '__Host-session';
export const COOKIE_ATTRIBUTES = 'Path=/; HttpOnly; Secure; SameSite=Lax';
export const WEB_TOKEN_PATTERN = /^web_[A-Za-z0-9_-]{43}$/;
const NATIVE_BEARER_PATTERN = /^Bearer (native_[A-Za-z0-9_-]{43})$/i;

export function requireJson(request: IncomingMessage): void {
  const mediaType = request.headers['content-type']
    ?.split(';')[0]
    .trim()
    .toLowerCase();
  if (mediaType !== 'application/json') throw new BadRequestException();
}

/** Xác minh origin; trình duyệt có thể không gửi Origin khi đọc cùng origin. */
export function requireWebOrigin(
  request: IncomingMessage,
  code = 'INVALID_ORIGIN',
  mode: 'read' | 'write' = 'write',
): void {
  const origin = request.headers.origin;
  const fetchSite = request.headers['sec-fetch-site'];
  const configured = process.env.AUTH_WEB_ORIGIN;
  const trustedOrigin =
    configured && URL.canParse(configured) ? new URL(configured) : undefined;
  if (
    !trustedOrigin ||
    !['http:', 'https:'].includes(trustedOrigin.protocol) ||
    configured !== trustedOrigin.origin ||
    ((mode === 'write' || origin !== undefined) &&
      origin !== trustedOrigin.origin) ||
    (mode === 'read' && fetchSite !== undefined && fetchSite !== 'same-origin')
  ) {
    throw new ApiHttpException(403, code, 'Origin is not allowed.');
  }
}

export function requireNative(
  request: IncomingMessage,
  code = 'INVALID_ORIGIN',
): void {
  if (
    request.headers.origin !== undefined ||
    request.headers['sec-fetch-site'] !== undefined
  ) {
    throw new ApiHttpException(403, code, 'Origin is not allowed.');
  }
}

export function getWebCookie(request: IncomingMessage): string | undefined {
  const prefix = COOKIE_NAME + '=';
  const entries =
    request.headers.cookie?.split(';').map((part) => part.trim()) ?? [];
  const matches = entries.filter((entry) => entry.startsWith(prefix));
  if (matches.length > 1) throw new UnauthorizedException();
  return matches[0]?.slice(prefix.length);
}

export function csrfToken(token: string): string {
  return createHmac('sha256', token)
    .update('fashioncommerce:web:csrf:v1')
    .digest('base64url');
}

function requireCsrf(request: IncomingMessage, sessionToken: string): void {
  const received = request.headers['x-csrf-token'];
  const expected = csrfToken(sessionToken);
  if (
    typeof received !== 'string' ||
    !/^[A-Za-z0-9_-]{43}$/.test(received) ||
    !timingSafeEqual(Buffer.from(received), Buffer.from(expected))
  ) {
    throw new ApiHttpException(403, 'CSRF_INVALID', 'Invalid CSRF token.');
  }
}

/** Chọn thông tin phiên theo kênh và áp dụng Origin/CSRF cho request ghi trên Web. */
export function requireSessionCredentials(
  request: IncomingMessage,
  mode: 'read' | 'write',
): { token: string; channel: 'native' | 'web' } {
  const authorization = request.headers.authorization;
  const cookie = getWebCookie(request);
  if (authorization !== undefined) {
    const token = NATIVE_BEARER_PATTERN.exec(authorization)?.[1];
    if (!token || cookie !== undefined) throw new UnauthorizedException();

    requireNative(request, 'FORBIDDEN');
    return { token, channel: 'native' };
  }

  if (!cookie || !WEB_TOKEN_PATTERN.test(cookie))
    throw new UnauthorizedException();

  requireWebOrigin(request, 'FORBIDDEN', mode);
  if (mode === 'write') requireCsrf(request, cookie);
  return { token: cookie, channel: 'web' };
}
