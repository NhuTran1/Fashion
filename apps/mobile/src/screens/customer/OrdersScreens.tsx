import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { fashionApi } from '../../api/client';
import { EditorialButton, StateCard, StatusBadge } from '../../components/UiPrimitives';
import { useApp } from '../../state/AppContext';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { ApiClientError, EntityId, Order, OrderLine, OrderStatus } from '../../types/api';
import {
  formatDateTime,
  formatVnd,
  getOrderStatusLabel,
  getPaymentStatusLabel,
} from '../../utils/format';

/** Map OrderStatus to a consistent badge tone. */
function orderStatusTone(
  status: OrderStatus,
): 'neutral' | 'accent' | 'success' | 'warning' | 'danger' {
  switch (status) {
    case 'PENDING':
      return 'warning';
    case 'CONFIRMED':
    case 'PACKING':
    case 'SHIPPING':
      return 'accent';
    case 'DELIVERED':
      return 'success';
    case 'CANCELLED':
      return 'danger';
  }
}

/** Customer order history screen implementing listMyOrders (M1-09). */
export function OrdersListScreen(): React.ReactElement {
  const { user, navigate, handleApiError } = useApp();

  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Fetch paginated orders belonging strictly to the authenticated Customer. */
  const fetchOrders = useCallback(
    async (targetPage: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await fashionApi.listMyOrders(targetPage, 10);
        setOrders((prev) => (append ? [...prev, ...res.items] : res.items));
        setTotal(res.total);
        setPage(res.page);
      } catch (err) {
        setError(handleApiError(err, 'Không thể tải danh sách đơn hàng.'));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [handleApiError],
  );

  useEffect(() => {
    if (user?.role === 'CUSTOMER') {
      void fetchOrders(1, false);
    } else {
      setLoading(false);
    }
  }, [fetchOrders, user]);

  if (!user || user.role !== 'CUSTOMER') {
    return (
      <View style={styles.pagePad}>
        <StateCard
          kind="empty"
          title="Cần đăng nhập Customer"
          message="Đăng nhập tài khoản Khách hàng để xem lịch sử và trạng thái đơn hàng."
          actionLabel="Đăng nhập"
          onAction={() => navigate({ name: 'auth', mode: 'login' })}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Đơn hàng của tôi</Text>

      {loading && orders.length === 0 ? (
        <StateCard kind="loading" title="Đang tải lịch sử đơn hàng..." />
      ) : error && orders.length === 0 ? (
        <StateCard
          kind="error"
          title="Không thể tải đơn hàng"
          message={error}
          actionLabel="Thử lại"
          onAction={() => void fetchOrders(1, false)}
        />
      ) : orders.length === 0 ? (
        <StateCard
          kind="empty"
          title="Bạn chưa có đơn hàng nào"
          message="Các đơn đặt COD mô phỏng sẽ xuất hiện tại đây."
          actionLabel="Xem sản phẩm"
          onAction={() => navigate({ name: 'catalog' })}
        />
      ) : (
        <View style={styles.list}>
          {orders.map((order) => (
            <Pressable
              key={order.id}
              onPress={() => navigate({ name: 'order-detail', orderId: order.id })}
              style={styles.orderCard}
            >
              <View style={styles.rowBetween}>
                <Text style={styles.orderId}>Đơn #{order.id}</Text>
                <StatusBadge
                  label={getOrderStatusLabel(order.status)}
                  tone={orderStatusTone(order.status)}
                />
              </View>
              <Text style={styles.metaText}>Đặt lúc: {formatDateTime(order.createdAt)}</Text>
              <Text style={styles.metaText}>
                {order.items.length} sản phẩm · {getPaymentStatusLabel(order.paymentStatus)}
              </Text>
              <View style={styles.rowBetween}>
                <Text style={styles.totalText}>{formatVnd(order.total)}</Text>
                <Text style={styles.linkText}>Xem chi tiết</Text>
              </View>
            </Pressable>
          ))}

          {orders.length < total ? (
            <EditorialButton
              label={loadingMore ? 'Đang tải...' : `Tải thêm (${orders.length}/${total})`}
              variant="secondary"
              loading={loadingMore}
              onPress={() => void fetchOrders(page + 1, true)}
            />
          ) : null}
        </View>
      )}
    </ScrollView>
  );
}

/** Customer order detail screen supporting cancelMyOrder (PENDING only) and verified-purchase reviews. */
export function OrderDetailScreen({ orderId }: { orderId: EntityId }): React.ReactElement {
  const {
    user,
    navigate,
    goBack,
    reviewedOrderItems,
    markOrderItemReviewed,
    handleApiError,
    showToast,
  } = useApp();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  /** Load single Customer-owned order detail. */
  const fetchOrder = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsNotFound(false);
    try {
      const data = await fashionApi.getMyOrder(orderId);
      setOrder(data);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 404) {
        setIsNotFound(true);
      }
      setError(handleApiError(err, 'Không thể tải chi tiết đơn hàng.'));
    } finally {
      setLoading(false);
    }
  }, [handleApiError, orderId]);

  useEffect(() => {
    if (user?.role === 'CUSTOMER') {
      void fetchOrder();
    } else {
      setLoading(false);
    }
  }, [fetchOrder, user]);

  /** Cancel a PENDING order and reload order state if server reports INVALID_ORDER_STATE. */
  const handleCancelOrder = async () => {
    if (!order || order.status !== 'PENDING') return;
    setCancelling(true);
    setCancelError(null);
    try {
      const updated = await fashionApi.cancelMyOrder(order.id);
      setOrder(updated);
      showToast('info', `Đơn #${order.id} đã được hủy và hoàn tồn kho.`);
    } catch (err) {
      const msg = handleApiError(err, 'Không thể hủy đơn hàng.');
      setCancelError(msg);
      if (err instanceof ApiClientError && err.code === 'INVALID_ORDER_STATE') {
        await fetchOrder();
      }
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.pagePad}>
        <StateCard kind="loading" title={`Đang tải đơn #${orderId}...`} />
      </View>
    );
  }

  if (error || !order) {
    return (
      <View style={styles.pagePad}>
        <StateCard
          kind="error"
          title={isNotFound ? 'Không tìm thấy đơn hàng (404)' : 'Lỗi tải chi tiết đơn'}
          message={error || 'Đơn hàng không tồn tại hoặc không thuộc tài khoản của bạn.'}
          actionLabel={isNotFound ? 'Về danh sách đơn' : 'Thử lại'}
          onAction={() => (isNotFound ? navigate({ name: 'orders' }) : void fetchOrder())}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.rowBetween}>
        <EditorialButton label="Quay lại" variant="secondary" compact onPress={goBack} />
        <StatusBadge label={getOrderStatusLabel(order.status)} tone={orderStatusTone(order.status)} />
      </View>

      <Text style={styles.title}>Chi tiết đơn #{order.id}</Text>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.metaText}>Ngày đặt: {formatDateTime(order.createdAt)}</Text>
          <StatusBadge
            label={getPaymentStatusLabel(order.paymentStatus)}
            tone={order.paymentStatus === 'PAID' ? 'success' : 'warning'}
          />
        </View>
        {order.cancelReason ? (
          <Text style={styles.cancelNote}>Lý do hủy: {order.cancelReason}</Text>
        ) : null}

        <View style={styles.divider} />
        <Text style={styles.sectionHeading}>Thông tin nhận hàng (Snapshot)</Text>
        <Text style={styles.boldText}>{order.address.name}</Text>
        <Text style={styles.metaText}>{order.address.phone}</Text>
        <Text style={styles.bodyText}>{order.address.addressText}</Text>

        {order.status === 'PENDING' ? (
          <View style={styles.cancelWrap}>
            {cancelError ? <Text style={styles.errorText}>{cancelError}</Text> : null}
            <EditorialButton
              label="Hủy đơn hàng (chỉ khi PENDING)"
              variant="danger"
              loading={cancelling}
              onPress={() => void handleCancelOrder()}
            />
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionHeading}>Sản phẩm trong đơn</Text>
        {order.items.map((line) => (
          <OrderItemReviewRow
            key={line.id}
            line={line}
            orderStatus={order.status}
            alreadyReviewedInSession={Boolean(reviewedOrderItems[line.id])}
            onReviewed={() => markOrderItemReviewed(line.id)}
          />
        ))}
        <View style={styles.divider} />
        <View style={styles.rowBetween}>
          <Text style={styles.metaText}>Tạm tính</Text>
          <Text style={styles.metaText}>{formatVnd(order.subtotal)}</Text>
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.metaText}>Phí giao hàng (Demo)</Text>
          <Text style={styles.metaText}>{formatVnd(order.shippingFee)}</Text>
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.boldText}>Tổng đơn</Text>
          <Text style={styles.totalText}>{formatVnd(order.total)}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

