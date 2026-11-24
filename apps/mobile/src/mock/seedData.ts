import {
  Address,
  AdminAuditLog,
  AdminReview,
  CartLine,
  Category,
  EntityId,
  InventoryMovement,
  Order,
  Product,
  StaffPermission,
  User,
} from '../types/api';

/** Internal user record used exclusively inside the mock backend engine. */
export interface MockUserRecord extends User {
  password: string;
}

/** Internal inventory movement record retaining optional orderId link. */
export interface MockInventoryMovementRecord extends InventoryMovement {
  orderId: EntityId | null;
  actorUserId: EntityId;
}

/** Internal review record matching MySQL reviews table fields. */
export interface MockReviewRecord extends AdminReview {}

/** Internal order record adding userId and idempotency metadata for backend checks. */
export interface MockOrderRecord extends Order {
  userId: EntityId;
  idempotencyKey: string;
  requestFingerprint: string;
  restocked: boolean;
}

/** Full mutable state snapshot held by the stateful mock backend server. */
export interface MockDatabaseState {
  nextId: number;
  users: MockUserRecord[];
  addressesByUser: Record<EntityId, Address[]>;
  categories: Category[];
  products: Product[];
  cartsByUser: Record<EntityId, CartLine[]>;
  orders: MockOrderRecord[];
  reviews: MockReviewRecord[];
  inventoryMovements: MockInventoryMovementRecord[];
  auditLogs: AdminAuditLog[];
  /** Tracks storageKey -> resolved local preview URL for ADR-0004 image references. */
  imageStorageMap: Record<string, string>;
}

/** Pre-configured demo credentials surfaced in Login screen for fast evaluator testing. */
export const DEMO_ACCOUNTS: Array<{
  label: string;
  email: string;
  password: string;
  role: 'CUSTOMER' | 'ADMIN' | 'STAFF';
  note: string;
}> = [
  {
    label: 'Customer Demo',
    email: 'customer@example.test',
    password: 'demo-example-only',
    role: 'CUSTOMER',
    note: 'Có sẵn giỏ hàng, 1 đơn PENDING, 1 đơn DELIVERED chờ đánh giá',
  },
  {
    label: 'Admin Demo',
    email: 'admin@example.test',
    password: 'admin-demo-only',
    role: 'ADMIN',
    note: 'Toàn quyền catalog, tồn kho, đơn hàng, kiểm duyệt & tài khoản',
  },
  {
    label: 'Staff MVP B (Preview)',
    email: 'staff@example.test',
    password: 'staff-demo-only',
    role: 'STAFF',
    note: 'Quyền giới hạn: orders.read + orders.process (chặn đổi giá/tài khoản)',
  },
];

/** Available Staff operational permissions from docs/06-RBAC.md. */
export const ALL_STAFF_PERMISSIONS: StaffPermission[] = [
  'catalog.content.edit',
  'orders.read',
  'orders.process',
  'inventory.adjust',
];

/** Build a clean SVG data URI fallback/preview for any storageKey if needed on web. */
export function buildGarmentArtUri(title: string, toneHex: string, silhouette: string): string {
  const safeTitle = encodeURIComponent(title.slice(0, 26));
  const safeTone = encodeURIComponent(toneHex);
  const safeSil = encodeURIComponent(silhouette);
  return `garment://${safeTone}/${safeSil}/${safeTitle}`;
}

