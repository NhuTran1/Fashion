import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fashionApi } from '../../api/client';
import { FadeSlideIn, InteractiveCard } from '../../components/Motion';
import {
  EditorialButton,
  GarmentArtwork,
  StateCard,
  StatusBadge,
} from '../../components/UiPrimitives';
import { useApp } from '../../state/AppContext';
import { colors, radius, shadows, spacing, typography } from '../../theme/tokens';
import { Address, ApiClientError, CheckoutInput, EntityId, Order, Product, Variant } from '../../types/api';
import { createIdempotencyKey, formatDateTime, formatVnd } from '../../utils/format';
import { DEMO_VOUCHERS } from '../../components/VoucherStrip';
import { FieldInput } from '../../components/UiPrimitives';

interface VariantMeta {
  product: Product;
  variant: Variant;
}

/** Soft-curved shopping cart screen enforcing per-line mutation lock and server totals (M1-09). */
export function CartScreen(): React.ReactElement {
  const { user, cart, refreshCart, navigate, handleApiError, showToast } = useApp();

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [catalogMap, setCatalogMap] = useState<Record<EntityId, VariantMeta>>({});
  const [busyVariants, setBusyVariants] = useState<Record<EntityId, boolean>>({});

  /** Fetch cart alongside active catalog metadata to render garment names and stock limits. */
  const loadCartAndMeta = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [_, productPage] = await Promise.all([
        refreshCart(),
        fashionApi.listProducts({ page: 1, pageSize: 100 }),
      ]);
      const nextMap: Record<EntityId, VariantMeta> = {};
      for (const p of productPage.items) {
        for (const v of p.variants) {
          nextMap[v.id] = { product: p, variant: v };
        }
      }
      setCatalogMap(nextMap);
    } catch (err) {
      setError(handleApiError(err, 'Không thể tải giỏ hàng.'));
    } finally {
      setLoading(false);
    }
  }, [handleApiError, refreshCart]);

  useEffect(() => {
    if (user?.role === 'CUSTOMER') {
      void loadCartAndMeta();
    } else {
      setLoading(false);
    }
  }, [loadCartAndMeta, user]);

  /** Update absolute quantity for a single variant line while preventing concurrent taps. */
  const handleQuantityChange = async (variantId: EntityId, nextQty: number) => {
    if (nextQty < 1 || busyVariants[variantId]) return;
    setBusyVariants((prev) => ({ ...prev, [variantId]: true }));
    try {
      await fashionApi.setCartItemQuantity(variantId, { quantity: nextQty });
      await refreshCart();
    } catch (err) {
      const msg = handleApiError(err, 'Không thể cập nhật số lượng.');
      showToast('error', msg);
      if (err instanceof ApiClientError && err.code === 'OUT_OF_STOCK') {
        await refreshCart();
      }
    } finally {
      setBusyVariants((prev) => ({ ...prev, [variantId]: false }));
    }
  };

  /** Remove a variant line from Customer's cart and sync with server state. */
  const handleRemoveItem = async (variantId: EntityId) => {
    if (busyVariants[variantId]) return;
    setBusyVariants((prev) => ({ ...prev, [variantId]: true }));
    try {
      await fashionApi.removeCartItem(variantId);
      await refreshCart();
      showToast('info', 'Đã xóa sản phẩm khỏi giỏ hàng.');
    } catch (err) {
      showToast('error', handleApiError(err, 'Không thể xóa sản phẩm.'));
    } finally {
      setBusyVariants((prev) => ({ ...prev, [variantId]: false }));
    }
  };

  if (!user || user.role !== 'CUSTOMER') {
    return (
      <View style={styles.pagePad}>
        <StateCard
          kind="empty"
          title="Giỏ hàng dành cho Customer đã đăng nhập"
          message="Theo Q03 hiện tại, vui lòng đăng nhập tài khoản Khách hàng để xem giỏ và đặt đơn."
          actionLabel="Đăng nhập ngay"
          onAction={() => navigate({ name: 'auth', mode: 'login' })}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Giỏ hàng của bạn</Text>

      {loading ? (
        <StateCard kind="loading" title="Đang tải giỏ hàng từ máy chủ..." />
      ) : error ? (
        <StateCard
          kind="error"
          title="Không thể tải giỏ hàng"
          message={error}
          actionLabel="Thử lại"
          onAction={() => void loadCartAndMeta()}
        />
      ) : cart.items.length === 0 ? (
        <StateCard
          kind="empty"
          title="Giỏ hàng đang trống"
          message="Hãy chọn sản phẩm phù hợp từ catalog để thêm vào giỏ."
          actionLabel="Khám phá catalog"
          onAction={() => navigate({ name: 'catalog' })}
        />
      ) : (
        <>
          <View style={styles.list}>
            {cart.items.map((line, idx) => {
              const meta = catalogMap[line.variantId];
              const isBusy = Boolean(busyVariants[line.variantId]);

              return (
                <FadeSlideIn key={line.variantId} delay={idx * 45} distance={12}>
                  <View style={[styles.cartRow, shadows.soft]}>
                    <View style={styles.cartThumb}>
                      <GarmentArtwork
                        uri={meta?.product.images[0]?.url}
                        altText={meta?.product.name || `Variant #${line.variantId}`}
                        height={94}
                      />
                    </View>
                    <View style={styles.cartInfo}>
                      <Text style={styles.itemName}>
                        {meta ? meta.product.name : `Sản phẩm biến thể #${line.variantId}`}
                      </Text>
                      <Text style={styles.itemMeta}>
                        {meta
                          ? `Size ${meta.variant.size} · Màu ${meta.variant.color} · SKU ${meta.variant.sku}`
                          : `Variant ID: ${line.variantId}`}
                      </Text>
                      <Text style={styles.itemPrice}>
                        Đơn giá máy chủ: {formatVnd(line.unitPrice)}
                      </Text>

                      <View style={styles.cartControls}>
                        <View style={styles.stepper}>
                          <Pressable
                            disabled={isBusy || line.quantity <= 1}
                            onPress={() =>
                              void handleQuantityChange(line.variantId, line.quantity - 1)
                            }
                            style={[styles.stepBtn, (isBusy || line.quantity <= 1) && { opacity: 0.4 }]}
                          >
                            <Text style={styles.stepText}>-</Text>
                          </Pressable>
                          <Text style={styles.qtyVal}>{line.quantity}</Text>
                          <Pressable
                            disabled={isBusy}
                            onPress={() =>
                              void handleQuantityChange(line.variantId, line.quantity + 1)
                            }
                            style={[styles.stepBtn, isBusy && { opacity: 0.4 }]}
                          >
                            <Text style={styles.stepText}>+</Text>
                          </Pressable>
                        </View>

                        <EditorialButton
                          label="Xóa"
                          variant="ghost"
                          compact
                          disabled={isBusy}
                          onPress={() => void handleRemoveItem(line.variantId)}
                        />
                      </View>
                    </View>
                    <View style={styles.lineTotalCol}>
                      <Text style={styles.lineTotal}>{formatVnd(line.lineTotal)}</Text>
                    </View>
                  </View>
                </FadeSlideIn>
              );
            })}
          </View>

          <FadeSlideIn delay={80} distance={12}>
            <View style={[styles.summaryCard, shadows.card]}>
              <View style={styles.rowBetween}>
                <Text style={styles.summaryLabel}>Tạm tính (máy chủ xác thực)</Text>
                <Text style={styles.summaryValue}>{formatVnd(cart.subtotal)}</Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.summaryMuted}>Phí vận chuyển (Demo)</Text>
                <Text style={styles.summaryMuted}>0 ₫</Text>
              </View>
              <EditorialButton
                label="Tiến hành thanh toán COD"
                onPress={() => navigate({ name: 'checkout' })}
                style={{ marginTop: spacing.sm }}
              />
            </View>
          </FadeSlideIn>
        </>
      )}
    </ScrollView>
  );
}

