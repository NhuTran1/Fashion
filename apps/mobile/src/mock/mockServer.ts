import {
  AccountStatusInput,
  Address,
  AddressInput,
  AddressPatch,
  AdminAuditLog,
  AdminReview,
  ApiClientError,
  CancellationInput,
  Cart,
  CartLine,
  CartLineView,
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
  MockFaultMode,
  ModerationInput,
  NativeSession,
  Order,
  OrderLine,
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
  WebSession,
} from '../types/api';
import {
  createRequestId,
  getLowestActivePrice,
  multiplyMoney,
  sumMoney,
  toMinorUnits,
} from '../utils/format';
import {
  buildGarmentArtUri,
  createInitialMockDatabase,
  MockDatabaseState,
  MockOrderRecord,
  MockReviewRecord,
  MockUserRecord,
} from './seedData';

interface MockSessionRecord {
  token: string;
  csrfToken: string;
  userId: EntityId;
  platform: 'web' | 'android';
  expiresAt: string;
  revokedAt: string | null;
}

/**
 * Stateful in-memory Mock Backend implementing all OpenAPI v1.0.0 operations
 * and MVP B Staff RBAC rules (docs/06-RBAC.md) so the frontend behaves identically
 * to the real NestJS + MySQL backend.
 */
class MockFashionServer {
  private db: MockDatabaseState = createInitialMockDatabase();
  private sessions = new Map<string, MockSessionRecord>();
  private latencyMs = 180;
  private nextFault: MockFaultMode = 'NONE';

  /** Reset the entire mock database and active sessions back to initial seed state. */
  reset(): void {
    this.db = createInitialMockDatabase();
    this.sessions.clear();
    this.nextFault = 'NONE';
  }

  /** Configure simulated artificial network delay in milliseconds. */
  setLatency(ms: number): void {
    this.latencyMs = Math.max(0, ms);
  }

  /** Arm a one-shot fault injection mode to test UI error handling and recovery. */
  setNextFault(mode: MockFaultMode): void {
    this.nextFault = mode;
  }

  /** Read the currently armed one-shot fault injection mode. */
  getNextFault(): MockFaultMode {
    return this.nextFault;
  }

  /** Return all stored storageKeys available for Admin Image creation (ADR-0004). */
  listAvailableStorageKeys(): string[] {
    return Object.keys(this.db.imageStorageMap);
  }

  /** Read recent AdminAuditLog entries for inspection in Admin UI. */
  listAuditLogs(): AdminAuditLog[] {
    return [...this.db.auditLogs].sort((a, b) => Number(b.id) - Number(a.id));
  }

  /** Allocate a monotonically increasing numeric string ID matching MySQL BIGINT PK. */
  private allocId(): EntityId {
    this.db.nextId += 1;
    return String(this.db.nextId);
  }

  /** Simulate network latency and trigger any armed fault injection before executing logic. */
  private async simulateNetwork(requiresWriteCsrf = false): Promise<void> {
    if (this.latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    }
    const fault = this.nextFault;
    if (fault === 'NONE') {
      return;
    }
    this.nextFault = 'NONE';
    if (fault === 'INTERNAL_ERROR') {
      throw this.fail(500, 'INTERNAL_ERROR', 'Máy chủ mô phỏng gặp sự cố tạm thời.');
    }
    if (fault === 'NETWORK_TIMEOUT') {
      throw this.fail(
        504,
        'NETWORK_TIMEOUT',
        'Không nhận được phản hồi từ máy chủ. Nếu đang checkout, giữ nguyên Idempotency-Key để thử lại.',
      );
    }
    if (fault === 'SESSION_EXPIRED') {
      throw this.fail(401, 'UNAUTHENTICATED', 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }
    if (fault === 'CSRF_INVALID' && requiresWriteCsrf) {
      throw this.fail(403, 'CSRF_INVALID', 'Mã xác thực CSRF không khớp hoặc đã hết hạn.');
    }
    if (fault === 'OUT_OF_STOCK') {
      throw this.fail(409, 'OUT_OF_STOCK', 'Số lượng tồn kho thực tế vừa thay đổi và không đủ đáp ứng.');
    }
  }

  /** Construct an ApiClientError conforming to OpenAPI components.schemas.Error. */
  private fail(
    status: number,
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ): ApiClientError {
    return new ApiClientError(status, {
      code,
      message,
      details,
      requestId: createRequestId(),
    });
  }

  /** Strip password hash/plaintext before returning a public User DTO. */
  private sanitizeUser(user: MockUserRecord): User {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      ...(user.permissions ? { permissions: [...user.permissions] } : {}),
    };
  }