/** Create a fresh deep-cloned initial mock database matching backend MySQL schema & OpenAPI v1.0.0. */
export function createInitialMockDatabase(): MockDatabaseState {
  const users: MockUserRecord[] = [
    {
      id: '1',
      email: 'customer@example.test',
      password: 'demo-example-only',
      role: 'CUSTOMER',
      status: 'ACTIVE',
    },
    {
      id: '2',
      email: 'customer2@example.test',
      password: 'demo-example-only',
      role: 'CUSTOMER',
      status: 'ACTIVE',
    },
    {
      id: '3',
      email: 'admin@example.test',
      password: 'admin-demo-only',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
    {
      id: '4',
      email: 'staff@example.test',
      password: 'staff-demo-only',
      role: 'STAFF',
      status: 'ACTIVE',
      permissions: ['orders.read', 'orders.process'],
    },
  ];

  const addressesByUser: Record<EntityId, Address[]> = {
    '1': [
      {
        id: '10',
        name: 'Nguyễn Minh Anh',
        phone: '0901234567',
        addressText: '42 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
        isDefault: true,
      },
      {
        id: '11',
        name: 'Nguyễn Minh Anh (Văn phòng)',
        phone: '0901234567',
        addressText: '185 Hai Bà Trưng, Phường Võ Thị Sáu, Quận 3, TP. Hồ Chí Minh',
        isDefault: false,
      },
    ],
    '2': [
      {
        id: '12',
        name: 'Trần Quốc Bảo',
        phone: '0919888777',
        addressText: '88 Lý Thường Kiệt, Hoàn Kiếm, Hà Nội',
        isDefault: true,
      },
    ],
  };

  const categories: Category[] = [
    { id: '1', name: 'Áo sơ mi & Kiểu', slug: 'ao-so-mi', status: 'ACTIVE' },
    { id: '2', name: 'Áo thun & Len mỏng', slug: 'ao-thun-knit', status: 'ACTIVE' },
    { id: '3', name: 'Quần âu & Denim', slug: 'quan-denim', status: 'ACTIVE' },
    { id: '4', name: 'Áo khoác & Blazer', slug: 'ao-khoac-blazer', status: 'ACTIVE' },
    { id: '5', name: 'Phụ kiện lưu kho', slug: 'phu-kien-luu-kho', status: 'INACTIVE' },
  ];

  const products: Product[] = [
    {
      id: '101',
      categoryId: '1',
      name: 'Sơ mi Linen Cổ Trụ Poplin',
      slug: 'so-mi-linen-co-tru-poplin',
      description:
        'Chất liệu linen pha cotton thoáng khí, phom suông nhẹ vai, đường may giấu nút tinh giản phù hợp mặc hằng ngày và công sở.',
      status: 'ACTIVE',
      images: [
        {
          id: '501',
          url: buildGarmentArtUri('Sơ mi Linen Poplin', '#E9E6DF', 'shirt'),
          altText: 'Sơ mi Linen Cổ Trụ màu trắng ngà',
          sortOrder: 0,
        },
        {
          id: '502',
          url: buildGarmentArtUri('Chi tiết cổ trụ Indigo', '#1E3A5F', 'shirt'),
          altText: 'Phiên bản Xanh Indigo',
          sortOrder: 1,
        },
      ],
      variants: [
        {
          id: '1001',
          sku: 'SOI-LINEN-WHT-M',
          size: 'M',
          color: 'Trắng',
          price: '480000.00',
          stockQuantity: 14,
          status: 'ACTIVE',
        },
        {
          id: '1002',
          sku: 'SOI-LINEN-WHT-L',
          size: 'L',
          color: 'Trắng',
          price: '480000.00',
          stockQuantity: 1,
          status: 'ACTIVE',
        },
        {
          id: '1003',
          sku: 'SOI-LINEN-IND-M',
          size: 'M',
          color: 'Xanh Indigo',
          price: '510000.00',
          stockQuantity: 7,
          status: 'ACTIVE',
        },
        {
          id: '1004',
          sku: 'SOI-LINEN-IND-XL',
          size: 'XL',
          color: 'Xanh Indigo',
          price: '510000.00',
          stockQuantity: 0,
          status: 'ACTIVE',
        },
      ],
    },
    {
      id: '102',
      categoryId: '2',
      name: 'Áo Thun Heavyweight 260gsm',
      slug: 'ao-thun-heavyweight-260gsm',
      description:
        'Cotton chải kỹ định lượng 260gsm giữ đứng phom cổ tròn, xử lý chống co rút sau giặt, bề mặt mịn ít xù lông.',
      status: 'ACTIVE',
      images: [
        {
          id: '503',
          url: buildGarmentArtUri('Heavyweight Tee 260g', '#1C1D21', 'tee'),
          altText: 'Áo thun Heavyweight màu Đen',
          sortOrder: 0,
        },
      ],
      variants: [
        {
          id: '1005',
          sku: 'SOI-TEE-BLK-S',
          size: 'S',
          color: 'Đen',
          price: '290000.00',
          stockQuantity: 18,
          status: 'ACTIVE',
        },
        {
          id: '1006',
          sku: 'SOI-TEE-BLK-M',
          size: 'M',
          color: 'Đen',
          price: '290000.00',
          stockQuantity: 9,
          status: 'ACTIVE',
        },
        {
          id: '1007',
          sku: 'SOI-TEE-STN-L',
          size: 'L',
          color: 'Xám Đá',
          price: '310000.00',
          stockQuantity: 5,
          status: 'ACTIVE',
        },
        {
          id: '1008',
          sku: 'SOI-TEE-OLD-XL',
          size: 'XL',
          color: 'Trắng',
          price: '290000.00',
          stockQuantity: 4,
          status: 'INACTIVE',
        },
      ],
    },
    {
      id: '103',
      categoryId: '3',
      name: 'Quần Denim Selvedge Ống Suông',
      slug: 'quan-denim-selvedge-ong-suong',
      description:
        'Denim 13oz dệt biên đỏ nguyên bản, cạp trung vừa vặn, ống đứng thanh lịch dễ phối với sơ mi và áo len mỏng.',
      status: 'ACTIVE',
      images: [
        {
          id: '504',
          url: buildGarmentArtUri('Selvedge Denim 13oz', '#1E3A5F', 'trouser'),
          altText: 'Quần Denim Selvedge Xanh Indigo',
          sortOrder: 0,
        },
      ],
      variants: [
        {
          id: '1009',
          sku: 'SOI-DNM-IND-M',
          size: 'M',
          color: 'Xanh Indigo',
          price: '890000.00',
          stockQuantity: 6,
          status: 'ACTIVE',
        },
        {
          id: '1010',
          sku: 'SOI-DNM-IND-L',
          size: 'L',
          color: 'Xanh Indigo',
          price: '890000.00',
          stockQuantity: 3,
          status: 'ACTIVE',
        },
        {
          id: '1011',
          sku: 'SOI-DNM-BLK-M',
          size: 'M',
          color: 'Đen',
          price: '920000.00',
          stockQuantity: 0,
          status: 'ACTIVE',
        },
      ],
    },
    {
      id: '104',
      categoryId: '4',
      name: 'Blazer Len Pha Hai Hàng Khuy',
      slug: 'blazer-len-pha-hai-hang-khuy',
      description:
        'Cấu trúc cầu vai mềm không đệm dày, lót lụa bán phần thoáng nhẹ, ve áo sắc nét cho tiết trời giao mùa.',
      status: 'ACTIVE',
      images: [
        {
          id: '505',
          url: buildGarmentArtUri('Wool Blend Blazer', '#2B313B', 'coat'),
          altText: 'Blazer Len Pha màu Xám Đá',
          sortOrder: 0,
        },
      ],
      variants: [
        {
          id: '1012',
          sku: 'SOI-BLZ-STN-M',
          size: 'M',
          color: 'Xám Đá',
          price: '1650000.00',
          stockQuantity: 4,
          status: 'ACTIVE',
        },
        {
          id: '1013',
          sku: 'SOI-BLZ-BLK-L',
          size: 'L',
          color: 'Đen',
          price: '1690000.00',
          stockQuantity: 2,
          status: 'ACTIVE',
        },
      ],
    },
    {
      id: '105',
      categoryId: '2',
      name: 'Áo Cardigan Merino Dệt Gân',
      slug: 'ao-cardigan-merino-det-gan',
      description:
        'Len merino mảnh nhẹ, dệt gân dọc tạo chiều sâu bề mặt, khuy sừng tự nhiên.',
      status: 'ACTIVE',
      images: [
        {
          id: '506',
          url: buildGarmentArtUri('Merino Rib Cardigan', '#3C4D3B', 'knit'),
          altText: 'Cardigan Merino màu Xanh Rêu',
          sortOrder: 0,
        },
      ],
      variants: [
        {
          id: '1014',
          sku: 'SOI-CRD-MOS-S',
          size: 'S',
          color: 'Xanh Rêu',
          price: '760000.00',
          stockQuantity: 8,
          status: 'ACTIVE',
        },
        {
          id: '1015',
          sku: 'SOI-CRD-BEI-M',
          size: 'M',
          color: 'Be',
          price: '760000.00',
          stockQuantity: 11,
          status: 'ACTIVE',
        },
        {
          id: '1021',
          sku: 'SOI-CRD-BLK-M',
          size: 'M',
          color: 'Đen',
          price: '760000.00',
          stockQuantity: 6,
          status: 'ACTIVE',
        },
      ],
    },
    {
      id: '106',
      categoryId: '3',
      name: 'Quần Tây Xếp Ly Đôi Wool-Touch',
      slug: 'quan-tay-xep-ly-doi',
      description:
        'Quần tây cạp cao hai ly trước, rơi rủ tự nhiên và ít nhăn khi di chuyển.',
      status: 'ACTIVE',
      images: [
        {
          id: '507',
          url: buildGarmentArtUri('Pleated Trousers', '#D9CFC1', 'trouser'),
          altText: 'Quần Tây Xếp Ly màu Be',
          sortOrder: 0,
        },
      ],
      variants: [
        {
          id: '1016',
          sku: 'SOI-TRS-BEI-M',
          size: 'M',
          color: 'Be',
          price: '680000.00',
          stockQuantity: 10,
          status: 'ACTIVE',
        },
        {
          id: '1017',
          sku: 'SOI-TRS-BLK-L',
          size: 'L',
          color: 'Đen',
          price: '680000.00',
          stockQuantity: 6,
          status: 'ACTIVE',
        },
      ],
    },
    {
      id: '107',
      categoryId: '4',
      name: 'Áo Khoác Chore Twill Wash',
      slug: 'ao-khoac-chore-twill-wash',
      description:
        'Áo khoác túi hộp lấy cảm hứng trang phục xưởng may, vải twill cotton wash mềm bề mặt.',
      status: 'ACTIVE',
      images: [
        {
          id: '508',
          url: buildGarmentArtUri('Chore Twill Jacket', '#6B4C3B', 'coat'),
          altText: 'Áo Khoác Chore màu Nâu',
          sortOrder: 0,
        },
      ],
      variants: [
        {
          id: '1018',
          sku: 'SOI-CHR-BRN-M',
          size: 'M',
          color: 'Nâu',
          price: '1120000.00',
          stockQuantity: 5,
          status: 'ACTIVE',
        },
        {
          id: '1019',
          sku: 'SOI-CHR-IND-L',
          size: 'L',
          color: 'Xanh Indigo',
          price: '1150000.00',
          stockQuantity: 1,
          status: 'ACTIVE',
        },
        {
          id: '1022',
          sku: 'SOI-CHR-MOS-M',
          size: 'M',
          color: 'Xanh Rêu',
          price: '1120000.00',
          stockQuantity: 4,
          status: 'ACTIVE',
        },
      ],
    },
    {
      id: '108',
      categoryId: '1',
      name: 'Sơ mi Oxford Sọc Mảnh (Bản nháp)',
      slug: 'so-mi-oxford-soc-manh-nhap',
      description:
        'Mẫu thử nghiệm chưa xuất bản công khai — chỉ hiển thị trong Admin Catalog để đối chiếu AC-01.',
      status: 'INACTIVE',
      images: [
        {
          id: '509',
          url: buildGarmentArtUri('Oxford Draft', '#B5C8DC', 'shirt'),
          altText: 'Sơ mi Oxford bản nháp',
          sortOrder: 0,
        },
      ],
      variants: [
        {
          id: '1020',
          sku: 'SOI-OXF-BLU-M',
          size: 'M',
          color: 'Xanh Nhạt',
          price: '450000.00',
          stockQuantity: 3,
          status: 'ACTIVE',
        },
      ],
    },
  ];

  const cartsByUser: Record<EntityId, CartLine[]> = {
    '1': [{ variantId: '1001', quantity: 1 }],
    '2': [],
  };

  const orders: MockOrderRecord[] = [
    {
      id: '201',
      userId: '1',
      status: 'DELIVERED',
      paymentStatus: 'PAID',
      subtotal: '770000.00',
      shippingFee: '0.00',
      total: '770000.00',
      address: {
        name: 'Nguyễn Minh Anh',
        phone: '0901234567',
        addressText: '42 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
      },
      items: [
        {
          id: '3001',
          variantId: '1001',
          sku: 'SOI-LINEN-WHT-M',
          name: 'Sơ mi Linen Cổ Trụ Poplin',
          size: 'M',
          color: 'Trắng',
          quantity: 1,
          unitPrice: '480000.00',
          lineTotal: '480000.00',
        },
        {
          id: '3002',
          variantId: '1005',
          sku: 'SOI-TEE-BLK-S',
          name: 'Áo Thun Heavyweight 260gsm',
          size: 'S',
          color: 'Đen',
          quantity: 1,
          unitPrice: '290000.00',
          lineTotal: '290000.00',
        },
      ],
      createdAt: '2026-11-18T08:30:00Z',
      idempotencyKey: 'seed-order-201',
      requestFingerprint: 'seed-fp-201',
      restocked: false,
    },
    {
      id: '202',
      userId: '1',
      status: 'PENDING',
      paymentStatus: 'UNPAID',
      subtotal: '890000.00',
      shippingFee: '0.00',
      total: '890000.00',
      address: {
        name: 'Nguyễn Minh Anh',
        phone: '0901234567',
        addressText: '42 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
      },
      items: [
        {
          id: '3003',
          variantId: '1009',
          sku: 'SOI-DNM-IND-M',
          name: 'Quần Denim Selvedge Ống Suông',
          size: 'M',
          color: 'Xanh Indigo',
          quantity: 1,
          unitPrice: '890000.00',
          lineTotal: '890000.00',
        },
      ],
      createdAt: '2026-11-23T14:15:00Z',
      idempotencyKey: 'seed-order-202',
      requestFingerprint: 'seed-fp-202',
      restocked: false,
    },
    {
      id: '203',
      userId: '1',
      status: 'SHIPPING',
      paymentStatus: 'UNPAID',
      subtotal: '760000.00',
      shippingFee: '0.00',
      total: '760000.00',
      address: {
        name: 'Nguyễn Minh Anh (Văn phòng)',
        phone: '0901234567',
        addressText: '185 Hai Bà Trưng, Phường Võ Thị Sáu, Quận 3, TP. Hồ Chí Minh',
      },
      items: [
        {
          id: '3004',
          variantId: '1014',
          sku: 'SOI-CRD-MOS-S',
          name: 'Áo Cardigan Merino Dệt Gân',
          size: 'S',
          color: 'Xanh Rêu',
          quantity: 1,
          unitPrice: '760000.00',
          lineTotal: '760000.00',
        },
      ],
      createdAt: '2026-11-22T09:00:00Z',
      idempotencyKey: 'seed-order-203',
      requestFingerprint: 'seed-fp-203',
      restocked: false,
    },
    {
      id: '204',
      userId: '2',
      status: 'CONFIRMED',
      paymentStatus: 'UNPAID',
      subtotal: '1650000.00',
      shippingFee: '0.00',
      total: '1650000.00',
      address: {
        name: 'Trần Quốc Bảo',
        phone: '0919888777',
        addressText: '88 Lý Thường Kiệt, Hoàn Kiếm, Hà Nội',
      },
      items: [
        {
          id: '3005',
          variantId: '1012',
          sku: 'SOI-BLZ-STN-M',
          name: 'Blazer Len Pha Hai Hàng Khuy',
          size: 'M',
          color: 'Xám Đá',
          quantity: 1,
          unitPrice: '1650000.00',
          lineTotal: '1650000.00',
        },
      ],
      createdAt: '2026-11-23T11:20:00Z',
      idempotencyKey: 'seed-order-204',
      requestFingerprint: 'seed-fp-204',
      restocked: false,
    },
  ];

  const reviews: MockReviewRecord[] = [
    {
      id: '401',
      productId: '102',
      orderItemId: '3002',
      userId: '1',
      rating: 5,
      content: 'Vải cotton dày dặn, đường may cổ áo chắc chắn, mặc lên đứng phom rất đẹp.',
      createdAt: '2026-11-19T10:15:00Z',
      status: 'VISIBLE',
    },
    {
      id: '402',
      productId: '101',
      orderItemId: '9901',
      userId: '2',
      rating: 4,
      content: 'Chất linen mát nhẹ, màu trắng ngà lên hình rất tự nhiên. Giao hàng nhanh.',
      createdAt: '2026-11-20T16:40:00Z',
      status: 'VISIBLE',
    },
    {
      id: '403',
      productId: '103',
      orderItemId: '9902',
      userId: '2',
      rating: 2,
      content: 'Đánh giá đã bị ẩn mẫu để kiểm tra bộ lọc kiểm duyệt trong Admin.',
      createdAt: '2026-11-21T09:10:00Z',
      status: 'HIDDEN',
    },
  ];

  const inventoryMovements: MockInventoryMovementRecord[] = [
    {
      id: '701',
      variantId: '1001',
      orderId: null,
      actorUserId: '3',
      delta: 15,
      reason: 'Nhập kho lô đầu mùa thu đông',
      stockQuantity: 15,
      createdAt: '2026-11-17T08:00:00Z',
    },
    {
      id: '702',
      variantId: '1001',
      orderId: '201',
      actorUserId: '1',
      delta: -1,
      reason: 'Checkout đơn #201',
      stockQuantity: 14,
      createdAt: '2026-11-18T08:30:00Z',
    },
    {
      id: '703',
      variantId: '1009',
      orderId: '202',
      actorUserId: '1',
      delta: -1,
      reason: 'Checkout đơn #202',
      stockQuantity: 6,
      createdAt: '2026-11-23T14:15:00Z',
    },
  ];

  const auditLogs: AdminAuditLog[] = [
    {
      id: '801',
      actorUserId: '3',
      action: 'REVIEW_MODERATION',
      targetType: 'review',
      targetId: '403',
      metadata: { from: 'VISIBLE', to: 'HIDDEN' },
      createdAt: '2026-11-21T10:00:00Z',
    },
  ];

  const imageStorageMap: Record<string, string> = {
    'garments/linen-ivory.jpg': buildGarmentArtUri('Sơ mi Linen Mới', '#E5E2D9', 'shirt'),
    'garments/denim-wash.jpg': buildGarmentArtUri('Denim Wash Mới', '#24456E', 'trouser'),
    'garments/blazer-charcoal.jpg': buildGarmentArtUri('Blazer Mới', '#2B313B', 'coat'),
    'garments/knit-moss.jpg': buildGarmentArtUri('Knitwear Mới', '#3C4D3B', 'knit'),
  };

  return {
    nextId: 5000,
    users,
    addressesByUser,
    categories,
    products,
    cartsByUser,
    orders,
    reviews,
    inventoryMovements,
    auditLogs,
    imageStorageMap,
  };
}
