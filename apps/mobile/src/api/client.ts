import { Platform } from 'react-native';
import { mockServer } from '../mock/mockServer';
import {
  AccountStatusInput,
  Address,
  AddressInput,
  AddressPatch,
  AdminAuditLog,
  AdminReview,
  ApiClientError,
  ApiErrorPayload,
  CancellationInput,
  Cart,
  CartLine,
  Category,
  CategoryInput,
  CategoryPatch,
  CheckoutInput,
  CheckoutResult,
  Credentials,
  CsrfResponse,
  EntityId,
  ImageInput,
  ImagePatch,
  InventoryInput,
  InventoryMovement,
  InventoryMovementHistory,
  ModerationInput,
  Order,
  OrderStatus,
  OrderTransitionInput,
  Paginated,
  Product,
  ProductImage,
  ProductInput,
  ProductPatch,
  ProductQueryParams,
  QuantityInput,
  Review,
  ReviewInput,
  StaffPermission,
  User,
  Variant,
  VariantInput,
  VariantPatch,
} from '../types/api';
import { createRequestId } from '../utils/format';
import { sessionStore } from './sessionStore';

/**
 * Runtime API configuration.
 * Defaults to mock mode until Codex finishes implementing /api/v1 endpoints in apps/api.
 * Set EXPO_PUBLIC_USE_MOCK=false and EXPO_PUBLIC_API_BASE_URL to switch to live NestJS.
 */
const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK !== 'false';
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || '/api/v1';

/** Execute an HTTP request against the real NestJS backend when USE_MOCK is false. */
async function httpRequest<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    includeCsrf?: boolean;
  } = {},
): Promise<{ status: number; data: T }> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers ?? {}),
  };

  if (Platform.OS !== 'web') {
    const token = await sessionStore.getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  } else if (options.includeCsrf) {
    const csrf = sessionStore.getCsrfToken();
    if (csrf) {
      headers['X-CSRF-Token'] = csrf;
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    credentials: Platform.OS === 'web' ? 'include' : 'omit',
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 204) {
    return { status: 204, data: undefined as T };
  }

  const text = await response.text();
  const parsed = text ? (JSON.parse(text) as unknown) : undefined;

  if (!response.ok) {
    const errPayload = (parsed as ApiErrorPayload) || {
      code: 'INTERNAL_ERROR',
      message: `HTTP ${response.status}`,
      requestId: createRequestId(),
    };
    throw new ApiClientError(response.status, errPayload);
  }

  return { status: response.status, data: parsed as T };
}

/**
 * Unified Fashion Store API Client matching every operationId in contracts/openapi.yaml v1.0.0.
 * Routes calls to the stateful MockFashionServer in mock mode or NestJS REST API in live mode.
 */