  /** Authenticate an incoming session token + optional CSRF check on Web mutations. */
  private requireSession(
    token: string | null,
    csrfToken?: string | null,
    requireCsrf = false,
  ): { session: MockSessionRecord; user: MockUserRecord } {
    if (!token) {
      throw this.fail(401, 'UNAUTHENTICATED', 'Vui lòng đăng nhập để tiếp tục.');
    }
    const session = this.sessions.get(token);
    if (!session || session.revokedAt || new Date(session.expiresAt).getTime() <= Date.now()) {
      throw this.fail(401, 'UNAUTHENTICATED', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
    }
    const user = this.db.users.find((u) => u.id === session.userId);
    if (!user || user.status !== 'ACTIVE') {
      session.revokedAt = new Date().toISOString();
      throw this.fail(401, 'UNAUTHENTICATED', 'Tài khoản đã bị khóa hoặc không còn hoạt động.');
    }
    if (requireCsrf && session.platform === 'web' && csrfToken !== session.csrfToken) {
      throw this.fail(403, 'CSRF_INVALID', 'CSRF token không hợp lệ.');
    }
    return { session, user };
  }

  /** Ensure the authenticated caller is a CUSTOMER. */
  private requireCustomer(
    token: string | null,
    csrfToken?: string | null,
    requireCsrf = false,
  ): MockUserRecord {
    const { user } = this.requireSession(token, csrfToken, requireCsrf);
    if (user.role !== 'CUSTOMER') {
      throw this.fail(403, 'FORBIDDEN', 'Thao tác này chỉ dành cho tài khoản Khách hàng.');
    }
    return user;
  }

  /** Ensure the authenticated caller is ADMIN or a STAFF with the required permission. */
  private requireAdminOrStaff(
    token: string | null,
    csrfToken: string | null | undefined,
    requireCsrf: boolean,
    staffPermission?: StaffPermission,
  ): MockUserRecord {
    const { user } = this.requireSession(token, csrfToken, requireCsrf);
    if (user.role === 'ADMIN') {
      return user;
    }
    if (user.role === 'STAFF') {
      if (staffPermission && user.permissions?.includes(staffPermission)) {
        return user;
      }
      throw this.fail(
        403,
        'FORBIDDEN',
        staffPermission
          ? `Tài khoản Staff thiếu quyền "${staffPermission}" để thực hiện thao tác này.`
          : 'Tài khoản Staff không có quyền truy cập khu vực quản trị này.',
      );
    }
    throw this.fail(403, 'FORBIDDEN', 'Bạn không có quyền truy cập khu vực quản trị.');
  }

  /** Append an entry to AdminAuditLog for traceability. */
  private writeAudit(
    actorUserId: EntityId,
    action: string,
    targetType: string,
    targetId: EntityId,
    metadata: Record<string, unknown>,
  ): void {
    this.db.auditLogs.push({
      id: this.allocId(),
      actorUserId,
      action,
      targetType,
      targetId,
      metadata,
      createdAt: new Date().toISOString(),
    });
  }

  /** Locate a variant and its parent product by variantId. */
  private findVariant(variantId: EntityId): { product: Product; variant: Variant } | null {
    for (const product of this.db.products) {
      const variant = product.variants.find((v) => v.id === variantId);
      if (variant) {
        return { product, variant };
      }
    }
    return null;
  }

  /** Build a server-validated Cart response from persisted CartLine items. */
  private buildCartView(userId: EntityId): Cart {
    const rawLines = this.db.cartsByUser[userId] ?? [];
    const viewItems: CartLineView[] = [];
    for (const line of rawLines) {
      const found = this.findVariant(line.variantId);
      if (!found || found.product.status !== 'ACTIVE' || found.variant.status !== 'ACTIVE') {
        continue;
      }
      const unitPrice = found.variant.price;
      viewItems.push({
        variantId: line.variantId,
        quantity: line.quantity,
        unitPrice,
        lineTotal: multiplyMoney(unitPrice, line.quantity),
      });
    }
    return {
      items: viewItems,
      subtotal: sumMoney(viewItems.map((i) => i.lineTotal)),
    };
  }

  /** Strip internal idempotency fields before returning an Order DTO. */
  private sanitizeOrder(order: MockOrderRecord): Order {
    return {
      id: order.id,
      status: order.status,
      paymentStatus: order.paymentStatus,
      subtotal: order.subtotal,
      shippingFee: order.shippingFee,
      total: order.total,
      address: { ...order.address },
      items: order.items.map((i) => ({ ...i })),
      createdAt: order.createdAt,
      ...(order.cancelReason ? { cancelReason: order.cancelReason } : {}),
    };
  }

  /** Compute a deterministic fingerprint for checkout idempotency validation (M1-06). */
  private computeCheckoutFingerprint(input: CheckoutInput): string {
    const normalizedItems = [...input.items]
      .sort((a, b) => Number(a.variantId) - Number(b.variantId))
      .map((i) => `${i.variantId}:${i.quantity}`)
      .join('|');
    return `${input.addressId}|${input.method}|${normalizedItems}`;
  }

  /** Public customer registration (operationId: registerCustomer). Never creates Admin/Staff. */
  async registerCustomer(input: Credentials): Promise<User> {
    await this.simulateNetwork();
    const email = input.email.trim().toLowerCase();
    if (!email.includes('@') || input.password.length < 6) {
      throw this.fail(400, 'VALIDATION_ERROR', 'Email không hợp lệ hoặc mật khẩu dưới 6 ký tự.');
    }
    if (this.db.users.some((u) => u.email.toLowerCase() === email)) {
      throw this.fail(409, 'EMAIL_ALREADY_EXISTS', 'Email này đã được đăng ký.');
    }
    const created: MockUserRecord = {
      id: this.allocId(),
      email,
      password: input.password,
      role: 'CUSTOMER',
      status: 'ACTIVE',
    };
    this.db.users.push(created);
    this.db.addressesByUser[created.id] = [];
    this.db.cartsByUser[created.id] = [];
    return this.sanitizeUser(created);
  }

  /** Web login creating cookie-mode session and CSRF token (operationId: loginWeb). */
  async loginWeb(input: Credentials): Promise<{ sessionToken: string; payload: WebSession }> {
    await this.simulateNetwork();
    const user = this.authenticateCredentials(input);
    const token = `web-sess-${this.allocId()}-${Math.random().toString(36).slice(2, 10)}`;
    const csrfToken = `csrf-${Math.random().toString(36).slice(2, 12)}`;
    const ttlMs = user.role === 'CUSTOMER' ? 7 * 86400_000 : 8 * 3600_000;
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();
    this.sessions.set(token, {
      token,
      csrfToken,
      userId: user.id,
      platform: 'web',
      expiresAt,
      revokedAt: null,
    });
    return {
      sessionToken: token,
      payload: { user: this.sanitizeUser(user), csrfToken, expiresAt },
    };
  }

  /** Android native login returning opaque Bearer token (operationId: loginAndroid). */
  async loginAndroid(input: Credentials): Promise<NativeSession> {
    await this.simulateNetwork();
    const user = this.authenticateCredentials(input);
    if (user.role !== 'CUSTOMER') {
      throw this.fail(403, 'FORBIDDEN', 'Ứng dụng Android chỉ hỗ trợ đăng nhập Customer.');
    }
    const token = `opaque-tok-${this.allocId()}-${Math.random().toString(36).slice(2, 10)}`;
    const expiresAt = new Date(Date.now() + 7 * 86400_000).toISOString();
    this.sessions.set(token, {
      token,
      csrfToken: '',
      userId: user.id,
      platform: 'android',
      expiresAt,
      revokedAt: null,
    });
    return { user: this.sanitizeUser(user), token, expiresAt };
  }

  /** Validate email, password, and ACTIVE account status for login operations. */
  private authenticateCredentials(input: Credentials): MockUserRecord {
    const email = input.email.trim().toLowerCase();
    const user = this.db.users.find((u) => u.email.toLowerCase() === email);
    if (!user || user.password !== input.password) {
      throw this.fail(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không chính xác.');
    }
    if (user.status !== 'ACTIVE') {
      throw this.fail(403, 'FORBIDDEN', 'Tài khoản đã bị vô hiệu hóa bởi quản trị viên.');
    }
    return user;
  }

  /** Read Web CSRF token bound to active session (operationId: readWebCsrf). */
  async readWebCsrf(token: string | null): Promise<CsrfResponse> {
    await this.simulateNetwork();
    const { session } = this.requireSession(token);
    return { csrfToken: session.csrfToken };
  }

  /** Revoke current session (operationId: logout). */
  async logout(token: string | null, csrfToken?: string | null): Promise<void> {
    await this.simulateNetwork(true);
    const { session } = this.requireSession(token, csrfToken, true);
    session.revokedAt = new Date().toISOString();
  }

  /** Return current authenticated user profile (operationId: getMe). */
  async getMe(token: string | null): Promise<User> {
    await this.simulateNetwork();
    const { user } = this.requireSession(token);
    return this.sanitizeUser(user);
  }

  /** List Customer's saved shipping addresses (operationId: listAddresses). */
  async listAddresses(token: string | null): Promise<Address[]> {
    await this.simulateNetwork();
    const user = this.requireCustomer(token);
    return [...(this.db.addressesByUser[user.id] ?? [])].map((a) => ({ ...a }));
  }

  /** Create a new shipping address for authenticated Customer (operationId: createAddress). */
  async createAddress(
    token: string | null,
    csrfToken: string | null | undefined,
    input: AddressInput,
  ): Promise<Address> {
    await this.simulateNetwork(true);
    const user = this.requireCustomer(token, csrfToken, true);
    if (!input.name.trim() || !input.phone.trim() || !input.addressText.trim()) {
      throw this.fail(400, 'VALIDATION_ERROR', 'Vui lòng điền đầy đủ họ tên, số điện thoại và địa chỉ.');
    }
    const existing = this.db.addressesByUser[user.id] ?? [];
    const makeDefault = Boolean(input.isDefault) || existing.length === 0;
    if (makeDefault) {
      existing.forEach((a) => {
        a.isDefault = false;
      });
    }
    const created: Address = {
      id: this.allocId(),
      name: input.name.trim(),
      phone: input.phone.trim(),
      addressText: input.addressText.trim(),
      isDefault: makeDefault,
    };
    existing.push(created);
    this.db.addressesByUser[user.id] = existing;
    return { ...created };
  }

  /** Update an owned Customer shipping address (operationId: updateAddress). */
  async updateAddress(
    token: string | null,
    csrfToken: string | null | undefined,
    addressId: EntityId,
    patch: AddressPatch,
  ): Promise<Address> {
    await this.simulateNetwork(true);
    const user = this.requireCustomer(token, csrfToken, true);
    const list = this.db.addressesByUser[user.id] ?? [];
    const target = list.find((a) => a.id === addressId);
    if (!target) {
      throw this.fail(404, 'NOT_FOUND', 'Không tìm thấy địa chỉ.');
    }
    if (patch.isDefault) {
      list.forEach((a) => {
        a.isDefault = false;
      });
    }
    if (patch.name !== undefined) target.name = patch.name.trim();
    if (patch.phone !== undefined) target.phone = patch.phone.trim();
    if (patch.addressText !== undefined) target.addressText = patch.addressText.trim();
    if (patch.isDefault !== undefined) target.isDefault = patch.isDefault;
    return { ...target };
  }

  /** Public list of ACTIVE categories (operationId: listCategories). */
  async listCategories(): Promise<Category[]> {
    await this.simulateNetwork();
    return this.db.categories.filter((c) => c.status === 'ACTIVE').map((c) => ({ ...c }));
  }

  /** Public paginated catalog search/filter/sort returning ACTIVE products & variants (operationId: listProducts). */
  async listProducts(params: ProductQueryParams = {}): Promise<Paginated<Product>> {
    await this.simulateNetwork();
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const q = params.q?.trim().toLowerCase();

    const activeCategoryIds = new Set(
      this.db.categories.filter((c) => c.status === 'ACTIVE').map((c) => c.id),
    );

    let filtered = this.db.products
      .filter((p) => p.status === 'ACTIVE' && activeCategoryIds.has(p.categoryId))
      .map((p) => ({
        ...p,
        variants: p.variants.filter((v) => v.status === 'ACTIVE').map((v) => ({ ...v })),
        images: [...p.images].sort((a, b) => a.sortOrder - b.sortOrder).map((i) => ({ ...i })),
      }))
      .filter((p) => p.variants.length > 0);

    if (q) {
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.variants.some((v) => v.sku.toLowerCase().includes(q)),
      );
    }
    if (params.categoryId) {
      filtered = filtered.filter((p) => p.categoryId === params.categoryId);
    }
    if (params.size) {
      filtered = filtered.filter((p) => p.variants.some((v) => v.size === params.size));
    }
    if (params.color) {
      filtered = filtered.filter((p) => p.variants.some((v) => v.color === params.color));
    }

    const sort = params.sort ?? 'NEWEST';
    filtered.sort((a, b) => {
      if (sort === 'PRICE_ASC') {
        const diff = toMinorUnits(getLowestActivePrice(a)) - toMinorUnits(getLowestActivePrice(b));
        return diff !== 0 ? diff : Number(a.id) - Number(b.id);
      }
      if (sort === 'PRICE_DESC') {
        const diff = toMinorUnits(getLowestActivePrice(b)) - toMinorUnits(getLowestActivePrice(a));
        return diff !== 0 ? diff : Number(b.id) - Number(a.id);
      }
      return Number(b.id) - Number(a.id);
    });

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    return {
      items: filtered.slice(start, start + pageSize),
      page,
      pageSize,
      total,
    };
  }

  /** Public product detail returning only ACTIVE product and ACTIVE variants (operationId: getProduct). */
  async getProduct(productId: EntityId): Promise<Product> {
    await this.simulateNetwork();
    const product = this.db.products.find((p) => p.id === productId && p.status === 'ACTIVE');
    if (!product) {
      throw this.fail(404, 'NOT_FOUND', 'Sản phẩm không tồn tại hoặc đã ngừng kinh doanh.');
    }
    return {
      ...product,
      variants: product.variants.filter((v) => v.status === 'ACTIVE').map((v) => ({ ...v })),
      images: [...product.images].sort((a, b) => a.sortOrder - b.sortOrder).map((i) => ({ ...i })),
    };
  }

  /** Public paginated list of VISIBLE reviews for a public product (operationId: listProductReviews). */
  async listProductReviews(
    productId: EntityId,
    page = 1,
    pageSize = 20,
  ): Promise<Paginated<Review>> {
    await this.simulateNetwork();
    const exists = this.db.products.some((p) => p.id === productId && p.status === 'ACTIVE');
    if (!exists) {
      throw this.fail(404, 'NOT_FOUND', 'Không tìm thấy sản phẩm.');
    }
    const visible = this.db.reviews
      .filter((r) => r.productId === productId && r.status === 'VISIBLE')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || Number(b.id) - Number(a.id))
      .map(({ id, productId: pid, rating, content, createdAt }) => ({
        id,
        productId: pid,
        rating,
        content,
        createdAt,
      }));
    const start = (page - 1) * pageSize;
    return {
      items: visible.slice(start, start + pageSize),
      page,
      pageSize,
      total: visible.length,
    };
  }