/**
 * Simulated COD checkout confirmation screen supporting Idempotency-Key retries,
 * CART_CHANGED/OUT_OF_STOCK recovery, and IDEMPOTENCY_CONFLICT locking (M1-06 / M1-09).
 */
export function CheckoutScreen(): React.ReactElement {
  const { user, cart, refreshCart, navigate, goBack, handleApiError, showToast } = useApp();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<EntityId | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => createIdempotencyKey());
  const [frozenItems, setFrozenItems] = useState<CheckoutInput['items'] | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [conflictLocked, setConflictLocked] = useState<boolean>(false);
  const [voucherInput, setVoucherInput] = useState<string>('');
  const [appliedVoucherNote, setAppliedVoucherNote] = useState<string | null>(null);

  /** Load latest server cart and Customer shipping addresses before checkout. */
  const loadCheckoutData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      await refreshCart();
      const addrList = await fashionApi.listAddresses();
      setAddresses(addrList);
      const def = addrList.find((a) => a.isDefault) ?? addrList[0];
      setSelectedAddressId(def?.id ?? null);
    } catch (err) {
      setLoadError(handleApiError(err, 'Không thể tải dữ liệu thanh toán.'));
    } finally {
      setLoading(false);
    }
  }, [handleApiError, refreshCart]);

  useEffect(() => {
    if (user?.role === 'CUSTOMER') {
      void loadCheckoutData();
    } else {
      setLoading(false);
    }
  }, [loadCheckoutData, user]);

  const effectiveItems = useMemo(
    () =>
      frozenItems ??
      cart.items.map((i) => ({
        variantId: i.variantId,
        quantity: i.quantity,
      })),
    [cart.items, frozenItems],
  );

  /** Submit COD checkout while keeping the same Idempotency-Key & payload across retries. */
  const handlePlaceOrder = async (useNewKey = false) => {
    if (!selectedAddressId) {
      setCheckoutError('Vui lòng chọn hoặc thêm địa chỉ giao hàng.');
      return;
    }
    if (effectiveItems.length === 0) {
      navigate({ name: 'cart' });
      return;
    }

    const activeKey = useNewKey ? createIdempotencyKey() : idempotencyKey;
    if (useNewKey) {
      setIdempotencyKey(activeKey);
      setConflictLocked(false);
    }
    const payload: CheckoutInput = {
      addressId: selectedAddressId,
      method: 'COD',
      items: effectiveItems,
    };
    if (!frozenItems) {
      setFrozenItems(effectiveItems);
    }

    setSubmitting(true);
    setCheckoutError(null);
    try {
      const result = await fashionApi.checkoutCod(activeKey, payload);
      await refreshCart();
      showToast(
        'success',
        result.replayed ? 'Đã khôi phục đơn từ Idempotency-Key.' : 'Đặt đơn COD mô phỏng thành công.',
      );
      navigate({ name: 'order-success', order: result.order, replayed: result.replayed });
    } catch (err) {
      const msg = handleApiError(err, 'Không thể đặt hàng.');
      setCheckoutError(msg);
      if (err instanceof ApiClientError) {
        if (err.code === 'CART_CHANGED' || err.code === 'OUT_OF_STOCK') {
          setFrozenItems(null);
          setIdempotencyKey(createIdempotencyKey());
          await refreshCart();
        } else if (err.code === 'IDEMPOTENCY_CONFLICT') {
          setConflictLocked(true);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!user || user.role !== 'CUSTOMER') {
    return (
      <View style={styles.pagePad}>
        <StateCard
          kind="error"
          title="Cần đăng nhập Customer"
          actionLabel="Đăng nhập"
          onAction={() => navigate({ name: 'auth', mode: 'login' })}
        />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.pagePad}>
        <StateCard kind="loading" title="Đang chuẩn bị thông tin checkout COD..." />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.pagePad}>
        <StateCard
          kind="error"
          title="Lỗi tải trang thanh toán"
          message={loadError}
          actionLabel="Thử lại"
          onAction={() => void loadCheckoutData()}
        />
      </View>
    );
  }

  if (cart.items.length === 0 && !frozenItems) {
    return (
      <View style={styles.pagePad}>
        <StateCard
          kind="empty"
          title="Giỏ hàng trống"
          message="Quay lại giỏ hàng hoặc chọn sản phẩm trước khi thanh toán."
          actionLabel="Quay lại giỏ hàng"
          onAction={() => navigate({ name: 'cart' })}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.rowBetween}>
        <EditorialButton label="Quay lại giỏ" variant="secondary" compact onPress={goBack} />
        <StatusBadge label="COD mô phỏng (Demo)" tone="accent" />
      </View>

      <Text style={styles.title}>Xác nhận đặt hàng COD</Text>

      <FadeSlideIn distance={12}>
        <View style={[styles.noticeBox, shadows.soft]}>
          <Text style={styles.noticeTitle}>Lưu ý thanh toán mô phỏng (P0)</Text>
          <Text style={styles.noticeBody}>
            Đơn hàng dùng phương thức COD mô phỏng (không thu tiền thật, không nhập thẻ). Đơn mới có
            trạng thái PENDING và thanh toán UNPAID cho tới khi Admin xác nhận giao và thu COD.
          </Text>
        </View>
      </FadeSlideIn>

      {/* Address selection */}
      <FadeSlideIn delay={50} distance={12}>
        <View style={[styles.summaryCard, shadows.card]}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionHeading}>Địa chỉ giao hàng</Text>
            <EditorialButton
              label="Quản lý địa chỉ"
              variant="ghost"
              compact
              onPress={() => navigate({ name: 'addresses' })}
            />
          </View>
          {addresses.length === 0 ? (
            <StateCard
              kind="empty"
              title="Chưa có địa chỉ giao hàng"
              message="Bạn cần tạo ít nhất một địa chỉ trước khi đặt đơn."
              actionLabel="Thêm địa chỉ ngay"
              onAction={() => navigate({ name: 'addresses' })}
            />
          ) : (
            <View style={styles.addrOptions}>
              {addresses.map((addr) => {
                const active = addr.id === selectedAddressId;
                return (
                  <InteractiveCard
                    key={addr.id}
                    onPress={() => setSelectedAddressId(addr.id)}
                    style={[styles.addrPick, active && styles.addrPickActive]}
                  >
                    <View style={styles.rowBetween}>
                      <Text style={styles.itemName}>{addr.name}</Text>
                      {addr.isDefault ? <StatusBadge label="Mặc định" tone="accent" /> : null}
                    </View>
                    <Text style={styles.itemMeta}>{addr.phone}</Text>
                    <Text style={styles.addrBody}>{addr.addressText}</Text>
                  </InteractiveCard>
                );
              })}
            </View>
          )}
        </View>
      </FadeSlideIn>

      {/* Order Snapshot Preview */}
      <FadeSlideIn delay={90} distance={12}>
        <View style={[styles.summaryCard, shadows.card]}>
          <Text style={styles.sectionHeading}>Tóm tắt đơn hàng</Text>
          {cart.items.map((item) => (
            <View key={item.variantId} style={styles.rowBetween}>
              <Text style={styles.itemMeta}>
                Biến thể #{item.variantId} × {item.quantity}
              </Text>
              <Text style={styles.summaryMuted}>{formatVnd(item.lineTotal)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.rowBetween}>
            <Text style={styles.summaryMuted}>Tạm tính</Text>
            <Text style={styles.summaryMuted}>{formatVnd(cart.subtotal)}</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.summaryMuted}>Phí giao hàng (Demo)</Text>
            <Text style={styles.summaryMuted}>0 ₫</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.summaryLabel}>Tổng thanh toán COD</Text>
            <Text style={styles.summaryValue}>{formatVnd(cart.subtotal)}</Text>
          </View>
          <Text style={styles.idemMeta}>Idempotency-Key: {idempotencyKey}</Text>

          <View style={styles.divider} />
          <FieldInput
            label="Mã ưu đãi / Voucher (P1 Preview)"
            value={voucherInput}
            onChangeText={setVoucherInput}
            autoCapitalize="characters"
            placeholder="Nhập HELLO, FREESHIP, SOI50K hoặc SOI50..."
          />
          <View style={styles.rowBetween}>
            <EditorialButton
              label="Kiểm tra mã"
              variant="secondary"
              compact
              onPress={() => {
                const code = voucherInput.trim().toUpperCase();
                const match = DEMO_VOUCHERS.find((v) => v.code === code);
                if (match) {
                  setAppliedVoucherNote(
                    `Mã ${match.code}: ${match.description}. (Lưu ý: OpenAPI MVP A tính tổng server nguyên giá, voucher áp dụng từ P1-02).`,
                  );
                } else {
                  setAppliedVoucherNote('Mã không hợp lệ. Thử HELLO, FREESHIP, SOI50K hoặc SOI50.');
                }
              }}
            />
            {appliedVoucherNote ? (
              <Text style={[styles.summaryMuted, { flex: 1 }]}>{appliedVoucherNote}</Text>
            ) : null}
          </View>
        </View>
      </FadeSlideIn>

      {checkoutError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{checkoutError}</Text>
          {conflictLocked ? (
            <EditorialButton
              label="Kiểm tra lịch sử đơn"
              variant="secondary"
              compact
              onPress={() => navigate({ name: 'orders' })}
              style={{ marginTop: spacing.sm }}
            />
          ) : null}
        </View>
      ) : null}

      <View style={styles.checkoutActions}>
        <EditorialButton
          label={
            conflictLocked
              ? 'Key bị xung đột — Tạo key mới để đặt'
              : checkoutError && frozenItems
                ? 'Thử lại cùng Idempotency-Key'
                : 'Đặt hàng COD mô phỏng'
          }
          loading={submitting}
          disabled={addresses.length === 0 || conflictLocked}
          onPress={() => void handlePlaceOrder(false)}
        />
        {checkoutError && !conflictLocked ? (
          <EditorialButton
            label="Đặt lại với Idempotency-Key mới"
            variant="secondary"
            disabled={submitting}
            onPress={() => void handlePlaceOrder(true)}
          />
        ) : null}
      </View>
    </ScrollView>
  );
}