export const fashionApi = {
  /** Indicate whether the app is currently operating against the stateful mock server. */
  isMockMode(): boolean {
    return USE_MOCK;
  },

  /** Register a new public Customer account (operationId: registerCustomer). */
  async registerCustomer(input: Credentials): Promise<User> {
    if (USE_MOCK) {
      return mockServer.registerCustomer(input);
    }
    const res = await httpRequest<User>('/auth/register', { method: 'POST', body: input });
    return res.data;
  },

  /** Authenticate via Web cookie+CSRF or Android opaque Bearer depending on platform. */
  async login(input: Credentials): Promise<User> {
    if (USE_MOCK) {
      if (Platform.OS === 'web') {
        const { sessionToken, payload } = await mockServer.loginWeb(input);
        await sessionStore.saveSession(sessionToken, payload.csrfToken);
        return payload.user;
      }
      const nativeSession = await mockServer.loginAndroid(input);
      await sessionStore.saveSession(nativeSession.token);
      return nativeSession.user;
    }

    if (Platform.OS === 'web') {
      const res = await httpRequest<{ user: User; csrfToken: string }>('/auth/web/login', {
        method: 'POST',
        body: input,
      });
      sessionStore.setCsrfToken(res.data.csrfToken);
      return res.data.user;
    }
    const res = await httpRequest<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: input,
    });
    await sessionStore.saveSession(res.data.token);
    return res.data.user;
  },

  /** Fetch Web CSRF token bound to active cookie session (operationId: readWebCsrf). */
  async readWebCsrf(): Promise<CsrfResponse> {
    if (USE_MOCK) {
      const token = await sessionStore.getToken();
      const res = await mockServer.readWebCsrf(token);
      sessionStore.setCsrfToken(res.csrfToken);
      return res;
    }
    const res = await httpRequest<CsrfResponse>('/auth/csrf');
    sessionStore.setCsrfToken(res.data.csrfToken);
    return res.data;
  },

  /** Revoke current session and clear local credentials (operationId: logout). */
  async logout(): Promise<void> {
    try {
      if (USE_MOCK) {
        const token = await sessionStore.getToken();
        await mockServer.logout(token, sessionStore.getCsrfToken());
      } else {
        await httpRequest<void>('/auth/logout', { method: 'POST', includeCsrf: true });
      }
    } finally {
      await sessionStore.clear();
    }
  },

  /** Get authenticated user profile (operationId: getMe). */
  async getMe(): Promise<User> {
    if (USE_MOCK) {
      return mockServer.getMe(await sessionStore.getToken());
    }
    return (await httpRequest<User>('/me')).data;
  },

  /** List Customer addresses (operationId: listAddresses). */
  async listAddresses(): Promise<Address[]> {
    if (USE_MOCK) {
      return mockServer.listAddresses(await sessionStore.getToken());
    }
    return (await httpRequest<Address[]>('/me/addresses')).data;
  },

  /** Create a Customer shipping address (operationId: createAddress). */
  async createAddress(input: AddressInput): Promise<Address> {
    if (USE_MOCK) {
      return mockServer.createAddress(
        await sessionStore.getToken(),
        sessionStore.getCsrfToken(),
        input,
      );
    }
    return (
      await httpRequest<Address>('/me/addresses', {
        method: 'POST',
        body: input,
        includeCsrf: true,
      })
    ).data;
  },

  /** Update an existing Customer shipping address (operationId: updateAddress). */
  async updateAddress(addressId: EntityId, patch: AddressPatch): Promise<Address> {
    if (USE_MOCK) {
      return mockServer.updateAddress(
        await sessionStore.getToken(),
        sessionStore.getCsrfToken(),
        addressId,
        patch,
      );
    }
    return (
      await httpRequest<Address>(`/me/addresses/${addressId}`, {
        method: 'PATCH',
        body: patch,
        includeCsrf: true,
      })
    ).data;
  },

  /** List public ACTIVE categories (operationId: listCategories). */
  async listCategories(): Promise<Category[]> {
    if (USE_MOCK) {
      return mockServer.listCategories();
    }
    return (await httpRequest<Category[]>('/categories')).data;
  },

  /** List public ACTIVE products with filters and pagination (operationId: listProducts). */
  async listProducts(params: ProductQueryParams = {}): Promise<Paginated<Product>> {
    if (USE_MOCK) {
      return mockServer.listProducts(params);
    }
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));
    if (params.q) qs.set('q', params.q);
    if (params.categoryId) qs.set('categoryId', params.categoryId);
    if (params.size) qs.set('size', params.size);
    if (params.color) qs.set('color', params.color);
    if (params.sort) qs.set('sort', params.sort);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return (await httpRequest<Paginated<Product>>(`/products${suffix}`)).data;
  },

  /** Get public product detail (operationId: getProduct). */
  async getProduct(productId: EntityId): Promise<Product> {
    if (USE_MOCK) {
      return mockServer.getProduct(productId);
    }
    return (await httpRequest<Product>(`/products/${productId}`)).data;
  },

  /** List public VISIBLE reviews of a product (operationId: listProductReviews). */
  async listProductReviews(
    productId: EntityId,
    page = 1,
    pageSize = 20,
  ): Promise<Paginated<Review>> {
    if (USE_MOCK) {
      return mockServer.listProductReviews(productId, page, pageSize);
    }
    return (
      await httpRequest<Paginated<Review>>(
        `/products/${productId}/reviews?page=${page}&pageSize=${pageSize}`,
      )
    ).data;
  },

  /** Get authenticated Customer's cart (operationId: getCart). */
  async getCart(): Promise<Cart> {
    if (USE_MOCK) {
      return mockServer.getCart(await sessionStore.getToken());
    }
    return (await httpRequest<Cart>('/cart')).data;
  },

  /** Add item quantity to Customer's cart (operationId: addCartItem). */
  async addCartItem(input: CartLine): Promise<Cart> {
    if (USE_MOCK) {
      return mockServer.addCartItem(
        await sessionStore.getToken(),
        sessionStore.getCsrfToken(),
        input,
      );
    }
    return (
      await httpRequest<Cart>('/cart/items', { method: 'POST', body: input, includeCsrf: true })
    ).data;
  },

  /** Set absolute quantity on a cart line (operationId: setCartItemQuantity). */
  async setCartItemQuantity(variantId: EntityId, input: QuantityInput): Promise<Cart> {
    if (USE_MOCK) {
      return mockServer.setCartItemQuantity(
        await sessionStore.getToken(),
        sessionStore.getCsrfToken(),
        variantId,
        input,
      );
    }
    return (
      await httpRequest<Cart>(`/cart/items/${variantId}`, {
        method: 'PATCH',
        body: input,
        includeCsrf: true,
      })
    ).data;
  },

  /** Remove item from Customer's cart (operationId: removeCartItem). */
  async removeCartItem(variantId: EntityId): Promise<void> {
    if (USE_MOCK) {
      return mockServer.removeCartItem(
        await sessionStore.getToken(),
        sessionStore.getCsrfToken(),
        variantId,
      );
    }
    await httpRequest<void>(`/cart/items/${variantId}`, {
      method: 'DELETE',
      includeCsrf: true,
    });
  },

  /** Execute COD checkout with Idempotency-Key header (operationId: checkoutCod). */
  async checkoutCod(idempotencyKey: string, input: CheckoutInput): Promise<CheckoutResult> {
    if (USE_MOCK) {
      return mockServer.checkoutCod(
        await sessionStore.getToken(),
        sessionStore.getCsrfToken(),
        idempotencyKey,
        input,
      );
    }
    const res = await httpRequest<Order>('/orders', {
      method: 'POST',
      body: input,
      headers: { 'Idempotency-Key': idempotencyKey },
      includeCsrf: true,
    });
    return { order: res.data, replayed: res.status === 200 };
  },

  /** List Customer's own orders (operationId: listMyOrders). */
  async listMyOrders(page = 1, pageSize = 20): Promise<Paginated<Order>> {
    if (USE_MOCK) {
      return mockServer.listMyOrders(await sessionStore.getToken(), page, pageSize);
    }
    return (await httpRequest<Paginated<Order>>(`/orders/me?page=${page}&pageSize=${pageSize}`))
      .data;
  },

  /** Get detail of an owned order (operationId: getMyOrder). */
  async getMyOrder(orderId: EntityId): Promise<Order> {
    if (USE_MOCK) {
      return mockServer.getMyOrder(await sessionStore.getToken(), orderId);
    }
    return (await httpRequest<Order>(`/orders/${orderId}`)).data;
  },

  /** Customer cancels own PENDING order (operationId: cancelMyOrder). */
  async cancelMyOrder(orderId: EntityId): Promise<Order> {
    if (USE_MOCK) {
      return mockServer.cancelMyOrder(
        await sessionStore.getToken(),
        sessionStore.getCsrfToken(),
        orderId,
      );
    }
    return (
      await httpRequest<Order>(`/orders/${orderId}/cancel`, {
        method: 'POST',
        includeCsrf: true,
      })
    ).data;
  },

  /** Create a verified-purchase review (operationId: createReview). */
  async createReview(input: ReviewInput): Promise<Review> {
    if (USE_MOCK) {
      return mockServer.createReview(
        await sessionStore.getToken(),
        sessionStore.getCsrfToken(),
        input,
      );
    }
    return (
      await httpRequest<Review>('/reviews', { method: 'POST', body: input, includeCsrf: true })
    ).data;
  },

  /** Admin list all categories (operationId: listAdminCategorys). */
  async listAdminCategories(): Promise<Category[]> {
    if (USE_MOCK) {
      return mockServer.listAdminCategories(await sessionStore.getToken());
    }
    return (await httpRequest<Category[]>('/admin/categories')).data;
  },

  /** Admin create category (operationId: createAdminCategory). */
  async createAdminCategory(input: CategoryInput): Promise<Category> {
    if (USE_MOCK) {
      return mockServer.createAdminCategory(
        await sessionStore.getToken(),
        sessionStore.getCsrfToken(),
        input,
      );
    }
    return (
      await httpRequest<Category>('/admin/categories', {
        method: 'POST',
        body: input,
        includeCsrf: true,
      })
    ).data;
  },

  /** Admin update category (operationId: updateAdminCategory). */
  async updateAdminCategory(categoryId: EntityId, patch: CategoryPatch): Promise<Category> {
    if (USE_MOCK) {
      return mockServer.updateAdminCategory(
        await sessionStore.getToken(),
        sessionStore.getCsrfToken(),
        categoryId,
        patch,
      );
    }
    return (
      await httpRequest<Category>(`/admin/categories/${categoryId}`, {
        method: 'PATCH',
        body: patch,
        includeCsrf: true,
      })
    ).data;
  },

  /** Admin remove category (operationId: removeAdminCategory). */
  async removeAdminCategory(categoryId: EntityId): Promise<void> {
    if (USE_MOCK) {
      return mockServer.removeAdminCategory(
        await sessionStore.getToken(),
        sessionStore.getCsrfToken(),
        categoryId,
      );
    }
    await httpRequest<void>(`/admin/categories/${categoryId}`, {
      method: 'DELETE',
      includeCsrf: true,
    });
  },

  /** Admin list all products (operationId: listAdminProducts). */
  async listAdminProducts(page = 1, pageSize = 20): Promise<Paginated<Product>> {
    if (USE_MOCK) {
      return mockServer.listAdminProducts(await sessionStore.getToken(), page, pageSize);
    }
    return (
      await httpRequest<Paginated<Product>>(`/admin/products?page=${page}&pageSize=${pageSize}`)
    ).data;
  },

  /** Admin create product (operationId: createAdminProduct). */
  async createAdminProduct(input: ProductInput): Promise<Product> {
    if (USE_MOCK) {
      return mockServer.createAdminProduct(
        await sessionStore.getToken(),
        sessionStore.getCsrfToken(),
        input,
      );
    }
    return (
      await httpRequest<Product>('/admin/products', {
        method: 'POST',
        body: input,
        includeCsrf: true,
      })
    ).data;
  },

  /** Admin/Staff update product (operationId: updateAdminProduct). */
  async updateAdminProduct(productId: EntityId, patch: ProductPatch): Promise<Product> {
    if (USE_MOCK) {
      return mockServer.updateAdminProduct(
        await sessionStore.getToken(),
        sessionStore.getCsrfToken(),
        productId,
        patch,
      );
    }
    return (
      await httpRequest<Product>(`/admin/products/${productId}`, {
        method: 'PATCH',
        body: patch,
        includeCsrf: true,
      })
    ).data;
  },

  /** Admin remove product (operationId: removeAdminProduct). */
  async removeAdminProduct(productId: EntityId): Promise<void> {
    if (USE_MOCK) {
      return mockServer.removeAdminProduct(
        await sessionStore.getToken(),
        sessionStore.getCsrfToken(),
        productId,
      );
    }
    await httpRequest<void>(`/admin/products/${productId}`, {
      method: 'DELETE',
      includeCsrf: true,
    });
  },

  /** Admin list product variants (operationId: listAdminVariants). */
  async listAdminVariants(productId: EntityId): Promise<Variant[]> {
    if (USE_MOCK) {
      return mockServer.listAdminVariants(await sessionStore.getToken(), productId);
    }
    return (await httpRequest<Variant[]>(`/admin/products/${productId}/variants`)).data;
  },

  /** Admin create product variant (operationId: createAdminVariant). */
  async createAdminVariant(productId: EntityId, input: VariantInput): Promise<Variant> {
    if (USE_MOCK) {
      return mockServer.createAdminVariant(
        await sessionStore.getToken(),
        sessionStore.getCsrfToken(),
        productId,
        input,
      );
    }
    return (
      await httpRequest<Variant>(`/admin/products/${productId}/variants`, {
        method: 'POST',
        body: input,
        includeCsrf: true,
      })
    ).data;
  },

  /** Admin update product variant (operationId: updateAdminVariant). */
  async updateAdminVariant(
    productId: EntityId,
    variantId: EntityId,
    patch: VariantPatch,
  ): Promise<Variant> {
    if (USE_MOCK) {
      return mockServer.updateAdminVariant(
        await sessionStore.getToken(),
        sessionStore.getCsrfToken(),
        productId,
        variantId,
        patch,
      );
    }
    return (
      await httpRequest<Variant>(`/admin/products/${productId}/variants/${variantId}`, {
        method: 'PATCH',
        body: patch,
        includeCsrf: true,
      })
    ).data;
  },

  /** Admin remove product variant (operationId: removeAdminVariant). */
  async removeAdminVariant(productId: EntityId, variantId: EntityId): Promise<void> {
    if (USE_MOCK) {
      return mockServer.removeAdminVariant(
        await sessionStore.getToken(),
        sessionStore.getCsrfToken(),
        productId,
        variantId,
      );
    }
    await httpRequest<void>(`/admin/products/${productId}/variants/${variantId}`, {
      method: 'DELETE',
      includeCsrf: true,
    });
  },

  /** Admin/Staff list product images (operationId: listAdminImages). */
  async listAdminImages(productId: EntityId): Promise<ProductImage[]> {
    if (USE_MOCK) {
      return mockServer.listAdminImages(await sessionStore.getToken(), productId);
    }
    return (await httpRequest<ProductImage[]>(`/admin/products/${productId}/images`)).data;
  },

  /** Admin/Staff link image storageKey to product (operationId: createAdminImage). */
  async createAdminImage(productId: EntityId, input: ImageInput): Promise<ProductImage> {
    if (USE_MOCK) {
      return mockServer.createAdminImage(
        await sessionStore.getToken(),
        sessionStore.getCsrfToken(),
        productId,
        input,
      );
    }
    return (
      await httpRequest<ProductImage>(`/admin/products/${productId}/images`, {
        method: 'POST',
        body: input,
        includeCsrf: true,
      })
    ).data;
  },

  /** Admin/Staff update image metadata (operationId: updateAdminImage). */
  async updateAdminImage(
    productId: EntityId,
    imageId: EntityId,
    patch: ImagePatch,
  ): Promise<ProductImage> {
    if (USE_MOCK) {
      return mockServer.updateAdminImage(
        await sessionStore.getToken(),
        sessionStore.getCsrfToken(),
        productId,
        imageId,
        patch,
      );
    }
    return (
      await httpRequest<ProductImage>(`/admin/products/${productId}/images/${imageId}`, {
        method: 'PATCH',
        body: patch,
        includeCsrf: true,
      })
    ).data;
  },

  /** Admin/Staff remove image link (operationId: removeAdminImage). */
  async removeAdminImage(productId: EntityId, imageId: EntityId): Promise<void> {
    if (USE_MOCK) {
      return mockServer.removeAdminImage(
        await sessionStore.getToken(),
        sessionStore.getCsrfToken(),
        productId,
        imageId,
      );
    }
    await httpRequest<void>(`/admin/products/${productId}/images/${imageId}`, {
      method: 'DELETE',
      includeCsrf: true,
    });
  },

  /** Admin/Staff adjust variant stock with reason (operationId: adjustInventory). */
  async adjustInventory(variantId: EntityId, input: InventoryInput): Promise<InventoryMovement> {
    if (USE_MOCK) {
      return mockServer.adjustInventory(
        await sessionStore.getToken(),
        sessionStore.getCsrfToken(),
        variantId,
        input,
      );
    }
    return (
      await httpRequest<InventoryMovement>(`/admin/inventory/${variantId}/adjustments`, {
        method: 'POST',
        body: input,
        includeCsrf: true,
      })
    ).data;
  },

  /** Admin/Staff list inventory movement history (operationId: listInventoryAdjustments). */
  async listInventoryAdjustments(
    variantId: EntityId,
    page = 1,
    pageSize = 20,
  ): Promise<Paginated<InventoryMovementHistory>> {
    if (USE_MOCK) {
      return mockServer.listInventoryAdjustments(
        await sessionStore.getToken(),
        variantId,
        page,
        pageSize,
      );
    }
    return (
      await httpRequest<Paginated<InventoryMovementHistory>>(
        `/admin/inventory/${variantId}/adjustments?page=${page}&pageSize=${pageSize}`,
      )
    ).data;
  },

  /** Admin/Staff list orders (operationId: listAdminOrders). */
  async listAdminOrders(
    page = 1,
    pageSize = 20,
    status?: OrderStatus,
  ): Promise<Paginated<Order>> {
    if (USE_MOCK) {
      return mockServer.listAdminOrders(await sessionStore.getToken(), page, pageSize, status);
    }
    const statusParam = status ? `&status=${status}` : '';
    return (
      await httpRequest<Paginated<Order>>(
        `/admin/orders?page=${page}&pageSize=${pageSize}${statusParam}`,
      )
    ).data;
  },

  /** Admin/Staff get order detail (operationId: getAdminOrder). */
  async getAdminOrder(orderId: EntityId): Promise<Order> {
    if (USE_MOCK) {
      return mockServer.getAdminOrder(await sessionStore.getToken(), orderId);
    }
    return (await httpRequest<Order>(`/admin/orders/${orderId}`)).data;
  },

  /** Admin/Staff advance order status step (operationId: advanceAdminOrder). */
  async advanceAdminOrder(orderId: EntityId, input: OrderTransitionInput): Promise<Order> {
    if (USE_MOCK) {
      return mockServer.advanceAdminOrder(
        await sessionStore.getToken(),
        sessionStore.getCsrfToken(),
        orderId,
        input,
      );
    }
    return (
      await httpRequest<Order>(`/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        body: input,
        includeCsrf: true,
      })
    ).data;
  },

  /** Admin/Staff confirm delivery and simulated COD collection (operationId: confirmDeliveryAndCod). */
  async confirmDeliveryAndCod(orderId: EntityId): Promise<Order> {
    if (USE_MOCK) {
      return mockServer.confirmDeliveryAndCod(
        await sessionStore.getToken(),
        sessionStore.getCsrfToken(),
        orderId,
      );
    }
    return (
      await httpRequest<Order>(`/admin/orders/${orderId}/deliver`, {
        method: 'POST',
        includeCsrf: true,
      })
    ).data;
  },

  /** Admin/Staff cancel order prior to SHIPPING with reason (operationId: cancelAdminOrder). */
  async cancelAdminOrder(orderId: EntityId, input: CancellationInput): Promise<Order> {
    if (USE_MOCK) {
      return mockServer.cancelAdminOrder(
        await sessionStore.getToken(),
        sessionStore.getCsrfToken(),
        orderId,
        input,
      );
    }
    return (
      await httpRequest<Order>(`/admin/orders/${orderId}/cancel`, {
        method: 'POST',
        body: input,
        includeCsrf: true,
      })
    ).data;
  },

  /** Admin list reviews for moderation (operationId: listAdminReviews). */
  async listAdminReviews(
    page = 1,
    pageSize = 20,
    status?: 'VISIBLE' | 'HIDDEN',
  ): Promise<Paginated<AdminReview>> {
    if (USE_MOCK) {
      return mockServer.listAdminReviews(await sessionStore.getToken(), page, pageSize, status);
    }
    const statusParam = status ? `&status=${status}` : '';
    return (
      await httpRequest<Paginated<AdminReview>>(
        `/admin/reviews?page=${page}&pageSize=${pageSize}${statusParam}`,
      )
    ).data;
  },

  /** Admin toggle review visibility (operationId: moderateReview). */
  async moderateReview(reviewId: EntityId, input: ModerationInput): Promise<AdminReview> {
    if (USE_MOCK) {
      return mockServer.moderateReview(
        await sessionStore.getToken(),
        sessionStore.getCsrfToken(),
        reviewId,
        input,
      );
    }
    return (
      await httpRequest<AdminReview>(`/admin/reviews/${reviewId}/visibility`, {
        method: 'PATCH',
        body: input,
        includeCsrf: true,
      })
    ).data;
  },

  /** Admin list user accounts (operationId: listAdminUsers). */
  async listAdminUsers(
    page = 1,
    pageSize = 20,
    status?: 'ACTIVE' | 'DISABLED',
  ): Promise<Paginated<User>> {
    if (USE_MOCK) {
      return mockServer.listAdminUsers(await sessionStore.getToken(), page, pageSize, status);
    }
    const statusParam = status ? `&status=${status}` : '';
    return (
      await httpRequest<Paginated<User>>(
        `/admin/users?page=${page}&pageSize=${pageSize}${statusParam}`,
      )
    ).data;
  },

  /** Admin enable or disable an account (operationId: setAccountStatus). */
  async setAccountStatus(userId: EntityId, input: AccountStatusInput): Promise<User> {
    if (USE_MOCK) {
      return mockServer.setAccountStatus(
        await sessionStore.getToken(),
        sessionStore.getCsrfToken(),
        userId,
        input,
      );
    }
    return (
      await httpRequest<User>(`/admin/users/${userId}/status`, {
        method: 'PATCH',
        body: input,
        includeCsrf: true,
      })
    ).data;
  },

  /** MVP B helper: Admin updates Staff operational permissions in mock RBAC preview. */
  async setStaffPermissions(userId: EntityId, permissions: StaffPermission[]): Promise<User> {
    return mockServer.setStaffPermissions(
      await sessionStore.getToken(),
      sessionStore.getCsrfToken(),
      userId,
      permissions,
    );
  },

  /** Read mock AdminAuditLog records for operational traceability. */
  listAuditLogs(): AdminAuditLog[] {
    return USE_MOCK ? mockServer.listAuditLogs() : [];
  },
};