  /** Read authenticated Customer's cart (operationId: getCart). */
  async getCart(token: string | null): Promise<Cart> {
    await this.simulateNetwork();
    const user = this.requireCustomer(token);
    return this.buildCartView(user.id);
  }

  /** Add quantity to a variant SKU in Customer's cart (operationId: addCartItem). */
  async addCartItem(
    token: string | null,
    csrfToken: string | null | undefined,
    input: CartLine,
  ): Promise<Cart> {
    await this.simulateNetwork(true);
    const user = this.requireCustomer(token, csrfToken, true);
    if (!Number.isInteger(input.quantity) || input.quantity < 1) {
      throw this.fail(400, 'VALIDATION_ERROR', 'Số lượng thêm vào giỏ phải >= 1.');
    }
    const found = this.findVariant(input.variantId);
    if (!found || found.product.status !== 'ACTIVE' || found.variant.status !== 'ACTIVE') {
      throw this.fail(404, 'NOT_FOUND', 'Biến thể sản phẩm không khả dụng.');
    }
    const cart = this.db.cartsByUser[user.id] ?? [];
    const existing = cart.find((c) => c.variantId === input.variantId);
    const nextQty = (existing?.quantity ?? 0) + input.quantity;
    if (nextQty > found.variant.stockQuantity) {
      throw this.fail(
        409,
        'OUT_OF_STOCK',
        `Tồn kho chỉ còn ${found.variant.stockQuantity} sản phẩm cho ${found.variant.sku}.`,
        { availableStock: found.variant.stockQuantity },
      );
    }
    if (existing) {
      existing.quantity = nextQty;
    } else {
      cart.push({ variantId: input.variantId, quantity: nextQty });
    }
    this.db.cartsByUser[user.id] = cart;
    return this.buildCartView(user.id);
  }

  /** Set exact quantity for a variant line in Customer's cart (operationId: setCartItemQuantity). */
  async setCartItemQuantity(
    token: string | null,
    csrfToken: string | null | undefined,
    variantId: EntityId,
    input: QuantityInput,
  ): Promise<Cart> {
    await this.simulateNetwork(true);
    const user = this.requireCustomer(token, csrfToken, true);
    if (!Number.isInteger(input.quantity) || input.quantity < 1) {
      throw this.fail(400, 'VALIDATION_ERROR', 'Số lượng phải là số nguyên >= 1.');
    }
    const cart = this.db.cartsByUser[user.id] ?? [];
    const line = cart.find((c) => c.variantId === variantId);
    if (!line) {
      throw this.fail(404, 'NOT_FOUND', 'Dòng sản phẩm không có trong giỏ.');
    }
    const found = this.findVariant(variantId);
    if (!found || input.quantity > found.variant.stockQuantity) {
      throw this.fail(
        409,
        'OUT_OF_STOCK',
        `Số lượng yêu cầu vượt tồn kho hiện tại (${found?.variant.stockQuantity ?? 0}).`,
      );
    }
    line.quantity = input.quantity;
    return this.buildCartView(user.id);
  }

