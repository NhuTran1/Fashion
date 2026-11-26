import {
  ForbiddenException,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { argon2id, hash, verify } from 'argon2';
import { ApiHttpException } from '../api-http.exception';
import { Prisma, type User } from '../generated/prisma/client';
import { hasUserRole } from '../users/user-role.policy';
import { DatabaseService } from '../database/database.service';
import { retryWriteTransaction } from '../database/transaction-retry';
import { lockUser } from '../users/locked-user';
import type { CredentialsDto } from './credentials.dto';

const HOUR_MS = 60 * 60 * 1000;
const CUSTOMER_TTL_MS = 7 * 24 * HOUR_MS;
const ADMIN_TTL_MS = 8 * HOUR_MS;
const ADMIN_IDLE_MS = HOUR_MS / 2;
const ATTEMPT_WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 10;
const MAX_LIMIT_ENTRIES = 10_000;

/** Chỉ trả các trường hồ sơ công khai theo contract. */
export function publicUser(
  user: Pick<User, 'id' | 'email' | 'role' | 'status'>,
) {
  const { id, email, role, status } = user;
  return { id: id.toString(), email, role, status };
}

function tokenDigest(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Trả lỗi chung cho thông tin đăng nhập hoặc trạng thái tài khoản không hợp lệ. */
function invalidCredentials() {
  return new ApiHttpException(
    401,
    'INVALID_CREDENTIALS',
    'Invalid credentials.',
  );
}

// Xác thực thông tin đăng nhập và lưu vòng đời phiên trong MySQL.
@Injectable()
export class AuthService {
  private dummyHash?: Promise<string>;
  private readonly attempts = new Map<
    string,
    { count: number; until: number }
  >();
  private nextCleanup = 0;

  constructor(private readonly database: DatabaseService) {}

  limitAttempts(action: 'register' | 'login', ip: string): void {
    const now = Date.now();
    if (now >= this.nextCleanup) {
      for (const [key, entry] of this.attempts) {
        if (entry.until <= now) this.attempts.delete(key);
      }
      this.nextCleanup = now + ATTEMPT_WINDOW_MS;
    }
    const key = action + ':' + ip;
    const entry = this.attempts.get(key);
    if (!entry || entry.until <= now) {
      if (!entry && this.attempts.size >= MAX_LIMIT_ENTRIES) {
        throw new HttpException('Too many requests.', 429);
      }
      this.attempts.set(key, { count: 1, until: now + ATTEMPT_WINDOW_MS });
      return;
    }
    if (entry.count >= MAX_ATTEMPTS) {
      throw new HttpException('Too many requests.', 429);
    }
    entry.count += 1;
  }

  async register(credentials: CredentialsDto) {
    const db = this.database.client;
    const passwordHash = await hash(credentials.password, { type: argon2id });
    try {
      const user = await db.user.create({
        data: {
          email: credentials.email.toLowerCase(),
          passwordHash,
          role: 'CUSTOMER',
          status: 'ACTIVE',
        },
        select: { id: true, email: true, role: true, status: true },
      });
      return publicUser(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ApiHttpException(
          409,
          'EMAIL_ALREADY_EXISTS',
          'Email already exists.',
        );
      }
      throw error;
    }
  }

  /** Xác minh mật khẩu và tạo phiên dưới cùng khóa với thao tác khóa tài khoản. */
  async login(credentials: CredentialsDto, channel: 'native' | 'web') {
    const db = this.database.client;
    const user = await db.user.findUnique({
      where: { email: credentials.email.toLowerCase() },
    });
    this.dummyHash ??= hash(randomBytes(32), { type: argon2id });
    const dummyHash = await this.dummyHash;
    const validPassword = await verify(
      user?.passwordHash ?? dummyHash,
      credentials.password,
    );
    if (!user || !validPassword || user.status !== 'ACTIVE') {
      throw invalidCredentials();
    }

    return retryWriteTransaction(() =>
      db.$transaction(
        async (tx) => {
          const current = await lockUser(tx, user.id);
          if (
            !current ||
            current.status !== 'ACTIVE' ||
            current.passwordHash !== user.passwordHash
          ) {
            throw invalidCredentials();
          }
          const admin = hasUserRole(current, 'ADMIN');
          const customer = hasUserRole(current, 'CUSTOMER');
          if (!customer && !(admin && channel === 'web')) {
            throw new ForbiddenException();
          }

          const token = channel + '_' + randomBytes(32).toString('base64url');
          const now = new Date();
          const ttl = admin ? ADMIN_TTL_MS : CUSTOMER_TTL_MS;
          const expiresAt = new Date(now.getTime() + ttl);
          await tx.session.create({
            data: {
              userId: current.id,
              tokenHash: tokenDigest(token),
              createdAt: now,
              lastSeenAt: now,
              expiresAt,
            },
          });
          return {
            user: publicUser(current),
            token,
            expiresAt: expiresAt.toISOString(),
            maxAge: ttl / 1000,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      ),
    );
  }

  /** Kiểm tra hạn, trạng thái thu hồi và quyền dùng phiên theo kênh. */
  async requireActiveSession(token: string, channel: 'native' | 'web') {
    const session = await this.database.client.session.findUnique({
      where: { tokenHash: tokenDigest(token) },
      include: {
        user: { select: { id: true, email: true, role: true, status: true } },
      },
    });
    const now = new Date();
    if (!session || session.revokedAt || session.expiresAt <= now) {
      throw new UnauthorizedException();
    }
    const admin = hasUserRole(session.user, 'ADMIN');
    const customer = hasUserRole(session.user, 'CUSTOMER');
    if (!(
      customer ||
      (admin &&
        channel === 'web' &&
        now.getTime() - session.lastSeenAt.getTime() < ADMIN_IDLE_MS)
    )) {
      throw new UnauthorizedException();
    }

    return session;
  }

  /** Thu hồi phiên hiện tại khi phiên đủ điều kiện sử dụng. */
  async logout(token: string, channel: 'native' | 'web'): Promise<void> {
    const session = await this.requireActiveSession(token, channel);
    const now = new Date();

    // Điều kiện cập nhật bảo đảm chỉ một request logout thu hồi phiên thành công.
    const result = await this.database.client.session.updateMany({
      where: { id: session.id, revokedAt: null, expiresAt: { gt: now } },
      data: { revokedAt: now },
    });
    if (result.count !== 1) throw new UnauthorizedException();
  }
}
