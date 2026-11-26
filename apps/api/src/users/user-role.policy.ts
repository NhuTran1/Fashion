export type UserRole = 'CUSTOMER' | 'ADMIN';

interface UserRoleContext {
  role: string;
  status: string;
}

// Quyền theo vai trò chỉ áp dụng cho tài khoản MVP A đang hoạt động.
export function hasUserRole(
  user: UserRoleContext | null | undefined,
  requiredRole: UserRole,
): boolean {
  return (
    user?.status === 'ACTIVE' &&
    (user.role === 'CUSTOMER' || user.role === 'ADMIN') &&
    user.role === requiredRole
  );
}