  /** Remove a variant line from Customer's cart (operationId: removeCartItem). */
  async removeCartItem(
    token: string | null,
    csrfToken: string | null | undefined,
    variantId: EntityId,
  ): Promise<void> {
    await this.simulateNetwork(true);
    const user = this.requireCustomer(token, csrfToken, true);
    const cart = this.db.cartsByUser[user.id] ?? [];
    const idx = cart.findIndex((c) => c.variantId === variantId);
    if (idx === -1) {
      throw this.fail(404, 'NOT_FOUND', 'Không tìm thấy sản phẩm trong giỏ.');
    }
    cart.splice(idx, 1);
  }

  /**
   * Place a simulated COD order atomically with Idempotency-Key & fingerprint check
   * (operationId: checkoutCod). Returns replayed=true (200) on exact retry.
   */
  async checkoutCod(
    token: string | null,
    csrfToken: string | null | undefined,
    idempotencyKey: string,
    input: CheckoutInput,
  ): Promise<CheckoutResult> {
    await this.simulateNetwork(true);
    const user = this.requireCustomer(token, csrfToken, true);
    if (!idempotencyKey.trim()) {
      throw this.fail(400, 'VALIDATION_ERROR', 'Thiếu header Idempotency-Key.');
    }
    const fingerprint = this.computeCheckoutFingerprint(input);
    const existing = this.db.orders.find(
      (o) => o.userId === user.id && o.idempotencyKey === idempotencyKey,
    );
    if (existing) {
      if (existing.requestFingerprint !== fingerprint) {
        throw this.fail(
          409,
          'IDEMPOTENCY_CONFLICT',
          'Idempotency-Key này đã dùng cho một đơn khác. Kiểm tra lịch sử đơn trước khi đặt lại.',
        );
      }
      return { order: this.sanitizeOrder(existing), replayed: true };
    }

    const addresses = this.db.addressesByUser[user.id] ?? [];
    const address = addresses.find((a) => a.id === input.addressId);
    if (!address) {
      throw this.fail(404, 'NOT_FOUND', 'Địa chỉ giao hàng không tồn tại.');
    }

    const cart = this.db.cartsByUser[user.id] ?? [];
    if (cart.length === 0) {
      throw this.fail(409, 'CART_CHANGED', 'Giỏ hàng đang trống hoặc đã thay đổi.');
    }
    const cartFingerprint = [...cart]
      .sort((a, b) => Number(a.variantId) - Number(b.variantId))
      .map((i) => `${i.variantId}:${i.quantity}`)
      .join('|');
    const reqItemsFingerprint = [...input.items]
      .sort((a, b) => Number(a.variantId) - Number(b.variantId))
      .map((i) => `${i.variantId}:${i.quantity}`)
      .join('|');
    if (cartFingerprint !== reqItemsFingerprint) {
      throw this.fail(
        409,
        'CART_CHANGED',
        'Giỏ hàng đã thay đổi trước khi đặt. Vui lòng kiểm tra lại giỏ hàng.',
      );
    }

    // Atomic validation pass before mutating any stock.
    const resolvedLines: Array<{ product: Product; variant: Variant; quantity: number }> = [];
    for (const line of input.items) {
      const found = this.findVariant(line.variantId);
      if (
        !found ||
        found.product.status !== 'ACTIVE' ||
        found.variant.status !== 'ACTIVE' ||
        found.variant.stockQuantity < line.quantity
      ) {
        throw this.fail(
          409,
          'OUT_OF_STOCK',
          `Biến thể ${found?.variant.sku ?? line.variantId} không đủ tồn kho.`,
        );
      }
      resolvedLines.push({ product: found.product, variant: found.variant, quantity: line.quantity });
    }

    const orderId = this.allocId();
    const now = new Date().toISOString();
    const orderItems: OrderLine[] = resolvedLines.map(({ product, variant, quantity }) => {
      variant.stockQuantity -= quantity;
      this.db.inventoryMovements.push({
        id: this.allocId(),
        variantId: variant.id,
        orderId,
        actorUserId: user.id,
        delta: -quantity,
        reason: `Checkout đơn #${orderId}`,
        stockQuantity: variant.stockQuantity,
        createdAt: now,
      });
      return {
        id: this.allocId(),
        variantId: variant.id,
        sku: variant.sku,
        name: product.name,
        size: variant.size,
        color: variant.color,
        quantity,
        unitPrice: variant.price,
        lineTotal: multiplyMoney(variant.price, quantity),
      };
    });

    const subtotal = sumMoney(orderItems.map((i) => i.lineTotal));
    const shippingFee = '0.00';
    const orderRecord: MockOrderRecord = {
      id: orderId,
      userId: user.id,
      status: 'PENDING',
      paymentStatus: 'UNPAID',
      subtotal,
      shippingFee,
      total: subtotal,
      address: {
        name: address.name,
        phone: address.phone,
        addressText: address.addressText,
      },
      items: orderItems,
      createdAt: now,
      idempotencyKey,
      requestFingerprint: fingerprint,
      restocked: false,
    };
    this.db.orders.push(orderRecord);
    this.db.cartsByUser[user.id] = [];

    return { order: this.sanitizeOrder(orderRecord), replayed: false };
  }

  /** List Customer's own orders sorted newest first (operationId: listMyOrders). */
  async listMyOrders(token: string | null, page = 1, pageSize = 20): Promise<Paginated<Order>> {
    await this.simulateNetwork();
    const user = this.requireCustomer(token);
    const mine = this.db.orders
      .filter((o) => o.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || Number(b.id) - Number(a.id));
    const start = (page - 1) * pageSize;
    return {
      items: mine.slice(start, start + pageSize).map((o) => this.sanitizeOrder(o)),
      page,
      pageSize,
      total: mine.length,
    };
  }

