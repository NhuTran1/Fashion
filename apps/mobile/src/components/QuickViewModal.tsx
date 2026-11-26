import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { fashionApi } from '../api/client';
import { useApp } from '../state/AppContext';
import {
  colors,
  radius,
  resolveColorSwatch,
  shadows,
  spacing,
  typography,
} from '../theme/tokens';
import { ApiClientError, Product } from '../types/api';
import { formatVnd } from '../utils/format';
import { FadeSlideIn } from './Motion';
import { EditorialButton, GarmentArtwork, StatusBadge } from './UiPrimitives';

/** Quick View modal triggered from product card hover actions for instant size/color picking. */
export function QuickViewModal({
  product,
  initialColor,
  onClose,
  onOpenFullDetail,
  onStockChanged,
}: {
  product: Product | null;
  initialColor?: string;
  onClose: () => void;
  onOpenFullDetail: (productId: string, color?: string) => void;
  onStockChanged: () => void;
}): React.ReactElement | null {
  const { user, navigate, refreshCart, handleApiError, showToast } = useApp();
  const { width } = useWindowDimensions();
  const isCompact = width < 640;

  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!product) return;
    const preferred = initialColor
      ? product.variants.find((v) => v.color === initialColor && v.stockQuantity > 0) ??
        product.variants.find((v) => v.color === initialColor)
      : undefined;
    const first =
      preferred ?? product.variants.find((v) => v.stockQuantity > 0) ?? product.variants[0];
    if (first) {
      setSelectedSize(first.size);
      setSelectedColor(first.color);
    }
    setQuantity(1);
    setError(null);
  }, [initialColor, product]);

  const sizes = useMemo(
    () => (product ? Array.from(new Set(product.variants.map((v) => v.size))) : []),
    [product],
  );
  const colorList = useMemo(
    () => (product ? Array.from(new Set(product.variants.map((v) => v.color))) : []),
    [product],
  );
  const selectedVariant = useMemo(() => {
    if (!product) return undefined;
    return product.variants.find((v) => v.size === selectedSize && v.color === selectedColor);
  }, [product, selectedColor, selectedSize]);

  if (!product) return null;

  /** Add selected variant to Customer cart directly from Quick View modal. */
  const handleAdd = async () => {
    setError(null);
    if (!user) {
      onClose();
      showToast('info', 'Vui lòng đăng nhập Customer để thêm vào giỏ.');
      navigate({ name: 'auth', mode: 'login' });
      return;
    }
    if (user.role !== 'CUSTOMER') {
      setError('Tài khoản Quản trị/Nhân viên không dùng giỏ hàng.');
      return;
    }
    if (!selectedVariant || selectedVariant.stockQuantity <= 0) {
      setError('Biến thể đang hết hàng, vui lòng chọn size hoặc màu khác.');
      return;
    }
    setAdding(true);
    try {
      await fashionApi.addCartItem({ variantId: selectedVariant.id, quantity });
      await refreshCart();
      showToast(
        'success',
        `Đã thêm ${quantity} × ${product.name} (${selectedVariant.size}/${selectedVariant.color}) vào giỏ.`,
      );
      onClose();
    } catch (err) {
      setError(handleApiError(err));
      if (err instanceof ApiClientError && err.code === 'OUT_OF_STOCK') {
        onStockChanged();
      }
    } finally {
      setAdding(false);
    }
  };

  const outOfStock = !selectedVariant || selectedVariant.stockQuantity <= 0;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, isCompact && styles.overlayMobile]}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <FadeSlideIn
          distance={16}
          duration={240}
          style={[styles.dialog, isCompact && styles.dialogMobile, shadows.lifted]}
        >
          <View style={styles.topBar}>
            <Text style={styles.dialogTitle}>Xem nhanh sản phẩm</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>Đóng ✕</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={[styles.contentRow, isCompact && styles.contentRowMobile]}>
              <View style={[styles.artCol, isCompact && styles.artColMobile]}>
                <GarmentArtwork
                  uri={product.images[0]?.url}
                  altText={product.name}
                  aspectRatio={isCompact ? undefined : 3 / 4}
                  height={isCompact ? 200 : undefined}
                  overrideToneHex={
                    selectedColor ? resolveColorSwatch(selectedColor) : undefined
                  }
                />
              </View>

              <View style={[styles.infoCol, isCompact && styles.infoColMobile]}>
                <Text style={styles.prodName}>{product.name}</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.price}>
                    {selectedVariant ? formatVnd(selectedVariant.price) : 'Chọn biến thể'}
                  </Text>
                  {selectedVariant ? (
                    <StatusBadge
                      label={
                        selectedVariant.stockQuantity > 0
                          ? `Còn ${selectedVariant.stockQuantity} · ${selectedVariant.sku}`
                          : 'Hết hàng'
                      }
                      tone={selectedVariant.stockQuantity > 0 ? 'success' : 'danger'}
                    />
                  ) : null}
                </View>

                <Text style={styles.desc}>{product.description}</Text>

                <Text style={styles.label}>Kích cỡ</Text>
                <View style={styles.chipRow}>
                  {sizes.map((sz) => (
                    <Pressable
                      key={sz}
                      onPress={() => setSelectedSize(sz)}
                      style={[styles.chip, selectedSize === sz && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, selectedSize === sz && styles.chipTextActive]}>
                        {sz}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.label}>Màu sắc</Text>
                <View style={styles.chipRow}>
                  {colorList.map((clr) => (
                    <Pressable
                      key={clr}
                      onPress={() => setSelectedColor(clr)}
                      style={[styles.chip, selectedColor === clr && styles.chipActive]}
                    >
                      <View
                        style={[styles.swatchDot, { backgroundColor: resolveColorSwatch(clr) }]}
                      />
                      <Text
                        style={[styles.chipText, selectedColor === clr && styles.chipTextActive]}
                      >
                        {clr}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.qtyRow}>
                  <Text style={styles.label}>Số lượng</Text>
                  <View style={styles.stepper}>
                    <Pressable
                      onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                      style={styles.stepBtn}
                    >
                      <Text style={styles.stepText}>-</Text>
                    </Pressable>
                    <Text style={styles.qtyVal}>{quantity}</Text>
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

                {error ? <Text style={styles.errText}>{error}</Text> : null}

                <View style={styles.actions}>
                  <EditorialButton
                    label={
                      !user
                        ? 'Đăng nhập để thêm giỏ'
                        : outOfStock
                          ? 'Hết hàng'
                          : 'Thêm vào giỏ hàng'
                    }
                    loading={adding}
                    disabled={Boolean(user && outOfStock)}
                    onPress={() => void handleAdd()}
                  />
                  <EditorialButton
                    label="Mở trang chi tiết & Đánh giá"
                    variant="secondary"
                    onPress={() => {
                      onClose();
                      onOpenFullDetail(product.id, selectedColor);
                    }}
                  />
                </View>
              </View>
            </View>
          </ScrollView>
        </FadeSlideIn>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  overlayMobile: {
    padding: spacing.sm,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(20, 28, 24, 0.48)',
  },
  dialog: {
    width: '100%',
    maxWidth: 780,
    maxHeight: '90%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.md,
  },
  dialogMobile: {
    maxHeight: '92%',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
  },
  dialogTitle: {
    fontFamily: typography.serif,
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
  },
  closeBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  closeText: {
    fontFamily: typography.sans,
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
  },
  contentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xl,
  },
  contentRowMobile: {
    flexDirection: 'column',
    gap: spacing.md,
  },
  artCol: {
    width: 240,
    flexGrow: 1,
  },
  artColMobile: {
    width: '100%',
    flexGrow: 0,
  },
  infoCol: {
    flex: 1.4,
    minWidth: 250,
    gap: spacing.sm,
  },
  infoColMobile: {
    flex: undefined,
    flexGrow: 0,
    flexBasis: 'auto',
    minWidth: 0,
    width: '100%',
  },
  prodName: {
    fontFamily: typography.serif,
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
  },
  priceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  price: {
    fontFamily: typography.sans,
    fontSize: 20,
    fontWeight: '800',
    color: colors.accent,
  },
  desc: {
    fontFamily: typography.sans,
    fontSize: 13,
    lineHeight: 20,
    color: colors.muted,
  },
  label: {
    fontFamily: typography.sans,
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  chipText: {
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.ink,
  },
  chipTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  swatchDot: {
    width: 10,
    height: 10,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  qtyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 4,
  },
  stepBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 15, fontWeight: '700', color: colors.ink },
  qtyVal: { minWidth: 28, textAlign: 'center', fontWeight: '700', color: colors.ink },
  errText: { fontFamily: typography.sans, fontSize: 12, color: colors.danger },
  actions: { gap: spacing.sm, marginTop: spacing.xs },
});
