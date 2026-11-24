import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { fashionApi } from '../../api/client';
import { FadeSlideIn } from '../../components/Motion';
import {
  EditorialButton,
  GarmentArtwork,
  StateCard,
  StatusBadge,
} from '../../components/UiPrimitives';
import { useApp } from '../../state/AppContext';
import {
  colors,
  radius,
  resolveColorSwatch,
  shadows,
  spacing,
  typography,
} from '../../theme/tokens';
import { ApiClientError, EntityId, Product, Review, Variant } from '../../types/api';
import { formatDateTime, formatVnd } from '../../utils/format';

/** Product detail screen with rounded gallery thumbnails, tactile pill selectors, and smooth reveals. */
export function ProductDetailScreen({ productId }: { productId: EntityId }): React.ReactElement {
  const { user, navigate, goBack, refreshCart, handleApiError, showToast } = useApp();
  const { width } = useWindowDimensions();

  const [product, setProduct] = useState<Product | null>(null);
  const [productLoading, setProductLoading] = useState<boolean>(true);
  const [productError, setProductError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState<boolean>(false);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsTotal, setReviewsTotal] = useState<number>(0);
  const [reviewsLoading, setReviewsLoading] = useState<boolean>(true);
  const [reviewsError, setReviewsError] = useState<string | null>(null);

  const [activeImageIdx, setActiveImageIdx] = useState<number>(0);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [addingToCart, setAddingToCart] = useState<boolean>(false);
  const [cartActionError, setCartActionError] = useState<string | null>(null);

  /** Load ACTIVE product detail and pre-select an available variant. */
  const loadProduct = useCallback(async () => {
    setProductLoading(true);
    setProductError(null);
    setIsNotFound(false);
    try {
      const data = await fashionApi.getProduct(productId);
      setProduct(data);
      const firstAvailable = data.variants.find((v) => v.stockQuantity > 0) ?? data.variants[0];
      if (firstAvailable) {
        setSelectedSize(firstAvailable.size);
        setSelectedColor(firstAvailable.color);
      }
      setQuantity(1);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 404) {
        setIsNotFound(true);
      }
      setProductError(handleApiError(err, 'Không thể tải chi tiết sản phẩm.'));
    } finally {
      setProductLoading(false);
    }
  }, [handleApiError, productId]);

  /** Load public VISIBLE reviews independently from product detail. */
  const loadReviews = useCallback(async () => {
    setReviewsLoading(true);
    setReviewsError(null);
    try {
      const res = await fashionApi.listProductReviews(productId, 1, 20);
      setReviews(res.items);
      setReviewsTotal(res.total);
    } catch (err) {
      setReviewsError(handleApiError(err, 'Không thể tải danh sách đánh giá.'));
    } finally {
      setReviewsLoading(false);
    }
  }, [handleApiError, productId]);

  useEffect(() => {
    void loadProduct();
    void loadReviews();
  }, [loadProduct, loadReviews]);

  const sizes = useMemo(
    () => (product ? Array.from(new Set(product.variants.map((v) => v.size))) : []),
    [product],
  );
  const colorList = useMemo(
    () => (product ? Array.from(new Set(product.variants.map((v) => v.color))) : []),
    [product],
  );

  const selectedVariant: Variant | undefined = useMemo(() => {
    if (!product) return undefined;
    return product.variants.find((v) => v.size === selectedSize && v.color === selectedColor);
  }, [product, selectedColor, selectedSize]);

  /** Check whether a given size has any variant with positive stock. */
  const isSizeAvailable = (sz: string): boolean => {
    if (!product) return false;
    return product.variants.some((v) => v.size === sz && v.stockQuantity > 0);
  };

  /** Check whether a color option has stock for the currently selected size. */
  const isColorAvailableForSize = (clr: string): boolean => {
    if (!product) return false;
    const match = product.variants.find((v) => v.size === selectedSize && v.color === clr);
    return Boolean(match && match.stockQuantity > 0);
  };

  /** Add selected variant to Customer cart; redirects Guest to login or reloads on OUT_OF_STOCK. */
  const handleAddToCart = async () => {
    setCartActionError(null);
    if (!user) {
      showToast('info', 'Vui lòng đăng nhập tài khoản Khách hàng để thêm vào giỏ.');
      navigate({ name: 'auth', mode: 'login' });
      return;
    }
    if (user.role !== 'CUSTOMER') {
      setCartActionError('Tài khoản Quản trị/Nhân viên không dùng giỏ hàng mua sắm.');
      return;
    }
    if (!selectedVariant || selectedVariant.stockQuantity <= 0) {
      setCartActionError('Biến thể đang hết hàng, vui lòng chọn size hoặc màu khác.');
      return;
    }

    setAddingToCart(true);
    try {
      await fashionApi.addCartItem({ variantId: selectedVariant.id, quantity });
      await refreshCart();
      showToast(
        'success',
        `Đã thêm ${quantity} × ${product?.name} (${selectedVariant.size}/${selectedVariant.color}) vào giỏ.`,
      );
    } catch (err) {
      const msg = handleApiError(err, 'Không thể thêm vào giỏ hàng.');
      setCartActionError(msg);
      if (err instanceof ApiClientError && err.code === 'OUT_OF_STOCK') {
        await loadProduct();
      }
    } finally {
      setAddingToCart(false);
    }
  };

  if (productLoading) {
    return (
      <View style={styles.pagePad}>
        <StateCard kind="loading" title="Đang tải chi tiết sản phẩm..." />
      </View>
    );
  }

  if (productError || !product) {
    return (
      <View style={styles.pagePad}>
        <StateCard
          kind="error"
          title={isNotFound ? 'Sản phẩm không tồn tại (404)' : 'Lỗi tải sản phẩm'}
          message={productError || 'Không tìm thấy sản phẩm.'}
          actionLabel={isNotFound ? 'Quay lại catalog' : 'Thử lại'}
          onAction={() => (isNotFound ? navigate({ name: 'catalog' }) : void loadProduct())}
        />
      </View>
    );
  }

  const isWide = width >= 840;
  const activeImage = product.images[activeImageIdx] ?? product.images[0];
  const outOfStock = !selectedVariant || selectedVariant.stockQuantity <= 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.breadcrumbRow}>
        <EditorialButton label="Quay lại" variant="secondary" compact onPress={goBack} />
      </View>

      <FadeSlideIn distance={14}>
        <View style={[styles.detailLayout, shadows.card, isWide && styles.detailLayoutWide]}>
          {/* Left column: Image gallery */}
          <View style={[styles.galleryCol, isWide && { width: 440, maxWidth: '46%' }]}>
            <View style={shadows.soft}>
              <GarmentArtwork
                uri={activeImage?.url}
                altText={activeImage?.altText || product.name}
                aspectRatio={3 / 4}
              />
            </View>
            {product.images.length > 1 ? (
              <View style={styles.thumbRow}>
                {product.images.map((img, idx) => (
                  <Pressable
                    key={img.id}
                    onPress={() => setActiveImageIdx(idx)}
                    style={[styles.thumbBox, idx === activeImageIdx && styles.thumbBoxActive]}
                  >
                    <GarmentArtwork uri={img.url} altText={img.altText} height={58} hideCaption />
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          {/* Right column: Variant matrix, stock, CTA, honest AI feature flag notice */}
          <View style={[styles.infoCol, isWide && { flex: 1.1 }]}>
            <Text style={styles.productTitle}>{product.name}</Text>
            <View style={styles.priceRow}>
              <Text style={styles.priceText}>
                {selectedVariant ? formatVnd(selectedVariant.price) : 'Chọn biến thể'}
              </Text>
              {selectedVariant ? (
                <StatusBadge
                  label={
                    selectedVariant.stockQuantity > 0
                      ? `Còn ${selectedVariant.stockQuantity} · SKU ${selectedVariant.sku}`
                      : `Hết hàng · SKU ${selectedVariant.sku}`
                  }
                  tone={selectedVariant.stockQuantity > 0 ? 'success' : 'danger'}
                />
              ) : (
                <StatusBadge label="Tổ hợp size/màu chưa có" tone="warning" />
              )}
            </View>

            <Text style={styles.description}>{product.description}</Text>

            <View style={styles.selectorBlock}>
              <Text style={styles.selectorLabel}>Kích cỡ</Text>
              <View style={styles.optionRow}>
                {sizes.map((sz) => {
                  const active = selectedSize === sz;
                  const available = isSizeAvailable(sz);
                  return (
                    <Pressable
                      key={sz}
                      onPress={() => {
                        setSelectedSize(sz);
                        const directMatch = product.variants.find(
                          (v) => v.size === sz && v.color === selectedColor,
                        );
                        if (!directMatch) {
                          const fallback = product.variants.find((v) => v.size === sz);
                          if (fallback) setSelectedColor(fallback.color);
                        }
                        setQuantity(1);
                      }}
                      style={[
                        styles.optionBtn,
                        active && styles.optionBtnActive,
                        !available && styles.optionBtnOos,
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          active && styles.optionTextActive,
                          !available && styles.optionTextOos,
                        ]}
                      >
                        {sz}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.selectorBlock}>
              <Text style={styles.selectorLabel}>Màu sắc</Text>
              <View style={styles.optionRow}>
                {colorList.map((clr) => {
                  const active = selectedColor === clr;
                  const exists = product.variants.some(
                    (v) => v.size === selectedSize && v.color === clr,
                  );
                  const available = isColorAvailableForSize(clr);
                  return (
                    <Pressable
                      key={clr}
                      disabled={!exists}
                      onPress={() => {
                        setSelectedColor(clr);
                        setQuantity(1);
                      }}
                      style={[
                        styles.optionBtn,
                        styles.colorOptionBtn,
                        active && styles.optionBtnActive,
                        (!exists || !available) && styles.optionBtnOos,
                      ]}
                    >
                      <View
                        style={[
                          styles.swatchDot,
                          { backgroundColor: resolveColorSwatch(clr) },
                        ]}
                      />
                      <Text
                        style={[
                          styles.optionText,
                          active && styles.optionTextActive,
                          (!exists || !available) && styles.optionTextOos,
                        ]}
                      >
                        {clr}
                        {!available && exists ? ' (Hết)' : ''}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.qtyRow}>
              <Text style={styles.selectorLabel}>Số lượng</Text>
              <View style={styles.stepper}>
                <Pressable
                  onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                  style={styles.stepBtn}
                >
                  <Text style={styles.stepText}>-</Text>
                </Pressable>
                <Text style={styles.qtyValue}>{quantity}</Text>
                <Pressable
                  onPress={() =>
                    setQuantity((q) =>
                      Math.min(Math.max(1, selectedVariant?.stockQuantity ?? 1), q + 1),
                    )
                  }
                  style={styles.stepBtn}
                >
                  <Text style={styles.stepText}>+</Text>
                </Pressable>
              </View>
            </View>

            {cartActionError ? (
              <View style={styles.inlineError}>
                <Text style={styles.inlineErrorText}>{cartActionError}</Text>
              </View>
            ) : null}

            <View style={styles.ctaGroup}>
              <EditorialButton
                label={
                  !user
                    ? 'Đăng nhập để thêm vào giỏ'
                    : outOfStock
                      ? 'Biến thể hết hàng'
                      : 'Thêm vào giỏ hàng'
                }
                onPress={() => void handleAddToCart()}
                loading={addingToCart}
                disabled={Boolean(user && outOfStock)}
              />
              {user?.role === 'CUSTOMER' ? (
                <EditorialButton
                  label="Mở giỏ hàng"
                  variant="secondary"
                  onPress={() => navigate({ name: 'cart' })}
                />
              ) : null}
            </View>

            {/* AC-14: AI Try-On isolated & honestly disabled when TRYON_ENABLED=false */}
            <View style={styles.aiNotice}>
              <Text style={styles.aiNoticeTitle}>Thử đồ AI bằng ảnh (Sắp ra mắt)</Text>
              <Text style={styles.aiNoticeBody}>
                Tính năng AI Try-On đang tắt (TRYON_ENABLED=false). Luồng chọn size và đặt hàng COD
                hoạt động độc lập, không phụ thuộc dịch vụ AI.
              </Text>
            </View>
          </View>
        </View>
      </FadeSlideIn>

      {/* Independent Reviews Panel */}
      <FadeSlideIn delay={90} distance={14}>
        <View style={[styles.reviewsPanel, shadows.card]}>
          <View style={styles.reviewsHeader}>
            <Text style={styles.sectionTitle}>Đánh giá từ khách đã mua ({reviewsTotal})</Text>
          </View>

          {reviewsLoading ? (
            <StateCard kind="loading" title="Đang tải đánh giá sản phẩm..." />
          ) : reviewsError ? (
            <StateCard
              kind="error"
              title="Lỗi tải đánh giá"
              message={reviewsError}
              actionLabel="Thử lại"
              onAction={() => void loadReviews()}
            />
          ) : reviews.length === 0 ? (
            <StateCard
              kind="empty"
              title="Chưa có đánh giá công khai"
              message="Khách hàng sau khi nhận đơn thành công có thể gửi đánh giá 1–5 sao tại chi tiết đơn hàng."
            />
          ) : (
            <View style={styles.reviewList}>
              {reviews.map((rev) => (
                <View key={rev.id} style={styles.reviewItem}>
                  <View style={styles.reviewTop}>
                    <Text style={styles.reviewStars}>
                      {'★'.repeat(rev.rating)}
                      {'☆'.repeat(5 - rev.rating)} ({rev.rating}/5)
                    </Text>
                    <Text style={styles.reviewDate}>{formatDateTime(rev.createdAt)}</Text>
                  </View>
                  <Text style={styles.reviewContent}>{rev.content}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </FadeSlideIn>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  pagePad: { padding: spacing.lg, maxWidth: 960, width: '100%', alignSelf: 'center' },
  content: {
    padding: spacing.xl,
    width: '100%',
    gap: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  breadcrumbRow: { flexDirection: 'row', alignItems: 'center' },
  detailLayout: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.xl,
  },
  detailLayoutWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  galleryCol: { gap: spacing.md },
  thumbRow: { flexDirection: 'row', gap: spacing.sm },
  thumbBox: {
    width: 76,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 3,
  },
  thumbBoxActive: { borderColor: colors.accent, borderWidth: 2 },
  infoCol: { gap: spacing.md },
  productTitle: {
    fontFamily: typography.serif,
    fontSize: 27,
    lineHeight: 34,
    color: colors.ink,
  },
  priceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
  },
  priceText: {
    fontFamily: typography.sans,
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  description: {
    fontFamily: typography.sans,
    fontSize: 14,
    lineHeight: 22,
    color: colors.muted,
    maxWidth: 560,
  },
  selectorBlock: { gap: spacing.xs },
  selectorLabel: {
    fontFamily: typography.sans,
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
  },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  optionBtn: {
    minWidth: 50,
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  colorOptionBtn: { flexDirection: 'row', gap: 6 },
  optionBtnActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  optionBtnOos: { borderColor: colors.border, backgroundColor: colors.surfaceAlt, opacity: 0.6 },
  optionText: { fontFamily: typography.sans, fontSize: 13, color: colors.ink },
  optionTextActive: { color: colors.accent, fontWeight: '700' },
  optionTextOos: { color: colors.muted, textDecorationLine: 'line-through' },
  swatchDot: {
    width: 11,
    height: 11,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: 4,
  },
  stepBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { fontSize: 16, fontWeight: '600', color: colors.ink },
  qtyValue: {
    minWidth: 36,
    textAlign: 'center',
    fontFamily: typography.sans,
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  inlineError: {
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: '#F0C5CD',
    padding: spacing.md,
    borderRadius: radius.sm,
  },
  inlineErrorText: { fontFamily: typography.sans, fontSize: 13, color: colors.danger },
  ctaGroup: { gap: spacing.sm, marginTop: spacing.xs },
  aiNotice: {
    marginTop: spacing.sm,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSoft,
    gap: 4,
  },
  aiNoticeTitle: {
    fontFamily: typography.sans,
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
  },
  aiNoticeBody: {
    fontFamily: typography.sans,
    fontSize: 12,
    lineHeight: 19,
    color: colors.muted,
  },
  reviewsPanel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  reviewsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontFamily: typography.serif, fontSize: 20, color: colors.ink },
  reviewList: { gap: spacing.md },
  reviewItem: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: 6,
  },
  reviewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewStars: { fontFamily: typography.sans, fontSize: 13, fontWeight: '700', color: colors.accent },
  reviewDate: { fontFamily: typography.sans, fontSize: 12, color: colors.muted },
  reviewContent: { fontFamily: typography.sans, fontSize: 14, lineHeight: 20, color: colors.ink },
});