  /** Read a single owned order (operationId: getMyOrder). Returns 404 if owned by another user. */
  async getMyOrder(token: string | null, orderId: EntityId): Promise<Order> {
    await this.simulateNetwork();
    const user = this.requireCustomer(token);
    const order = this.db.orders.find((o) => o.id === orderId && o.userId === user.id);
    if (!order) {
      throw this.fail(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng.');
    }
    return this.sanitizeOrder(order);
  }

  /** Customer cancels own PENDING order, restoring stock at most once (operationId: cancelMyOrder). */
  async cancelMyOrder(
    token: string | null,
    csrfToken: string | null | undefined,
    orderId: EntityId,
  ): Promise<Order> {
    await this.simulateNetwork(true);
    const user = this.requireCustomer(token, csrfToken, true);
    const order = this.db.orders.find((o) => o.id === orderId && o.userId === user.id);
    if (!order) {
      throw this.fail(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng.');
    }
    if (order.status === 'CANCELLED') {
      return this.sanitizeOrder(order);
    }
    if (order.status !== 'PENDING') {
      throw this.fail(
        409,
        'INVALID_ORDER_STATE',
        `Đơn hàng đã chuyển sang trạng thái ${order.status}, không thể hủy.`,
      );
    }
    this.restoreOrderStockOnce(order, user.id, 'Khách hàng tự hủy đơn ở trạng thái PENDING');
    order.status = 'CANCELLED';
    order.cancelReason = 'Khách hàng hủy đơn';
    return this.sanitizeOrder(order);
  }

  /** Restore inventory for each order item at most once per order cancellation. */
  private restoreOrderStockOnce(
    order: MockOrderRecord,
    actorUserId: EntityId,
    reasonPrefix: string,
  ): void {
    if (order.restocked) {
      return;
    }
    const now = new Date().toISOString();
    for (const line of order.items) {
      const found = this.findVariant(line.variantId);
      if (found) {
        found.variant.stockQuantity += line.quantity;
        this.db.inventoryMovements.push({
          id: this.allocId(),
          variantId: found.variant.id,
          orderId: order.id,
          actorUserId,
          delta: line.quantity,
          reason: `${reasonPrefix} (#${order.id})`,
          stockQuantity: found.variant.stockQuantity,
          createdAt: now,
        });
      }
    }
    order.restocked = true;
  }

  /** Create a verified-purchase review for a DELIVERED order item (operationId: createReview). */
  async createReview(
    token: string | null,
    csrfToken: string | null | undefined,
    input: ReviewInput,
  ): Promise<Review> {
    await this.simulateNetwork(true);
    const user = this.requireCustomer(token, csrfToken, true);
    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
      throw this.fail(400, 'VALIDATION_ERROR', 'Điểm đánh giá phải là số nguyên từ 1 đến 5.');
    }
    if (!input.content.trim()) {
      throw this.fail(400, 'VALIDATION_ERROR', 'Vui lòng nhập nội dung đánh giá.');
    }

    let matchedOrder: MockOrderRecord | undefined;
    let matchedLine: OrderLine | undefined;
    for (const order of this.db.orders) {
      if (order.userId !== user.id) continue;
      const line = order.items.find((i) => i.id === input.orderItemId);
      if (line) {
        matchedOrder = order;
        matchedLine = line;
        break;
      }
    }
    if (!matchedOrder || !matchedLine) {
      throw this.fail(404, 'NOT_FOUND', 'Không tìm thấy dòng sản phẩm thuộc đơn hàng của bạn.');
    }
    if (matchedOrder.status !== 'DELIVERED') {
      throw this.fail(409, 'REVIEW_NOT_ELIGIBLE', 'Chỉ có thể đánh giá sau khi đơn đã giao thành công.');
    }
    if (this.db.reviews.some((r) => r.orderItemId === input.orderItemId)) {
      throw this.fail(409, 'REVIEW_ALREADY_EXISTS', 'Dòng sản phẩm này đã được đánh giá trước đó.');
    }
    const foundVariant = this.findVariant(matchedLine.variantId);
    if (!foundVariant) {
      throw this.fail(404, 'NOT_FOUND', 'Không xác định được sản phẩm gốc.');
    }

    const review: MockReviewRecord = {
      id: this.allocId(),
      productId: foundVariant.product.id,
      orderItemId: matchedLine.id,
      userId: user.id,
      rating: input.rating,
      content: input.content.trim(),
      createdAt: new Date().toISOString(),
      status: 'VISIBLE',
    };
    this.db.reviews.push(review);
    return {
      id: review.id,
      productId: review.productId,
      rating: review.rating,
      content: review.content,
      createdAt: review.createdAt,
    };
  }

  /** Admin list all categories including INACTIVE (operationId: listAdminCategorys). */
  async listAdminCategories(token: string | null): Promise<Category[]> {
    await this.simulateNetwork();
    this.requireAdminOrStaff(token, null, false, 'catalog.content.edit');
    return this.db.categories.map((c) => ({ ...c }));
  }

  /** Admin create category (operationId: createAdminCategory). */
  async createAdminCategory(
    token: string | null,
    csrfToken: string | null | undefined,
    input: CategoryInput,
  ): Promise<Category> {
    await this.simulateNetwork(true);
    this.requireAdminOrStaff(token, csrfToken, true);
    if (!input.name.trim() || !input.slug.trim()) {
      throw this.fail(400, 'VALIDATION_ERROR', 'Tên và slug danh mục không được để trống.');
    }
    if (this.db.categories.some((c) => c.slug === input.slug.trim())) {
      throw this.fail(409, 'RESOURCE_CONFLICT', 'Slug danh mục đã tồn tại.');
    }
    const created: Category = {
      id: this.allocId(),
      name: input.name.trim(),
      slug: input.slug.trim(),
      status: input.status,
    };
    this.db.categories.push(created);
    return { ...created };
  }

  /** Admin update category (operationId: updateAdminCategory). */
  async updateAdminCategory(
    token: string | null,
    csrfToken: string | null | undefined,
    categoryId: EntityId,
    patch: CategoryPatch,
  ): Promise<Category> {
    await this.simulateNetwork(true);
    this.requireAdminOrStaff(token, csrfToken, true);
    const cat = this.db.categories.find((c) => c.id === categoryId);
    if (!cat) throw this.fail(404, 'NOT_FOUND', 'Không tìm thấy danh mục.');
    if (patch.slug && this.db.categories.some((c) => c.slug === patch.slug && c.id !== categoryId)) {
      throw this.fail(409, 'RESOURCE_CONFLICT', 'Slug danh mục bị trùng.');
    }
    if (patch.name !== undefined) cat.name = patch.name.trim();
    if (patch.slug !== undefined) cat.slug = patch.slug.trim();
    if (patch.status !== undefined) cat.status = patch.status;
    return { ...cat };
  }

  /** Admin delete category if unreferenced by products (operationId: removeAdminCategory). */
  async removeAdminCategory(
    token: string | null,
    csrfToken: string | null | undefined,
    categoryId: EntityId,
  ): Promise<void> {
    await this.simulateNetwork(true);
    this.requireAdminOrStaff(token, csrfToken, true);
    const idx = this.db.categories.findIndex((c) => c.id === categoryId);
    if (idx === -1) throw this.fail(404, 'NOT_FOUND', 'Không tìm thấy danh mục.');
    if (this.db.products.some((p) => p.categoryId === categoryId)) {
      throw this.fail(
        409,
        'RESOURCE_CONFLICT',
        'Danh mục đang có sản phẩm tham chiếu. Hãy chuyển trạng thái sang INACTIVE thay vì xóa.',
      );
    }
    this.db.categories.splice(idx, 1);
  }

  /** Admin list all products including INACTIVE drafts (operationId: listAdminProducts). */
  async listAdminProducts(
    token: string | null,
    page = 1,
    pageSize = 20,
  ): Promise<Paginated<Product>> {
    await this.simulateNetwork();
    this.requireAdminOrStaff(token, null, false, 'catalog.content.edit');
    const sorted = [...this.db.products].sort((a, b) => Number(b.id) - Number(a.id));
    const start = (page - 1) * pageSize;
    return {
      items: sorted.slice(start, start + pageSize).map((p) => ({
        ...p,
        variants: p.variants.map((v) => ({ ...v })),
        images: [...p.images].sort((a, b) => a.sortOrder - b.sortOrder).map((i) => ({ ...i })),
      })),
      page,
      pageSize,
      total: sorted.length,
    };
  }

  /** Admin create product (operationId: createAdminProduct). */
  async createAdminProduct(
    token: string | null,
    csrfToken: string | null | undefined,
    input: ProductInput,
  ): Promise<Product> {
    await this.simulateNetwork(true);
    this.requireAdminOrStaff(token, csrfToken, true);
    if (!input.name.trim() || !input.slug.trim()) {
      throw this.fail(400, 'VALIDATION_ERROR', 'Tên và slug sản phẩm bắt buộc.');
    }
    if (this.db.products.some((p) => p.slug === input.slug.trim())) {
      throw this.fail(409, 'RESOURCE_CONFLICT', 'Slug sản phẩm đã tồn tại.');
    }
    const created: Product = {
      id: this.allocId(),
      categoryId: input.categoryId,
      name: input.name.trim(),
      slug: input.slug.trim(),
      description: input.description.trim(),
      status: input.status,
      variants: [],
      images: [],
    };
    this.db.products.push(created);
    return { ...created };
  }

  /** Admin/Staff update product; Staff with catalog.content.edit can only update description (operationId: updateAdminProduct). */
  async updateAdminProduct(
    token: string | null,
    csrfToken: string | null | undefined,
    productId: EntityId,
    patch: ProductPatch,
  ): Promise<Product> {
    await this.simulateNetwork(true);
    const actor = this.requireAdminOrStaff(token, csrfToken, true, 'catalog.content.edit');
    const product = this.db.products.find((p) => p.id === productId);
    if (!product) throw this.fail(404, 'NOT_FOUND', 'Không tìm thấy sản phẩm.');
    if (actor.role === 'STAFF') {
      if (
        patch.name !== undefined ||
        patch.slug !== undefined ||
        patch.categoryId !== undefined ||
        patch.status !== undefined
      ) {
        throw this.fail(
          403,
          'FORBIDDEN',
          'Staff chỉ được sửa mô tả hoặc ảnh sản phẩm; tạo/xóa/xuất bản thuộc Admin.',
        );
      }
    }
    if (patch.slug && this.db.products.some((p) => p.slug === patch.slug && p.id !== productId)) {
      throw this.fail(409, 'RESOURCE_CONFLICT', 'Slug sản phẩm bị trùng.');
    }
    if (patch.categoryId !== undefined) product.categoryId = patch.categoryId;
    if (patch.name !== undefined) product.name = patch.name.trim();
    if (patch.slug !== undefined) product.slug = patch.slug.trim();
    if (patch.description !== undefined) product.description = patch.description.trim();
    if (patch.status !== undefined) product.status = patch.status;
    return {
      ...product,
      variants: product.variants.map((v) => ({ ...v })),
      images: product.images.map((i) => ({ ...i })),
    };
  }

  /** Admin remove product if unreferenced by orders (operationId: removeAdminProduct). */
  async removeAdminProduct(
    token: string | null,
    csrfToken: string | null | undefined,
    productId: EntityId,
  ): Promise<void> {
    await this.simulateNetwork(true);
    this.requireAdminOrStaff(token, csrfToken, true);
    const idx = this.db.products.findIndex((p) => p.id === productId);
    if (idx === -1) throw this.fail(404, 'NOT_FOUND', 'Không tìm thấy sản phẩm.');
    const variantIds = new Set(this.db.products[idx].variants.map((v) => v.id));
    const usedInOrder = this.db.orders.some((o) => o.items.some((i) => variantIds.has(i.variantId)));
    if (usedInOrder) {
      throw this.fail(
        409,
        'RESOURCE_CONFLICT',
        'Sản phẩm đã phát sinh đơn hàng. Vui lòng đổi sang trạng thái INACTIVE.',
      );
    }
    this.db.products.splice(idx, 1);
  }

  /** Admin list variants of a product (operationId: listAdminVariants). */
  async listAdminVariants(token: string | null, productId: EntityId): Promise<Variant[]> {
    await this.simulateNetwork();
    this.requireAdminOrStaff(token, null, false, 'inventory.adjust');
    const product = this.db.products.find((p) => p.id === productId);
    if (!product) throw this.fail(404, 'NOT_FOUND', 'Không tìm thấy sản phẩm.');
    return product.variants.map((v) => ({ ...v }));
  }

  /** Admin create variant starting with stockQuantity = 0 (operationId: createAdminVariant). */
  async createAdminVariant(
    token: string | null,
    csrfToken: string | null | undefined,
    productId: EntityId,
    input: VariantInput,
  ): Promise<Variant> {
    await this.simulateNetwork(true);
    this.requireAdminOrStaff(token, csrfToken, true);
    const product = this.db.products.find((p) => p.id === productId);
    if (!product) throw this.fail(404, 'NOT_FOUND', 'Không tìm thấy sản phẩm.');
    const sku = input.sku.trim().toUpperCase();
    if (!sku || !/^[0-9]{1,10}\.[0-9]{2}$/.test(input.price)) {
      throw this.fail(400, 'VALIDATION_ERROR', 'SKU hoặc giá Decimal (xx.00) không hợp lệ.');
    }
    const skuDuplicate = this.db.products.some((p) => p.variants.some((v) => v.sku === sku));
    if (skuDuplicate) {
      throw this.fail(409, 'RESOURCE_CONFLICT', `SKU ${sku} đã tồn tại.`);
    }
    const created: Variant = {
      id: this.allocId(),
      sku,
      size: input.size.trim(),
      color: input.color.trim(),
      price: input.price,
      stockQuantity: 0,
      status: input.status,
    };
    product.variants.push(created);
    return { ...created };
  }

  /** Admin update variant fields (operationId: updateAdminVariant). */
  async updateAdminVariant(
    token: string | null,
    csrfToken: string | null | undefined,
    productId: EntityId,
    variantId: EntityId,
    patch: VariantPatch,
  ): Promise<Variant> {
    await this.simulateNetwork(true);
    this.requireAdminOrStaff(token, csrfToken, true);
    const product = this.db.products.find((p) => p.id === productId);
    const variant = product?.variants.find((v) => v.id === variantId);
    if (!product || !variant) throw this.fail(404, 'NOT_FOUND', 'Không tìm thấy biến thể.');
    if (patch.sku !== undefined) {
      const nextSku = patch.sku.trim().toUpperCase();
      if (this.db.products.some((p) => p.variants.some((v) => v.sku === nextSku && v.id !== variantId))) {
        throw this.fail(409, 'RESOURCE_CONFLICT', 'SKU đã tồn tại.');
      }
      variant.sku = nextSku;
    }
    if (patch.price !== undefined) {
      if (!/^[0-9]{1,10}\.[0-9]{2}$/.test(patch.price)) {
        throw this.fail(400, 'VALIDATION_ERROR', 'Giá phải đúng định dạng Decimal hai chữ số (ví dụ 480000.00).');
      }
      variant.price = patch.price;
    }
    if (patch.size !== undefined) variant.size = patch.size.trim();
    if (patch.color !== undefined) variant.color = patch.color.trim();
    if (patch.status !== undefined) variant.status = patch.status;
    return { ...variant };
  }

  /** Admin delete variant if unreferenced (operationId: removeAdminVariant). */
  async removeAdminVariant(
    token: string | null,
    csrfToken: string | null | undefined,
    productId: EntityId,
    variantId: EntityId,
  ): Promise<void> {
    await this.simulateNetwork(true);
    this.requireAdminOrStaff(token, csrfToken, true);
    const product = this.db.products.find((p) => p.id === productId);
    const idx = product?.variants.findIndex((v) => v.id === variantId) ?? -1;
    if (!product || idx === -1) throw this.fail(404, 'NOT_FOUND', 'Không tìm thấy biến thể.');
    if (this.db.orders.some((o) => o.items.some((i) => i.variantId === variantId))) {
      throw this.fail(409, 'RESOURCE_CONFLICT', 'Biến thể đã có đơn hàng, hãy đặt trạng thái INACTIVE.');
    }
    product.variants.splice(idx, 1);
  }

  /** Admin/Staff list images of a product (operationId: listAdminImages). */
  async listAdminImages(token: string | null, productId: EntityId): Promise<ProductImage[]> {
    await this.simulateNetwork();
    this.requireAdminOrStaff(token, null, false, 'catalog.content.edit');
    const product = this.db.products.find((p) => p.id === productId);
    if (!product) throw this.fail(404, 'NOT_FOUND', 'Không tìm thấy sản phẩm.');
    return [...product.images].sort((a, b) => a.sortOrder - b.sortOrder).map((i) => ({ ...i }));
  }

  /** Admin/Staff link an existing storageKey image to a product (operationId: createAdminImage). */
  async createAdminImage(
    token: string | null,
    csrfToken: string | null | undefined,
    productId: EntityId,
    input: ImageInput,
  ): Promise<ProductImage> {
    await this.simulateNetwork(true);
    this.requireAdminOrStaff(token, csrfToken, true, 'catalog.content.edit');
    const product = this.db.products.find((p) => p.id === productId);
    if (!product) throw this.fail(404, 'NOT_FOUND', 'Không tìm thấy sản phẩm.');
    const resolved =
      this.db.imageStorageMap[input.storageKey.trim()] ??
      buildGarmentArtUri(input.altText || product.name, '#1E3A5F', 'shirt');
    const created: ProductImage = {
      id: this.allocId(),
      url: resolved,
      altText: input.altText?.trim() || product.name,
      sortOrder: input.sortOrder ?? product.images.length,
    };
    product.images.push(created);
    return { ...created };
  }

  /** Admin/Staff update image metadata (operationId: updateAdminImage). */
  async updateAdminImage(
    token: string | null,
    csrfToken: string | null | undefined,
    productId: EntityId,
    imageId: EntityId,
    patch: ImagePatch,
  ): Promise<ProductImage> {
    await this.simulateNetwork(true);
    this.requireAdminOrStaff(token, csrfToken, true, 'catalog.content.edit');
    const product = this.db.products.find((p) => p.id === productId);
    const image = product?.images.find((i) => i.id === imageId);
    if (!product || !image) throw this.fail(404, 'NOT_FOUND', 'Không tìm thấy ảnh sản phẩm.');
    if (patch.storageKey !== undefined) {
      image.url =
        this.db.imageStorageMap[patch.storageKey.trim()] ??
        buildGarmentArtUri(patch.altText || product.name, '#1E3A5F', 'shirt');
    }
    if (patch.altText !== undefined) image.altText = patch.altText.trim();
    if (patch.sortOrder !== undefined) image.sortOrder = patch.sortOrder;
    return { ...image };
  }

  /** Admin/Staff unlink an image from product (operationId: removeAdminImage). */
  async removeAdminImage(
    token: string | null,
    csrfToken: string | null | undefined,
    productId: EntityId,
    imageId: EntityId,
  ): Promise<void> {
    await this.simulateNetwork(true);
    this.requireAdminOrStaff(token, csrfToken, true, 'catalog.content.edit');
    const product = this.db.products.find((p) => p.id === productId);
    const idx = product?.images.findIndex((i) => i.id === imageId) ?? -1;
    if (!product || idx === -1) throw this.fail(404, 'NOT_FOUND', 'Không tìm thấy ảnh sản phẩm.');
    product.images.splice(idx, 1);
  }

  /** Adjust variant inventory atomically with non-zero delta & reason (operationId: adjustInventory). */
  async adjustInventory(
    token: string | null,
    csrfToken: string | null | undefined,
    variantId: EntityId,
    input: InventoryInput,
  ): Promise<InventoryMovement> {
    await this.simulateNetwork(true);
    const actor = this.requireAdminOrStaff(token, csrfToken, true, 'inventory.adjust');
    if (!Number.isInteger(input.delta) || input.delta === 0 || !input.reason.trim()) {
      throw this.fail(400, 'VALIDATION_ERROR', 'Cần nhập số lượng thay đổi khác 0 và lý do điều chỉnh.');
    }
    const found = this.findVariant(variantId);
    if (!found) throw this.fail(404, 'NOT_FOUND', 'Không tìm thấy biến thể.');
    const nextStock = found.variant.stockQuantity + input.delta;
    if (nextStock < 0) {
      throw this.fail(
        409,
        'INSUFFICIENT_STOCK',
        `Không thể trừ ${Math.abs(input.delta)} vì tồn hiện tại chỉ còn ${found.variant.stockQuantity}.`,
      );
    }
    found.variant.stockQuantity = nextStock;
    const movement = {
      id: this.allocId(),
      variantId,
      orderId: null,
      actorUserId: actor.id,
      delta: input.delta,
      reason: input.reason.trim(),
      stockQuantity: nextStock,
      createdAt: new Date().toISOString(),
    };
    this.db.inventoryMovements.push(movement);
    this.writeAudit(actor.id, 'INVENTORY_ADJUST', 'variant', variantId, {
      delta: input.delta,
      reason: input.reason.trim(),
      nextStock,
    });
    return {
      id: movement.id,
      variantId: movement.variantId,
      delta: movement.delta,
      reason: movement.reason,
      stockQuantity: movement.stockQuantity,
      createdAt: movement.createdAt,
    };
  }

  /** List inventory movement history for a variant newest first (operationId: listInventoryAdjustments). */
  async listInventoryAdjustments(
    token: string | null,
    variantId: EntityId,
    page = 1,
    pageSize = 20,
  ): Promise<Paginated<InventoryMovementHistory>> {
    await this.simulateNetwork();
    this.requireAdminOrStaff(token, null, false, 'inventory.adjust');
    if (!this.findVariant(variantId)) {
      throw this.fail(404, 'NOT_FOUND', 'Không tìm thấy biến thể.');
    }
    const items = this.db.inventoryMovements
      .filter((m) => m.variantId === variantId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || Number(b.id) - Number(a.id))
      .map(({ id, variantId: vid, delta, reason, createdAt }) => ({
        id,
        variantId: vid,
        delta,
        reason,
        createdAt,
      }));
    const start = (page - 1) * pageSize;
    return {
      items: items.slice(start, start + pageSize),
      page,
      pageSize,
      total: items.length,
    };
  }

  /** Admin/Staff list store orders filtered by status (operationId: listAdminOrders). */
  async listAdminOrders(
    token: string | null,
    page = 1,
    pageSize = 20,
    status?: OrderStatus,
  ): Promise<Paginated<Order>> {
    await this.simulateNetwork();
    this.requireAdminOrStaff(token, null, false, 'orders.read');
    let list = [...this.db.orders];
    if (status) {
      list = list.filter((o) => o.status === status);
    }
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || Number(b.id) - Number(a.id));
    const start = (page - 1) * pageSize;
    return {
      items: list.slice(start, start + pageSize).map((o) => this.sanitizeOrder(o)),
      page,
      pageSize,
      total: list.length,
    };
  }

