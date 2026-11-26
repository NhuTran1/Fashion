import type {
  Category,
  Prisma,
  ProductImage,
  ProductVariant,
} from '../generated/prisma/client';

// Chuyển ID danh mục thành chuỗi cho response.
export function catalogCategory({ id, name, slug, status }: Category) {
  return { id: id.toString(), name, slug, status };
}

// Định dạng giá trực tiếp từ Decimal để giữ hai chữ số thập phân.
export function catalogVariant(variant: ProductVariant) {
  const { id, sku, size, color, price, stockQuantity, status } = variant;
  return {
    id: id.toString(),
    sku,
    size,
    color,
    price: price.toFixed(2),
    stockQuantity,
    status,
  };
}

export const IMAGE_ORDER: Prisma.ProductImageOrderByWithRelationInput[] = [
  { sortOrder: 'asc' },
  { id: 'asc' },
];

// Tạo URL theo ID đã gắn với sản phẩm và phạm vi truy cập của response.
export function catalogImage(
  { id, productId, altText, sortOrder }: ProductImage,
  audience: 'public' | 'admin',
) {
  const prefix = audience === 'admin' ? '/api/v1/admin' : '/api/v1';
  return {
    id: id.toString(),
    url:
      prefix +
      '/products/' +
      productId.toString() +
      '/images/' +
      id.toString() +
      '/file',
    altText: altText ?? '',
    sortOrder,
  };
}

// Dùng cùng định dạng sản phẩm cho catalog công khai và Admin.
export function catalogProduct(
  {
    id,
    categoryId,
    name,
    slug,
    description,
    status,
    variants,
    images,
  }: Prisma.ProductGetPayload<{ include: { variants: true; images: true } }>,
  audience: 'admin' | 'public' = 'public',
) {
  return {
    id: id.toString(),
    categoryId: categoryId.toString(),
    name,
    slug,
    description,
    status,
    variants: variants.map(catalogVariant),
    images: images.map((image) => catalogImage(image, audience)),
  };
}