/** Order confirmation screen shown identically for 201 Created and 200 Replay. */
export function OrderSuccessScreen({
  order,
  replayed,
}: {
  order: Order;
  replayed: boolean;
}): React.ReactElement {
  const { navigate } = useApp();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <FadeSlideIn distance={16} duration={400}>
        <View style={[styles.summaryCard, shadows.lifted]}>
          <View style={styles.rowBetween}>
            <StatusBadge
              label={replayed ? '200 Replay (Idempotent)' : '201 Đã tạo đơn'}
              tone="success"
            />
            <StatusBadge label="COD mô phỏng" tone="accent" />
          </View>
          <Text style={styles.title}>Đặt hàng thành công · Đơn #{order.id}</Text>
          <Text style={styles.noticeBody}>
            Đơn hàng đã được ghi nhận lúc {formatDateTime(order.createdAt)}. Trạng thái hiện tại:{' '}
            {order.status} · Thanh toán: {order.paymentStatus}.
          </Text>

          <View style={styles.divider} />
          <Text style={styles.sectionHeading}>Người nhận (Snapshot bất biến)</Text>
          <Text style={styles.itemName}>{order.address.name}</Text>
          <Text style={styles.itemMeta}>{order.address.phone}</Text>
          <Text style={styles.addrBody}>{order.address.addressText}</Text>

          <View style={styles.divider} />
          {order.items.map((line) => (
            <View key={line.id} style={styles.rowBetween}>
              <Text style={styles.itemMeta}>
                {line.name} ({line.size}/{line.color}) × {line.quantity}
              </Text>
              <Text style={styles.summaryMuted}>{formatVnd(line.lineTotal)}</Text>
            </View>
          ))}

          <View style={styles.divider} />
          <View style={styles.rowBetween}>
            <Text style={styles.summaryLabel}>Tổng cộng</Text>
            <Text style={styles.summaryValue}>{formatVnd(order.total)}</Text>
          </View>

          <View style={styles.checkoutActions}>
            <EditorialButton
              label="Xem chi tiết đơn hàng"
              onPress={() => navigate({ name: 'order-detail', orderId: order.id })}
            />
            <EditorialButton
              label="Tiếp tục xem catalog"
              variant="secondary"
              onPress={() => navigate({ name: 'catalog' })}
            />
          </View>
        </View>
      </FadeSlideIn>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  pagePad: { padding: spacing.lg, maxWidth: 820, width: '100%', alignSelf: 'center' },
  content: {
    padding: spacing.lg,
    maxWidth: 820,
    width: '100%',
    alignSelf: 'center',
    gap: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  title: { fontFamily: typography.serif, fontSize: 25, color: colors.ink },
  sectionHeading: { fontFamily: typography.sans, fontSize: 15, fontWeight: '700', color: colors.ink },
  list: { gap: spacing.md },
  cartRow: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  cartThumb: { width: 86 },
  cartInfo: { flex: 1, gap: 4 },
  itemName: { fontFamily: typography.sans, fontSize: 15, fontWeight: '600', color: colors.ink },
  itemMeta: { fontFamily: typography.sans, fontSize: 13, color: colors.muted },
  itemPrice: { fontFamily: typography.sans, fontSize: 13, color: colors.ink },
  cartControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: 3,
  },
  stepBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 15, fontWeight: '600', color: colors.ink },
  qtyVal: {
    minWidth: 28,
    textAlign: 'center',
    fontFamily: typography.sans,
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  lineTotalCol: { alignItems: 'flex-end', paddingRight: spacing.xs },
  lineTotal: {
    fontFamily: typography.sans,
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  summaryLabel: { fontFamily: typography.sans, fontSize: 15, fontWeight: '700', color: colors.ink },
  summaryValue: {
    fontFamily: typography.sans,
    fontSize: 21,
    fontWeight: '700',
    color: colors.accent,
    fontVariant: ['tabular-nums'],
  },
  summaryMuted: {
    fontFamily: typography.sans,
    fontSize: 13,
    color: colors.muted,
    fontVariant: ['tabular-nums'],
  },
  noticeBox: {
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: '#CFDAEC',
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: 4,
  },
  noticeTitle: { fontFamily: typography.sans, fontSize: 13, fontWeight: '700', color: colors.accent },
  noticeBody: { fontFamily: typography.sans, fontSize: 13, lineHeight: 20, color: colors.ink },
  addrOptions: { gap: spacing.sm },
  addrPick: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.md,
    gap: 3,
  },
  addrPickActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  addrBody: { fontFamily: typography.sans, fontSize: 13, color: colors.ink },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  idemMeta: {
    fontFamily: typography.mono,
    fontSize: 11,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  errorBanner: {
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: '#F0C5CD',
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  errorBannerText: { fontFamily: typography.sans, fontSize: 13, color: colors.danger },
  checkoutActions: { gap: spacing.sm, marginTop: spacing.xs },
});