  /** Admin/Staff read single order detail (operationId: getAdminOrder). */
  async getAdminOrder(token: string | null, orderId: EntityId): Promise<Order> {
    await this.simulateNetwork();
    this.requireAdminOrStaff(token, null, false, 'orders.read');
    const order = this.db.orders.find((o) => o.id === orderId);
    if (!order) throw this.fail(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng.');
    return this.sanitizeOrder(order);
  }

  /** Advance order step-by-step PENDING -> CONFIRMED -> PACKING -> SHIPPING (operationId: advanceAdminOrder). */
  async advanceAdminOrder(
    token: string | null,
    csrfToken: string | null | undefined,
    orderId: EntityId,
    input: OrderTransitionInput,
  ): Promise<Order> {
    await this.simulateNetwork(true);
    const actor = this.requireAdminOrStaff(token, csrfToken, true, 'orders.process');
    const order = this.db.orders.find((o) => o.id === orderId);
    if (!order) throw this.fail(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng.');
    const allowedNext: Record<string, OrderTransitionInput['status']> = {
      PENDING: 'CONFIRMED',
      CONFIRMED: 'PACKING',
      PACKING: 'SHIPPING',
    };
    if (allowedNext[order.status] !== input.status) {
      throw this.fail(
        409,
        'INVALID_ORDER_STATE',
        `Không thể chuyển đơn từ ${order.status} sang ${input.status}.`,
      );
    }
    const prev = order.status;
    order.status = input.status;
    this.writeAudit(actor.id, 'ORDER_ADVANCE', 'order', order.id, { from: prev, to: input.status });
    return this.sanitizeOrder(order);
  }

  /** Confirm simulated delivery & COD payment atomically from SHIPPING (operationId: confirmDeliveryAndCod). */
  async confirmDeliveryAndCod(
    token: string | null,
    csrfToken: string | null | undefined,
    orderId: EntityId,
  ): Promise<Order> {
    await this.simulateNetwork(true);
    const actor = this.requireAdminOrStaff(token, csrfToken, true, 'orders.process');
    const order = this.db.orders.find((o) => o.id === orderId);
    if (!order) throw this.fail(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng.');
    if (order.status === 'DELIVERED' && order.paymentStatus === 'PAID') {
      return this.sanitizeOrder(order);
    }
    if (order.status !== 'SHIPPING') {
      throw this.fail(
        409,
        'INVALID_ORDER_STATE',
        `Chỉ đơn đang SHIPPING mới xác nhận giao và thu COD được (hiện tại: ${order.status}).`,
      );
    }
    order.status = 'DELIVERED';
    order.paymentStatus = 'PAID';
    this.writeAudit(actor.id, 'CONFIRM_DELIVERY_COD', 'order', order.id, {
      status: 'DELIVERED',
      paymentStatus: 'PAID',
    });
    return this.sanitizeOrder(order);
  }

  /** Admin/Staff cancel order prior to SHIPPING with mandatory reason (operationId: cancelAdminOrder). */
  async cancelAdminOrder(
    token: string | null,
    csrfToken: string | null | undefined,
    orderId: EntityId,
    input: CancellationInput,
  ): Promise<Order> {
    await this.simulateNetwork(true);
    const actor = this.requireAdminOrStaff(token, csrfToken, true, 'orders.process');
    if (!input.reason.trim()) {
      throw this.fail(400, 'VALIDATION_ERROR', 'Cần nhập lý do hủy đơn.');
    }
    const order = this.db.orders.find((o) => o.id === orderId);
    if (!order) throw this.fail(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng.');
    if (order.status === 'CANCELLED') {
      return this.sanitizeOrder(order);
    }
    if (!['PENDING', 'CONFIRMED', 'PACKING'].includes(order.status)) {
      throw this.fail(
        409,
        'INVALID_ORDER_STATE',
        `Không thể hủy đơn ở trạng thái ${order.status}.`,
      );
    }
    this.restoreOrderStockOnce(order, actor.id, `Admin hủy đơn: ${input.reason.trim()}`);
    order.status = 'CANCELLED';
    order.cancelReason = input.reason.trim();
    this.writeAudit(actor.id, 'ADMIN_ORDER_CANCEL', 'order', order.id, {
      reason: input.reason.trim(),
    });
    return this.sanitizeOrder(order);
  }

  /** Admin list reviews for moderation (operationId: listAdminReviews). */
  async listAdminReviews(
    token: string | null,
    page = 1,
    pageSize = 20,
    status?: 'VISIBLE' | 'HIDDEN',
  ): Promise<Paginated<AdminReview>> {
    await this.simulateNetwork();
    this.requireAdminOrStaff(token, null, false);
    let list = [...this.db.reviews];
    if (status) {
      list = list.filter((r) => r.status === status);
    }
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || Number(b.id) - Number(a.id));
    const start = (page - 1) * pageSize;
    return {
      items: list.slice(start, start + pageSize).map((r) => ({ ...r })),
      page,
      pageSize,
      total: list.length,
    };
  }

  /** Admin hide or unhide a review, writing audit only on actual change (operationId: moderateReview). */
  async moderateReview(
    token: string | null,
    csrfToken: string | null | undefined,
    reviewId: EntityId,
    input: ModerationInput,
  ): Promise<AdminReview> {
    await this.simulateNetwork(true);
    const actor = this.requireAdminOrStaff(token, csrfToken, true);
    const review = this.db.reviews.find((r) => r.id === reviewId);
    if (!review) throw this.fail(404, 'NOT_FOUND', 'Không tìm thấy đánh giá.');
    if (review.status !== input.status) {
      const prev = review.status;
      review.status = input.status;
      this.writeAudit(actor.id, 'REVIEW_MODERATION', 'review', review.id, {
        from: prev,
        to: input.status,
      });
    }
    return { ...review };
  }

  /** Admin list users (operationId: listAdminUsers). */
  async listAdminUsers(
    token: string | null,
    page = 1,
    pageSize = 20,
    status?: 'ACTIVE' | 'DISABLED',
  ): Promise<Paginated<User>> {
    await this.simulateNetwork();
    this.requireAdminOrStaff(token, null, false);
    let list = [...this.db.users];
    if (status) {
      list = list.filter((u) => u.status === status);
    }
    const start = (page - 1) * pageSize;
    return {
      items: list.slice(start, start + pageSize).map((u) => this.sanitizeUser(u)),
      page,
      pageSize,
      total: list.length,
    };
  }

  /** Admin toggle Customer/Staff account status and revoke active sessions when disabling (operationId: setAccountStatus). */
  async setAccountStatus(
    token: string | null,
    csrfToken: string | null | undefined,
    userId: EntityId,
    input: AccountStatusInput,
  ): Promise<User> {
    await this.simulateNetwork(true);
    const actor = this.requireAdminOrStaff(token, csrfToken, true);
    const target = this.db.users.find((u) => u.id === userId);
    if (!target) throw this.fail(404, 'NOT_FOUND', 'Không tìm thấy tài khoản.');
    if (target.id === actor.id || target.role === 'ADMIN') {
      throw this.fail(
        409,
        'ACCOUNT_STATUS_CONFLICT',
        'Không thể khóa tài khoản Admin từ màn hình này.',
      );
    }
    const prev = target.status;
    target.status = input.status;
    if (input.status === 'DISABLED') {
      for (const s of this.sessions.values()) {
        if (s.userId === target.id) {
          s.revokedAt = new Date().toISOString();
        }
      }
    }
    if (prev !== input.status) {
      this.writeAudit(actor.id, 'ACCOUNT_STATUS', 'user', target.id, {
        from: prev,
        to: input.status,
      });
    }
    return this.sanitizeUser(target);
  }

  /** MVP B helper: Admin updates Staff operational permissions in real time (for RBAC demo). */
  async setStaffPermissions(
    token: string | null,
    csrfToken: string | null | undefined,
    userId: EntityId,
    permissions: StaffPermission[],
  ): Promise<User> {
    await this.simulateNetwork(true);
    const actor = this.requireAdminOrStaff(token, csrfToken, true);
    const target = this.db.users.find((u) => u.id === userId && u.role === 'STAFF');
    if (!target) throw this.fail(404, 'NOT_FOUND', 'Không tìm thấy tài khoản Staff.');
    const prev = target.permissions ?? [];
    target.permissions = [...permissions];
    this.writeAudit(actor.id, 'STAFF_PERMISSION_UPDATE', 'user', target.id, {
      from: prev,
      to: target.permissions,
    });
    return this.sanitizeUser(target);
  }
}

export const mockServer = new MockFashionServer();
