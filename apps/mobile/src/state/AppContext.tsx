import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { fashionApi } from '../api/client';
import { sessionStore } from '../api/sessionStore';
import { mockServer } from '../mock/mockServer';
import {
  ApiClientError,
  Cart,
  Credentials,
  EntityId,
  MockFaultMode,
  Order,
  StaffPermission,
  User,
} from '../types/api';

/** Typed application routes supporting both Customer Storefront and Web-first Admin Ops. */
export type AppRoute =
  | { name: 'catalog' }
  | { name: 'product'; productId: EntityId }
  | { name: 'cart' }
  | { name: 'checkout' }
  | { name: 'order-success'; order: Order; replayed: boolean }
  | { name: 'orders' }
  | { name: 'order-detail'; orderId: EntityId }
  | { name: 'addresses'; selectMode?: boolean }
  | { name: 'auth'; mode?: 'login' | 'register' }
  | { name: 'profile' }
  | {
      name: 'admin';
      tab?: 'catalog' | 'inventory' | 'orders' | 'reviews' | 'users';
    };

interface ToastBanner {
  id: number;
  tone: 'info' | 'success' | 'error';
  message: string;
}

interface AppContextValue {
  route: AppRoute;
  user: User | null;
  sessionLoading: boolean;
  cart: Cart;
  cartLoading: boolean;
  reviewedOrderItems: Record<EntityId, boolean>;
  toast: ToastBanner | null;
  nextFault: MockFaultMode;
  navigate: (next: AppRoute) => void;
  goBack: () => void;
  showToast: (tone: ToastBanner['tone'], message: string) => void;
  clearToast: () => void;
  login: (credentials: Credentials) => Promise<User>;
  register: (credentials: Credentials) => Promise<User>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<User | null>;
  refreshCart: () => Promise<void>;
  markOrderItemReviewed: (orderItemId: EntityId) => void;
  handleApiError: (error: unknown, fallbackMessage?: string) => string;
  armFault: (mode: MockFaultMode) => void;
  resetDemoData: () => void;
  hasStaffPermission: (perm: StaffPermission) => boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

/** Provide global auth session, cart state, navigation stack, and error handling across screens. */
export function AppProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [history, setHistory] = useState<AppRoute[]>([{ name: 'catalog' }]);
  const [pendingRoute, setPendingRoute] = useState<AppRoute | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [sessionLoading, setSessionLoading] = useState<boolean>(true);
  const [cart, setCart] = useState<Cart>({ items: [], subtotal: '0.00' });
  const [cartLoading, setCartLoading] = useState<boolean>(false);
  const [reviewedOrderItems, setReviewedOrderItems] = useState<Record<EntityId, boolean>>({});
  const [toast, setToast] = useState<ToastBanner | null>(null);
  const [nextFault, setNextFaultState] = useState<MockFaultMode>('NONE');

  const route = history[history.length - 1];

  /** Display a transient notification banner to the user. */
  const showToast = useCallback((tone: ToastBanner['tone'], message: string) => {
    setToast({ id: Date.now(), tone, message });
  }, []);

  /** Dismiss the active notification banner. */
  const clearToast = useCallback(() => {
    setToast(null);
  }, []);

  /** Push a new route onto the navigation history stack. */
  const navigate = useCallback((next: AppRoute) => {
    setHistory((prev) => {
      const top = prev[prev.length - 1];
      if (JSON.stringify(top) === JSON.stringify(next)) {
        return prev;
      }
      return [...prev, next];
    });
  }, []);

  /** Return to the previous route or fall back to catalog. */
  const goBack = useCallback(() => {
    setHistory((prev) => (prev.length > 1 ? prev.slice(0, -1) : [{ name: 'catalog' }]));
  }, []);

  /** Refresh authenticated Customer's cart from the API. */
  const refreshCart = useCallback(async () => {
    setCartLoading(true);
    try {
      const nextCart = await fashionApi.getCart();
      setCart(nextCart);
    } catch {
      setCart({ items: [], subtotal: '0.00' });
    } finally {
      setCartLoading(false);
    }
  }, []);

