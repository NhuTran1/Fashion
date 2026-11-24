/**
 * OpenAPI v1.0.0 & RBAC v1 Data Contracts for Fashion Store (Single-Vendor).
 * Matches contracts/openapi.yaml schemas and docs/03-DATA_MODEL.md strictly:
 * - IDs are numeric strings (^[1-9][0-9]*$).
 * - Money fields are 2-decimal strings (^[0-9]{1,10}\.[0-9]{2}$).
 */

export type EntityId = string;
export type DecimalMoney = string;

export type UserRole = 'CUSTOMER' | 'ADMIN' | 'STAFF';
export type AccountStatusValue = 'ACTIVE' | 'DISABLED';
export type CatalogStatus = 'ACTIVE' | 'INACTIVE';
export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PACKING'
  | 'SHIPPING'
  | 'DELIVERED'
  | 'CANCELLED';
export type PaymentStatus = 'UNPAID' | 'PAID';
export type PaymentMethod = 'COD';
export type ReviewStatus = 'VISIBLE' | 'HIDDEN';
export type ProductSort = 'NEWEST' | 'PRICE_ASC' | 'PRICE_DESC';

/** Staff operational permissions defined in docs/06-RBAC.md (MVP B). */
export type StaffPermission =
  | 'catalog.content.edit'
  | 'orders.read'
  | 'orders.process'
  | 'inventory.adjust';

/** Standard API error payload defined in OpenAPI components.schemas.Error. */
export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId: string;
}

/** Custom Error class carrying structured OpenAPI error fields and HTTP status. */
export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string;
  readonly details?: Record<string, unknown>;

  /** Construct an ApiClientError from HTTP status and OpenAPI Error payload. */
  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = payload.code;
    this.requestId = payload.requestId;
    this.details = payload.details;
  }
}

export interface Credentials {
  email: string;
  password: string;
}

export interface User {
  id: EntityId;
  email: string;
  role: UserRole;
  status: AccountStatusValue;
  /** MVP B extension: present when role is STAFF (unused in MVP A backend contract). */
  permissions?: StaffPermission[];
}

export interface NativeSession {
  user: User;
  token: string;
  expiresAt: string;
}

export interface WebSession {
  user: User;
  csrfToken: string;
  expiresAt: string;
}

export interface CsrfResponse {
  csrfToken: string;
}

export interface AddressInput {
  name: string;
  phone: string;
  addressText: string;
  isDefault?: boolean;
}

export type AddressPatch = Partial<AddressInput>;

export interface Address {
  id: EntityId;
  name: string;
  phone: string;
  addressText: string;
  isDefault: boolean;
}

export interface CategoryInput {
  name: string;
  slug: string;
  status: CatalogStatus;
}

export type CategoryPatch = Partial<CategoryInput>;

export interface Category {
  id: EntityId;
  name: string;
  slug: string;
  status: CatalogStatus;
}

export interface VariantInput {
  sku: string;
  size: string;
  color: string;
  price: DecimalMoney;
  status: CatalogStatus;
}

export type VariantPatch = Partial<VariantInput>;

export interface Variant {
  id: EntityId;
  sku: string;
  size: string;
  color: string;
  price: DecimalMoney;
  stockQuantity: number;
  status: CatalogStatus;
}

export interface ImageInput {
  storageKey: string;
  altText?: string;
  sortOrder?: number;
}

export type ImagePatch = Partial<ImageInput>;

export interface ProductImage {
  id: EntityId;
  url: string;
  altText: string;
  sortOrder: number;
}

export interface ProductInput {
  categoryId: EntityId;
  name: string;
  slug: string;
  description: string;
  status: CatalogStatus;
}

export type ProductPatch = Partial<ProductInput>;

export interface Product {
  id: EntityId;
  categoryId: EntityId;
  name: string;
  slug: string;
  description: string;
  status: CatalogStatus;
  variants: Variant[];
  images: ProductImage[];
}

export interface CartLine {
  variantId: EntityId;
  quantity: number;
}

export interface CartLineView {
  variantId: EntityId;
  quantity: number;
  unitPrice: DecimalMoney;
  lineTotal: DecimalMoney;
}

export interface QuantityInput {
  quantity: number;
}

export interface Cart {
  items: CartLineView[];
  subtotal: DecimalMoney;
}

export interface CheckoutInput {
  addressId: EntityId;
  method: PaymentMethod;
  items: CartLine[];
}

export interface OrderAddressSnapshot {
  name: string;
  phone: string;
  addressText: string;
}

export interface OrderLine {
  id: EntityId;
  variantId: EntityId;
  sku: string;
  name: string;
  size: string;
  color: string;
  quantity: number;
  unitPrice: DecimalMoney;
  lineTotal: DecimalMoney;
}

export interface Order {
  id: EntityId;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotal: DecimalMoney;
  shippingFee: DecimalMoney;
  total: DecimalMoney;
  address: OrderAddressSnapshot;
  items: OrderLine[];
  createdAt: string;
  /** Optional cancellation metadata surfaced for demo clarity. */
  cancelReason?: string;
}

export interface ReviewInput {
  orderItemId: EntityId;
  rating: number;
  content: string;
}

export interface Review {
  id: EntityId;
  productId: EntityId;
  rating: number;
  content: string;
  createdAt: string;
}

export interface ModerationInput {
  status: ReviewStatus;
}

export interface AdminReview {
  id: EntityId;
  productId: EntityId;
  orderItemId: EntityId;
  userId: EntityId;
  rating: number;
  content: string;
  createdAt: string;
  status: ReviewStatus;
}

export interface InventoryInput {
  delta: number;
  reason: string;
}

export interface InventoryMovement {
  id: EntityId;
  variantId: EntityId;
  delta: number;
  reason: string;
  stockQuantity: number;
  createdAt: string;
}

export interface InventoryMovementHistory {
  id: EntityId;
  variantId: EntityId;
  delta: number;
  reason: string;
  createdAt: string;
}

export interface OrderTransitionInput {
  status: 'CONFIRMED' | 'PACKING' | 'SHIPPING';
}

export interface CancellationInput {
  reason: string;
}

export interface AccountStatusInput {
  status: AccountStatusValue;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ProductQueryParams {
  page?: number;
  pageSize?: number;
  q?: string;
  categoryId?: EntityId;
  size?: string;
  color?: string;
  sort?: ProductSort;
}

export interface AdminAuditLog {
  id: EntityId;
  actorUserId: EntityId;
  action: string;
  targetType: string;
  targetId: EntityId;
  metadata: Record<string, unknown>;
  createdAt: string;
}

/** Checkout response wrapper indicating whether server created (201) or replayed (200). */
export interface CheckoutResult {
  order: Order;
  replayed: boolean;
}

/** Fault injection modes for verifying loading, empty, and error states in UI. */
export type MockFaultMode =
  | 'NONE'
  | 'INTERNAL_ERROR'
  | 'SESSION_EXPIRED'
  | 'CSRF_INVALID'
  | 'OUT_OF_STOCK'
  | 'NETWORK_TIMEOUT';