/** Per-order-item display with verified-purchase review form unlocked only on DELIVERED orders. */
function OrderItemReviewRow({
  line,
  orderStatus,
  alreadyReviewedInSession,
  onReviewed,
}: {
  line: OrderLine;
  orderStatus: OrderStatus;
  alreadyReviewedInSession: boolean;
  onReviewed: () => void;
}): React.ReactElement {
  const { handleApiError, showToast } = useApp();

  const [openForm, setOpenForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockedAlreadyExists, setLockedAlreadyExists] = useState(false);

  /** Submit a verified-purchase review for this specific orderItemId. */
  const handleSubmitReview = async () => {
    setError(null);
    if (!content.trim()) {
      setError('Vui lòng nhập nhận xét của bạn.');
      return;
    }
    setSubmitting(true);
    try {
      await fashionApi.createReview({
        orderItemId: line.id,
        rating,
        content: content.trim(),
      });
      onReviewed();
      setOpenForm(false);
      showToast('success', 'Đã gửi đánh giá sản phẩm thành công.');
    } catch (err) {
      const msg = handleApiError(err, 'Không thể gửi đánh giá.');
      setError(msg);
      if (err instanceof ApiClientError) {
        if (err.code === 'REVIEW_ALREADY_EXISTS') {
          setLockedAlreadyExists(true);
          onReviewed();
        } else if (err.code === 'REVIEW_NOT_ELIGIBLE') {
          setOpenForm(false);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const reviewed = alreadyReviewedInSession || lockedAlreadyExists;

  return (
    <View style={styles.lineBox}>
      <View style={styles.rowBetween}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.boldText}>{line.name}</Text>
          <Text style={styles.metaText}>
            Size {line.size} · Màu {line.color} · SKU {line.sku}
          </Text>
          <Text style={styles.metaText}>
            {formatVnd(line.unitPrice)} × {line.quantity}
          </Text>
        </View>
        <Text style={styles.boldText}>{formatVnd(line.lineTotal)}</Text>
      </View>

      {orderStatus === 'DELIVERED' ? (
        <View style={styles.reviewActionArea}>
          {reviewed ? (
            <StatusBadge label="Đã đánh giá dòng hàng này" tone="success" />
          ) : !openForm ? (
            <EditorialButton
              label="Viết đánh giá (1–5 sao)"
              variant="secondary"
              compact
              onPress={() => {
                setError(null);
                setOpenForm(true);
              }}
            />
          ) : (
            <View style={styles.reviewForm}>
              <Text style={styles.formLabel}>Chọn số sao</Text>
              <View style={styles.starRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Pressable
                    key={star}
                    onPress={() => setRating(star)}
                    style={[styles.starBtn, rating >= star && styles.starBtnActive]}
                  >
                    <Text style={[styles.starText, rating >= star && styles.starTextActive]}>
                      {star} ★
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={content}
                onChangeText={setContent}
                placeholder="Chia sẻ cảm nhận về chất vải, phom dáng, kích cỡ..."
                placeholderTextColor={colors.muted}
                multiline
                style={styles.reviewInput}
              />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <View style={styles.rowGap}>
                <EditorialButton
                  label="Gửi đánh giá"
                  compact
                  loading={submitting}
                  onPress={() => void handleSubmitReview()}
                />
                <EditorialButton
                  label="Đóng"
                  variant="secondary"
                  compact
                  disabled={submitting}
                  onPress={() => setOpenForm(false)}
                />
              </View>
            </View>
          )}
        </View>
      ) : null}
    </View>
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
  title: { fontFamily: typography.serif, fontSize: 24, color: colors.ink },
  sectionHeading: { fontFamily: typography.sans, fontSize: 15, fontWeight: '700', color: colors.ink },
  list: { gap: spacing.md },
  orderCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowGap: { flexDirection: 'row', gap: spacing.sm },
  orderId: { fontFamily: typography.sans, fontSize: 16, fontWeight: '700', color: colors.ink },
  metaText: { fontFamily: typography.sans, fontSize: 13, color: colors.muted },
  bodyText: { fontFamily: typography.sans, fontSize: 14, color: colors.ink, lineHeight: 20 },
  boldText: { fontFamily: typography.sans, fontSize: 14, fontWeight: '600', color: colors.ink },
  totalText: {
    fontFamily: typography.sans,
    fontSize: 16,
    fontWeight: '700',
    color: colors.accent,
    fontVariant: ['tabular-nums'],
  },
  linkText: { fontFamily: typography.sans, fontSize: 13, fontWeight: '600', color: colors.accent },
  cancelNote: { fontFamily: typography.sans, fontSize: 13, color: colors.danger },
  cancelWrap: { marginTop: spacing.sm, gap: spacing.sm },
  errorText: { fontFamily: typography.sans, fontSize: 13, color: colors.danger },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  lineBox: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  reviewActionArea: { alignItems: 'flex-start', gap: spacing.sm },
  reviewForm: {
    width: '100%',
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xs,
    padding: spacing.md,
    gap: spacing.sm,
  },
  formLabel: { fontFamily: typography.sans, fontSize: 13, fontWeight: '600', color: colors.ink },
  starRow: { flexDirection: 'row', gap: spacing.xs },
  starBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.xs,
    backgroundColor: colors.surface,
  },
  starBtnActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  starText: { fontFamily: typography.sans, fontSize: 12, color: colors.muted },
  starTextActive: { color: colors.accent, fontWeight: '700' },
  reviewInput: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.xs,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    fontFamily: typography.sans,
    fontSize: 13,
    color: colors.ink,
    textAlignVertical: 'top',
  },
});