  /** Verify existing session on startup and hydrate user + cart if logged in. */
  const refreshSession = useCallback(async (): Promise<User | null> => {
    setSessionLoading(true);
    try {
      const token = await sessionStore.getToken();
      if (!token && fashionApi.isMockMode()) {
        setUser(null);
        setCart({ items: [], subtotal: '0.00' });
        return null;
      }
      const me = await fashionApi.getMe();
      if (Platform.OS === 'web') {
        await fashionApi.readWebCsrf();
      }
      setUser(me);
      if (me.role === 'CUSTOMER') {
        const nextCart = await fashionApi.getCart();
        setCart(nextCart);
      } else {
        setCart({ items: [], subtotal: '0.00' });
      }
      return me;
    } catch {
      await sessionStore.clear();
      setUser(null);
      setCart({ items: [], subtotal: '0.00' });
      return null;
    } finally {
      setSessionLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  /**
   * Handle API errors consistently according to ADR-0003 & M1-09/M1-10:
   * - 401 clears local session and redirects to Login while preserving destination.
   * - CSRF_INVALID triggers automatic token re-read notice on Web.
   */
  const handleApiError = useCallback(
    (error: unknown, fallbackMessage = 'Không thể hoàn thành thao tác.'): string => {
      setNextFaultState(mockServer.getNextFault());
      if (error instanceof ApiClientError) {
        if (error.status === 401) {
          void sessionStore.clear();
          setUser(null);
          setCart({ items: [], subtotal: '0.00' });
          setPendingRoute(route.name === 'auth' ? null : route);
          navigate({ name: 'auth', mode: 'login' });
        } else if (error.code === 'CSRF_INVALID' && Platform.OS === 'web') {
          void fashionApi.readWebCsrf().catch(() => undefined);
          return `${error.message} Hệ thống đã làm mới CSRF token, vui lòng thử lại thao tác.`;
        }
        return `${error.message} [${error.code} · ${error.requestId}]`;
      }
      if (error instanceof Error) {
        return error.message;
      }
      return fallbackMessage;
    },
    [navigate, route],
  );

  /** Log in with credentials and redirect to preserved destination or role workspace. */
  const login = useCallback(
    async (credentials: Credentials): Promise<User> => {
      const loggedUser = await fashionApi.login(credentials);
      setUser(loggedUser);
      if (loggedUser.role === 'CUSTOMER') {
        await refreshCart();
      } else {
        setCart({ items: [], subtotal: '0.00' });
      }
      if (pendingRoute) {
        const dest = pendingRoute;
        setPendingRoute(null);
        navigate(dest);
      } else if (loggedUser.role === 'ADMIN' || loggedUser.role === 'STAFF') {
        navigate({ name: 'admin', tab: 'orders' });
      } else {
        navigate({ name: 'catalog' });
      }
      showToast('success', `Đã đăng nhập: ${loggedUser.email}`);
      return loggedUser;
    },
    [navigate, pendingRoute, refreshCart, showToast],
  );

  /** Register a new public Customer account (does not auto-login per OpenAPI spec). */
  const register = useCallback(async (credentials: Credentials): Promise<User> => {
    const created = await fashionApi.registerCustomer(credentials);
    return created;
  }, []);

  /** Log out current account and return safely to public catalog. */
  const logout = useCallback(async () => {
    await fashionApi.logout();
    setUser(null);
    setCart({ items: [], subtotal: '0.00' });
    setReviewedOrderItems({});
    setHistory([{ name: 'catalog' }]);
    showToast('info', 'Đã đăng xuất khỏi phiên làm việc.');
  }, [showToast]);

  /** Remember an orderItemId reviewed during the active session (per M1-09 contract limit). */
  const markOrderItemReviewed = useCallback((orderItemId: EntityId) => {
    setReviewedOrderItems((prev) => ({ ...prev, [orderItemId]: true }));
  }, []);

  /** Arm a one-shot simulated backend fault for UI resilience testing. */
  const armFault = useCallback(
    (mode: MockFaultMode) => {
      mockServer.setNextFault(mode);
      setNextFaultState(mode);
      showToast(
        'info',
        mode === 'NONE'
          ? 'Đã tắt giả lập lỗi API.'
          : `Đã gài lỗi "${mode}" cho request kế tiếp.`,
      );
    },
    [showToast],
  );

  /** Reset mock backend seed database and sign out to start a clean demo run. */
  const resetDemoData = useCallback(() => {
    mockServer.reset();
    void sessionStore.clear();
    setUser(null);
    setCart({ items: [], subtotal: '0.00' });
    setReviewedOrderItems({});
    setNextFaultState('NONE');
    setHistory([{ name: 'catalog' }]);
    showToast('success', 'Đã khôi phục dữ liệu mẫu ban đầu.');
  }, [showToast]);

  /** Check whether active user (Admin or Staff) holds a specific operational permission. */
  const hasStaffPermission = useCallback(
    (perm: StaffPermission): boolean => {
      if (!user) return false;
      if (user.role === 'ADMIN') return true;
      if (user.role === 'STAFF') return Boolean(user.permissions?.includes(perm));
      return false;
    },
    [user],
  );

  return (
    <AppContext.Provider
      value={{
        route,
        user,
        sessionLoading,
        cart,
        cartLoading,
        reviewedOrderItems,
        toast,
        nextFault,
        navigate,
        goBack,
        showToast,
        clearToast,
        login,
        register,
        logout,
        refreshSession,
        refreshCart,
        markOrderItemReviewed,
        handleApiError,
        armFault,
        resetDemoData,
        hasStaffPermission,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

/** Hook for accessing AppContext safely inside screen and UI components. */
export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used inside AppProvider');
  }
  return ctx;
}
