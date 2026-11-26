import type { IncomingMessage } from 'node:http';
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { requireSessionCredentials } from '../auth/session-http';
import { hasUserRole } from '../users/user-role.policy';

export type AdminWebRequest = IncomingMessage & { adminUserId: bigint };

@Injectable()
export class AdminWebGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  /** Chỉ cho phép phiên Admin Web và lấy actor audit từ phiên đã xác thực. */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AdminWebRequest>();
    const mode = request.method === 'GET' ? 'read' : 'write';
    const { token, channel } = requireSessionCredentials(request, mode);
    const session = await this.auth.requireActiveSession(token, channel);

    if (channel !== 'web' || !hasUserRole(session.user, 'ADMIN'))
      throw new ForbiddenException();

    request.adminUserId = session.userId;
    return true;
  }
}
