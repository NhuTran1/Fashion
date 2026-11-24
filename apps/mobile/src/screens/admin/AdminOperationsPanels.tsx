import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { fashionApi } from '../../api/client';
import {
  EditorialButton,
  FieldInput,
  StateCard,
  StatusBadge,
} from '../../components/UiPrimitives';
import { ALL_STAFF_PERMISSIONS } from '../../mock/seedData';
import { useApp } from '../../state/AppContext';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import {
  AdminAuditLog,
  AdminReview,
  EntityId,
  InventoryMovementHistory,
  Order,
  OrderStatus,
  Product,
  StaffPermission,
  User,
  Variant,
} from '../../types/api';
import {
  formatDateTime,
  formatVnd,
  getOrderStatusLabel,
  getPaymentStatusLabel,
} from '../../utils/format';

/** Admin/Staff inventory panel supporting adjustInventory and listInventoryAdjustments (M1-10). */
export function AdminInventoryPanel(): React.ReactElement {
  const { handleApiError, showToast } = useApp();

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<{
    productName: string;
    variant: Variant;
  } | null>(null);
  const [history, setHistory] = useState<InventoryMovementHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [deltaStr, setDeltaStr] = useState('5');
  const [reason, setReason] = useState('');
  const [mutating, setMutating] = useState(false);
  const [mutateError, setMutateError] = useState<string | null>(null);

  /** Load catalog variants so operator can pick a SKU to inspect or adjust. */
  const loadVariants = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const page = await fashionApi.listAdminProducts(1, 50);
      setProducts(page.items);
      if (selectedVariant) {
        for (const p of page.items) {
          const found = p.variants.find((v) => v.id === selectedVariant.variant.id);
          if (found) {
            setSelectedVariant({ productName: p.name, variant: found });
            break;
          }
        }
      } else if (page.items[0]?.variants[0]) {
        setSelectedVariant({ productName: page.items[0].name, variant: page.items[0].variants[0] });
      }
    } catch (err) {
      setLoadError(handleApiError(err, 'Không thể tải danh sách biến thể.'));
    } finally {
      setLoading(false);
    }
  }, [handleApiError, selectedVariant]);

  /** Load movement audit history for the selected variant ID. */
  const loadHistory = useCallback(
    async (variantId: EntityId) => {
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const res = await fashionApi.listInventoryAdjustments(variantId, 1, 20);
        setHistory(res.items);
      } catch (err) {
        setHistoryError(handleApiError(err, 'Không thể tải lịch sử biến động tồn.'));
      } finally {
        setHistoryLoading(false);
      }
    },
    [handleApiError],
  );

  useEffect(() => {
    void loadVariants();
  }, [loadVariants]);

  useEffect(() => {
    if (selectedVariant) {
      void loadHistory(selectedVariant.variant.id);
    }
  }, [loadHistory, selectedVariant]);

  /** Submit inventory delta + reason; preserves form input and reloads stock on server rejection. */
  const handleAdjust = async () => {
    if (!selectedVariant) return;
    setMutateError(null);
    const delta = Number.parseInt(deltaStr.trim(), 10);
    if (!Number.isInteger(delta) || delta === 0 || !reason.trim()) {
      setMutateError('Cần nhập số nguyên khác 0 và lý do điều chỉnh.');
      return;
    }
    setMutating(true);
    try {
      const mv = await fashionApi.adjustInventory(selectedVariant.variant.id, {
        delta,
        reason: reason.trim(),
      });
      setReason('');
      showToast('success', `Đã cập nhật tồn ${selectedVariant.variant.sku}: còn ${mv.stockQuantity}`);
      await loadVariants();
      await loadHistory(selectedVariant.variant.id);
    } catch (err) {
      setMutateError(handleApiError(err, 'Không thể điều chỉnh tồn kho.'));
      await loadVariants();
    } finally {
      setMutating(false);
    }
  };

  if (loading) return <StateCard kind="loading" title="Đang tải tồn kho SKU..." />;
  if (loadError) {
    return (
      <StateCard
        kind="error"
        title="Lỗi tải tồn kho"
        message={loadError}
        actionLabel="Thử lại"
        onAction={() => void loadVariants()}
      />
    );
  }

  return (
    <View style={styles.stack}>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Chọn biến thể SKU</Text>
        <View style={styles.listStack}>
          {products.map((p) =>
            p.variants.map((v) => {
              const active = selectedVariant?.variant.id === v.id;
              return (
                <Pressable
                  key={v.id}
                  onPress={() => {
                    setSelectedVariant({ productName: p.name, variant: v });
                    setMutateError(null);
                  }}
                  style={[styles.rowCard, active && styles.rowCardActive]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.boldText}>
                      {v.sku} · {p.name}
                    </Text>
                    <Text style={styles.mutedText}>
                      Size {v.size} · {v.color}
                    </Text>
                  </View>
                  <StatusBadge
                    label={`Tồn: ${v.stockQuantity}`}
                    tone={v.stockQuantity > 0 ? 'success' : 'danger'}
                  />
                </Pressable>
              );
            }),
          )}
        </View>
      </View>

      {selectedVariant ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>
            Điều chỉnh tồn: {selectedVariant.variant.sku} (Hiện tại: {selectedVariant.variant.stockQuantity})
          </Text>
          {mutateError ? <Text style={styles.errorText}>{mutateError}</Text> : null}
          <FieldInput
            label="Số lượng thay đổi (ví dụ +5 hoặc -2)"
            value={deltaStr}
            onChangeText={setDeltaStr}
            keyboardType="numbers-and-punctuation"
          />
          <FieldInput
            label="Lý do điều chỉnh (bắt buộc)"
            value={reason}
            onChangeText={setReason}
            placeholder="Nhập lô mới / Kiểm kê kho định kỳ"
          />
          <EditorialButton
            label="Xác nhận điều chỉnh tồn"
            loading={mutating}
            onPress={() => void handleAdjust()}
          />

          <View style={styles.divider} />
          <Text style={styles.subTitle}>Lịch sử biến động tồn</Text>
          {historyLoading ? (
            <StateCard kind="loading" title="Đang tải lịch sử biến động..." />
          ) : historyError ? (
            <StateCard
              kind="error"
              title="Lỗi tải lịch sử biến động"
              message={historyError}
              actionLabel="Thử lại"
              onAction={() => void loadHistory(selectedVariant.variant.id)}
            />
          ) : history.length === 0 ? (
            <StateCard kind="empty" title="Chưa có biến động nào cho biến thể này" />
          ) : (
            <View style={styles.listStack}>
              {history.map((h) => (
                <View key={h.id} style={styles.rowCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.boldText}>{h.reason}</Text>
                    <Text style={styles.mutedText}>{formatDateTime(h.createdAt)}</Text>
                  </View>
                  <StatusBadge
                    label={h.delta > 0 ? `+${h.delta}` : String(h.delta)}
                    tone={h.delta > 0 ? 'success' : 'warning'}
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

const ORDER_FILTERS: Array<OrderStatus | 'ALL'> = [
  'ALL',
  'PENDING',
  'CONFIRMED',
  'PACKING',
  'SHIPPING',
  'DELIVERED',
  'CANCELLED',
];

/** Admin/Staff order fulfillment queue implementing M1-10 order transitions & COD delivery. */
export function AdminOrdersPanel(): React.ReactElement {
  const { hasStaffPermission, handleApiError, showToast } = useApp();

  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL');
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  const canRead = hasStaffPermission('orders.read');
  const canProcess = hasStaffPermission('orders.process');

  /** Fetch orders queue from Admin Orders endpoint. */
  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await fashionApi.listAdminOrders(
        1,
        50,
        statusFilter === 'ALL' ? undefined : statusFilter,
      );
      setOrders(page.items);
      if (selectedOrder) {
        const refreshed = page.items.find((o) => o.id === selectedOrder.id);
        setSelectedOrder(refreshed ?? page.items[0] ?? null);
      } else {
        setSelectedOrder(page.items[0] ?? null);
      }
    } catch (err) {
      setError(handleApiError(err, 'Không thể tải danh sách đơn hàng.'));
    } finally {
      setLoading(false);
    }
  }, [handleApiError, selectedOrder, statusFilter]);

  useEffect(() => {
    if (canRead) {
      void loadOrders();
    } else {
      setLoading(false);
    }
  }, [canRead, loadOrders]);

  if (!canRead) {
    return (
      <StateCard
        kind="error"
        title="403 — Thiếu quyền orders.read"
        message="Theo RBAC v1, tài khoản chỉ có orders.process không được mở danh sách hoặc chi tiết đơn hàng."
      />
    );
  }

  /** Advance order to next valid sequential state. */
  const handleAdvance = async (order: Order, nextStatus: 'CONFIRMED' | 'PACKING' | 'SHIPPING') => {
    setActionBusy(true);
    try {
      const updated = await fashionApi.advanceAdminOrder(order.id, { status: nextStatus });
      setSelectedOrder(updated);
      showToast('success', `Đơn #${order.id} → ${nextStatus}`);
      await loadOrders();
    } catch (err) {
      showToast('error', handleApiError(err));
      await loadOrders();
    } finally {
      setActionBusy(false);
    }
  };

  /** Confirm simulated delivery & COD cash collection from SHIPPING state. */
  const handleConfirmDeliveryCod = async (order: Order) => {
    setActionBusy(true);
    try {
      const updated = await fashionApi.confirmDeliveryAndCod(order.id);
      setSelectedOrder(updated);
      showToast('success', `Đơn #${order.id} đã giao và thu COD mô phỏng (PAID).`);
      await loadOrders();
    } catch (err) {
      showToast('error', handleApiError(err));
      await loadOrders();
    } finally {
      setActionBusy(false);
    }
  };

  /** Cancel an order prior to SHIPPING with mandatory reason. */
  const handleCancelOrder = async (order: Order) => {
    if (!cancelReason.trim()) {
      showToast('error', 'Vui lòng nhập lý do hủy đơn.');
      return;
    }
    setActionBusy(true);
    try {
      const updated = await fashionApi.cancelAdminOrder(order.id, { reason: cancelReason.trim() });
      setCancelReason('');
      setSelectedOrder(updated);
      showToast('info', `Đã hủy đơn #${order.id} và hoàn tồn kho.`);
      await loadOrders();
    } catch (err) {
      showToast('error', handleApiError(err));
      await loadOrders();
    } finally {
      setActionBusy(false);
    }
  };

  const nextStepMap: Record<string, 'CONFIRMED' | 'PACKING' | 'SHIPPING' | undefined> = {
    PENDING: 'CONFIRMED',
    CONFIRMED: 'PACKING',
    PACKING: 'SHIPPING',
  };

  return (
    <View style={styles.stack}>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Hàng đợi đơn hàng</Text>
        <View style={styles.rowWrap}>
          {ORDER_FILTERS.map((st) => (
            <Pressable
              key={st}
              onPress={() => setStatusFilter(st)}
              style={[styles.miniChip, statusFilter === st && styles.miniChipActive]}
            >
              <Text style={styles.miniChipText}>{st}</Text>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <StateCard kind="loading" title="Đang tải đơn hàng..." />
        ) : error ? (
          <StateCard
            kind="error"
            title="Lỗi tải danh sách đơn"
            message={error}
            actionLabel="Thử lại"
            onAction={() => void loadOrders()}
          />
        ) : orders.length === 0 ? (
          <StateCard kind="empty" title="Không có đơn hàng ở trạng thái này" />
        ) : (
          <View style={styles.listStack}>
            {orders.map((o) => (
              <Pressable
                key={o.id}
                onPress={() => setSelectedOrder(o)}
                style={[styles.rowCard, selectedOrder?.id === o.id && styles.rowCardActive]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.boldText}>
                    Đơn #{o.id} · {o.address.name}
                  </Text>
                  <Text style={styles.mutedText}>
                    {formatDateTime(o.createdAt)} · {formatVnd(o.total)}
                  </Text>
                </View>
                <StatusBadge label={o.status} tone="accent" />
                <StatusBadge
                  label={o.paymentStatus}
                  tone={o.paymentStatus === 'PAID' ? 'success' : 'warning'}
                />
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {selectedOrder ? (
        <View style={styles.panel}>
          <View style={styles.rowBetween}>
            <Text style={styles.panelTitle}>Xử lý đơn #{selectedOrder.id}</Text>
            <StatusBadge label={getOrderStatusLabel(selectedOrder.status)} tone="accent" />
          </View>
          <Text style={styles.mutedText}>
            Thanh toán: {getPaymentStatusLabel(selectedOrder.paymentStatus)}
          </Text>
          <Text style={styles.boldText}>
            Giao đến: {selectedOrder.address.name} ({selectedOrder.address.phone})
          </Text>
          <Text style={styles.mutedText}>{selectedOrder.address.addressText}</Text>

          {selectedOrder.items.map((item) => (
            <View key={item.id} style={styles.rowBetween}>
              <Text style={styles.mutedText}>
                {item.name} ({item.size}/{item.color}) × {item.quantity}
              </Text>
              <Text style={styles.boldText}>{formatVnd(item.lineTotal)}</Text>
            </View>
          ))}

          {canProcess ? (
            <View style={styles.actionBox}>
              {nextStepMap[selectedOrder.status] ? (
                <EditorialButton
                  label={`Chuyển sang ${nextStepMap[selectedOrder.status]}`}
                  loading={actionBusy}
                  onPress={() =>
                    void handleAdvance(selectedOrder, nextStepMap[selectedOrder.status]!)
                  }
                />
              ) : null}

              {selectedOrder.status === 'SHIPPING' ? (
                <EditorialButton
                  label="Xác nhận đã giao & thu COD mô phỏng (PAID)"
                  loading={actionBusy}
                  onPress={() => void handleConfirmDeliveryCod(selectedOrder)}
                />
              ) : null}

              {['PENDING', 'CONFIRMED', 'PACKING'].includes(selectedOrder.status) ? (
                <View style={styles.cancelBox}>
                  <TextInput
                    value={cancelReason}
                    onChangeText={setCancelReason}
                    placeholder="Nhập lý do hủy đơn trước SHIPPING..."
                    placeholderTextColor={colors.muted}
                    style={styles.inlineInput}
                  />
                  <EditorialButton
                    label="Hủy đơn & hoàn tồn"
                    variant="danger"
                    compact
                    loading={actionBusy}
                    onPress={() => void handleCancelOrder(selectedOrder)}
                  />
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** Admin review moderation panel with audit trail inspection (AC-10 / M1-10). */
export function AdminReviewsPanel(): React.ReactElement {
  const { handleApiError, showToast } = useApp();

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'VISIBLE' | 'HIDDEN'>('ALL');
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Load reviews and corresponding AdminAuditLog entries. */
  const loadReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await fashionApi.listAdminReviews(
        1,
        50,
        statusFilter === 'ALL' ? undefined : statusFilter,
      );
      setReviews(page.items);
      setAuditLogs(fashionApi.listAuditLogs().filter((l) => l.targetType === 'review'));
    } catch (err) {
      setError(handleApiError(err, 'Không thể tải danh sách đánh giá.'));
    } finally {
      setLoading(false);
    }
  }, [handleApiError, statusFilter]);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  /** Toggle a review between VISIBLE and HIDDEN while keeping original text intact. */
  const handleModerate = async (rev: AdminReview) => {
    const nextStatus = rev.status === 'VISIBLE' ? 'HIDDEN' : 'VISIBLE';
    try {
      await fashionApi.moderateReview(rev.id, { status: nextStatus });
      showToast('success', `Đánh giá #${rev.id} → ${nextStatus} (đã ghi audit).`);
      await loadReviews();
    } catch (err) {
      showToast('error', handleApiError(err));
    }
  };

  if (loading) return <StateCard kind="loading" title="Đang tải kiểm duyệt đánh giá..." />;
  if (error) {
    return (
      <StateCard
        kind="error"
        title="Không thể truy cập kiểm duyệt đánh giá"
        message={error}
        actionLabel="Thử lại"
        onAction={() => void loadReviews()}
      />
    );
  }

  return (
    <View style={styles.stack}>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Kiểm duyệt đánh giá ({reviews.length})</Text>
        <View style={styles.rowWrap}>
          {(['ALL', 'VISIBLE', 'HIDDEN'] as const).map((st) => (
            <Pressable
              key={st}
              onPress={() => setStatusFilter(st)}
              style={[styles.miniChip, statusFilter === st && styles.miniChipActive]}
            >
              <Text style={styles.miniChipText}>{st}</Text>
            </Pressable>
          ))}
        </View>

        {reviews.length === 0 ? (
          <StateCard kind="empty" title="Không có đánh giá phù hợp bộ lọc" />
        ) : (
          <View style={styles.listStack}>
            {reviews.map((r) => (
              <View key={r.id} style={styles.rowCard}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.boldText}>
                    Review #{r.id} · SP #{r.productId} · {r.rating}/5 ★
                  </Text>
                  <Text style={styles.bodyText}>{r.content}</Text>
                  <Text style={styles.mutedText}>
                    User #{r.userId} · OrderItem #{r.orderItemId} · {formatDateTime(r.createdAt)}
                  </Text>
                </View>
                <StatusBadge
                  label={r.status}
                  tone={r.status === 'VISIBLE' ? 'success' : 'warning'}
                />
                <EditorialButton
                  label={r.status === 'VISIBLE' ? 'Ẩn' : 'Hiện lại'}
                  variant="secondary"
                  compact
                  onPress={() => void handleModerate(r)}
                />
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Nhật ký Audit kiểm duyệt ({auditLogs.length})</Text>
        {auditLogs.length === 0 ? (
          <StateCard kind="empty" title="Chưa có thao tác kiểm duyệt nào được ghi" />
        ) : (
          auditLogs.map((log) => (
            <View key={log.id} style={styles.rowCard}>
              <Text style={styles.mutedText}>
                Actor #{log.actorUserId} · {log.action} · Review #{log.targetId} ·{' '}
                {JSON.stringify(log.metadata)} · {formatDateTime(log.createdAt)}
              </Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

/** Admin account status & MVP B Staff permission matrix panel (AC-11 / AC-12). */
export function AdminUsersPanel(): React.ReactElement {
  const { handleApiError, showToast } = useApp();

  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Load all accounts and recent account/permission audit logs. */
  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await fashionApi.listAdminUsers(1, 50);
      setUsers(page.items);
      setAuditLogs(fashionApi.listAuditLogs());
    } catch (err) {
      setError(handleApiError(err, 'Không thể tải danh sách tài khoản.'));
    } finally {
      setLoading(false);
    }
  }, [handleApiError]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  /** Toggle ACTIVE/DISABLED status for Customer or Staff accounts. */
  const handleToggleAccount = async (target: User) => {
    const nextStatus = target.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    try {
      await fashionApi.setAccountStatus(target.id, { status: nextStatus });
      showToast('success', `Tài khoản ${target.email} → ${nextStatus}`);
      await loadUsers();
    } catch (err) {
      showToast('error', handleApiError(err));
    }
  };

  /** Toggle a specific MVP B StaffPermission on a Staff account. */
  const handleToggleStaffPerm = async (target: User, perm: StaffPermission) => {
    const current = target.permissions ?? [];
    const next = current.includes(perm) ? current.filter((p) => p !== perm) : [...current, perm];
    try {
      await fashionApi.setStaffPermissions(target.id, next);
      showToast('success', `Đã cập nhật quyền Staff cho ${target.email}.`);
      await loadUsers();
    } catch (err) {
      showToast('error', handleApiError(err));
    }
  };

  if (loading) return <StateCard kind="loading" title="Đang tải danh sách tài khoản..." />;
  if (error) {
    return (
      <StateCard
        kind="error"
        title="Không thể truy cập quản lý tài khoản"
        message={error}
        actionLabel="Thử lại"
        onAction={() => void loadUsers()}
      />
    );
  }

  return (
    <View style={styles.stack}>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Quản lý tài khoản & Phân quyền Staff MVP B</Text>
        <Text style={styles.mutedText}>
          Quy trình tạo Admin nằm ngoài màn hình này (AC-11). Khóa tài khoản sẽ thu hồi phiên ngay
          lập tức.
        </Text>

        <View style={styles.listStack}>
          {users.map((u) => (
            <View key={u.id} style={styles.userCard}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.boldText}>
                    #{u.id} · {u.email}
                  </Text>
                </View>
                <StatusBadge label={u.role} tone={u.role === 'ADMIN' ? 'accent' : 'neutral'} />
                <StatusBadge
                  label={u.status}
                  tone={u.status === 'ACTIVE' ? 'success' : 'danger'}
                />
                {u.role !== 'ADMIN' ? (
                  <EditorialButton
                    label={u.status === 'ACTIVE' ? 'Khóa' : 'Mở khóa'}
                    variant={u.status === 'ACTIVE' ? 'danger' : 'secondary'}
                    compact
                    onPress={() => void handleToggleAccount(u)}
                  />
                ) : null}
              </View>

              {u.role === 'STAFF' ? (
                <View style={styles.permSection}>
                  <Text style={styles.mutedText}>Quyền RBAC v1 (chạm để cấp/thu hồi):</Text>
                  <View style={styles.rowWrap}>
                    {ALL_STAFF_PERMISSIONS.map((perm) => {
                      const granted = Boolean(u.permissions?.includes(perm));
                      return (
                        <Pressable
                          key={perm}
                          onPress={() => void handleToggleStaffPerm(u, perm)}
                          style={[styles.miniChip, granted && styles.miniChipActive]}
                        >
                          <Text style={styles.miniChipText}>
                            {granted ? '✓ ' : ''}
                            {perm}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Admin Audit Logs ({auditLogs.length})</Text>
        {auditLogs.slice(0, 12).map((log) => (
          <View key={log.id} style={styles.rowCard}>
            <Text style={styles.mutedText}>
              [{formatDateTime(log.createdAt)}] Actor #{log.actorUserId} · {log.action} ·{' '}
              {log.targetType}#{log.targetId} · {JSON.stringify(log.metadata)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  panel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.lg,
    gap: spacing.md,
  },
  panelTitle: { fontFamily: typography.serif, fontSize: 19, color: colors.ink },
  subTitle: { fontFamily: typography.sans, fontSize: 14, fontWeight: '700', color: colors.ink },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  listStack: { gap: spacing.sm },
  rowCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xs,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowCardActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  userCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xs,
    padding: spacing.md,
    gap: spacing.sm,
  },
  permSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  boldText: { fontFamily: typography.sans, fontSize: 14, fontWeight: '600', color: colors.ink },
  bodyText: { fontFamily: typography.sans, fontSize: 13, color: colors.ink, lineHeight: 19 },
  mutedText: { fontFamily: typography.sans, fontSize: 12, color: colors.muted },
  errorText: { fontFamily: typography.sans, fontSize: 13, color: colors.danger },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  miniChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.xs,
  },
  miniChipActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  miniChipText: { fontFamily: typography.sans, fontSize: 12, color: colors.ink },
  actionBox: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  cancelBox: { gap: spacing.sm },
  inlineInput: {
    minHeight: 38,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.xs,
    paddingHorizontal: spacing.md,
    fontFamily: typography.sans,
    fontSize: 13,
    color: colors.ink,
  },
});
