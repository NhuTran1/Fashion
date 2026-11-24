import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { fashionApi } from '../api/client';
import { EditorialButton, StatusBadge } from './UiPrimitives';
import { AdminWorkspaceScreen } from '../screens/admin/AdminWorkspaceScreen';
import { AuthScreen } from '../screens/customer/AuthScreen';
import {
  CartScreen,
  CheckoutScreen,
  OrderSuccessScreen,
} from '../screens/customer/CartCheckoutScreens';
import { CatalogScreen } from '../screens/customer/CatalogScreen';
import { OrderDetailScreen, OrdersListScreen } from '../screens/customer/OrdersScreens';
import { ProductDetailScreen } from '../screens/customer/ProductDetailScreen';
import { AddressesScreen, ProfileScreen } from '../screens/customer/ProfileAddressesScreens';
import { useApp } from '../state/AppContext';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { MockFaultMode } from '../types/api';

const FAULT_OPTIONS: Array<{ mode: MockFaultMode; label: string }> = [
  { mode: 'NONE', label: 'Bình thường' },
  { mode: 'INTERNAL_ERROR', label: 'Lỗi 500 kế tiếp' },
  { mode: 'NETWORK_TIMEOUT', label: 'Mất phản hồi (Timeout)' },
  { mode: 'OUT_OF_STOCK', label: 'Hết tồn (409)' },
  { mode: 'SESSION_EXPIRED', label: 'Hết phiên (401)' },
  { mode: 'CSRF_INVALID', label: 'CSRF lỗi (403)' },
];

/** Top-level responsive application shell rendering navigation chrome, toast, QA drawer, and active route. */
export function AppShell(): React.ReactElement {
  const {
    route,
    user,
    cart,
    toast,
    nextFault,
    navigate,
    clearToast,
    armFault,
    resetDemoData,
  } = useApp();
  const { width } = useWindowDimensions();
  const [showQaBar, setShowQaBar] = useState(false);

  const cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  const isCompact = width < 680;

  return (
    <SafeAreaView style={styles.root}>
      {/* Minimal architectural header bar */}
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <Pressable onPress={() => navigate({ name: 'catalog' })} style={styles.brandBtn}>
            <Text style={styles.brandWordmark}>SỞI ATELIER</Text>
            <StatusBadge
              label={fashionApi.isMockMode() ? 'Mock OpenAPI v1.0.0' : 'Live API'}
              tone="neutral"
            />
          </Pressable>

          <View style={styles.navActions}>
            <NavTab
              label="Catalog"
              active={route.name === 'catalog' || route.name === 'product'}
              onPress={() => navigate({ name: 'catalog' })}
            />
            {!user || user.role === 'CUSTOMER' ? (
              <NavTab
                label={`Giỏ hàng (${cartCount})`}
                active={route.name === 'cart' || route.name === 'checkout'}
                onPress={() => navigate({ name: 'cart' })}
              />
            ) : null}
            {user?.role === 'CUSTOMER' ? (
              <NavTab
                label="Đơn hàng"
                active={route.name === 'orders' || route.name === 'order-detail'}
                onPress={() => navigate({ name: 'orders' })}
              />
            ) : null}
            <NavTab
              label="Quản trị"
              active={route.name === 'admin'}
              onPress={() => navigate({ name: 'admin', tab: 'orders' })}
            />
            <NavTab
              label={user ? (isCompact ? 'Hồ sơ' : user.email.split('@')[0]) : 'Đăng nhập'}
              active={route.name === 'auth' || route.name === 'profile' || route.name === 'addresses'}
              onPress={() =>
                user ? navigate({ name: 'profile' }) : navigate({ name: 'auth', mode: 'login' })
              }
            />
            {fashionApi.isMockMode() ? (
              <Pressable
                onPress={() => setShowQaBar((v) => !v)}
                style={[styles.qaToggle, nextFault !== 'NONE' && styles.qaToggleArmed]}
              >
                <Text style={styles.qaToggleText}>
                  {nextFault !== 'NONE' ? `QA: ${nextFault}` : 'QA Sim'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Collapsible Mock Fault Simulator for verifying M1-09/M1-10 error & retry flows */}
        {showQaBar && fashionApi.isMockMode() ? (
          <View style={styles.qaPanel}>
            <View style={styles.qaPanelInner}>
              <Text style={styles.qaLabel}>
                Giả lập lỗi backend cho request kế tiếp ({Platform.OS}):
              </Text>
              <View style={styles.qaChips}>
                {FAULT_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.mode}
                    onPress={() => armFault(opt.mode)}
                    style={[styles.qaChip, nextFault === opt.mode && styles.qaChipActive]}
                  >
                    <Text
                      style={[
                        styles.qaChipText,
                        nextFault === opt.mode && styles.qaChipTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
                <EditorialButton
                  label="Reset dữ liệu mẫu"
                  variant="secondary"
                  compact
                  onPress={resetDemoData}
                />
              </View>
            </View>
          </View>
        ) : null}
      </View>

      {/* Transient global feedback banner */}
      {toast ? (
        <View
          style={[
            styles.toast,
            toast.tone === 'error' && styles.toastError,
            toast.tone === 'success' && styles.toastSuccess,
          ]}
        >
          <Text style={styles.toastText}>{toast.message}</Text>
          <Pressable onPress={clearToast}>
            <Text style={styles.toastDismiss}>Đóng</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Active route renderer */}
      <View style={styles.body}>
        {route.name === 'catalog' ? <CatalogScreen /> : null}
        {route.name === 'product' ? <ProductDetailScreen productId={route.productId} /> : null}
        {route.name === 'auth' ? <AuthScreen initialMode={route.mode} /> : null}
        {route.name === 'profile' ? <ProfileScreen /> : null}
        {route.name === 'addresses' ? <AddressesScreen /> : null}
        {route.name === 'cart' ? <CartScreen /> : null}
        {route.name === 'checkout' ? <CheckoutScreen /> : null}
        {route.name === 'order-success' ? (
          <OrderSuccessScreen order={route.order} replayed={route.replayed} />
        ) : null}
        {route.name === 'orders' ? <OrdersListScreen /> : null}
        {route.name === 'order-detail' ? <OrderDetailScreen orderId={route.orderId} /> : null}
        {route.name === 'admin' ? <AdminWorkspaceScreen initialTab={route.tab} /> : null}
      </View>
    </SafeAreaView>
  );
}

/** Single navigation tab pill inside the top bar. */
function NavTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable onPress={onPress} style={[styles.navTab, active && styles.navTabActive]}>
      <Text style={[styles.navTabText, active && styles.navTabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerInner: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandWordmark: {
    fontFamily: typography.serif,
    fontSize: 19,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: 1.2,
  },
  navActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
  navTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  navTabActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  navTabText: {
    fontFamily: typography.sans,
    fontSize: 13,
    color: colors.ink,
    fontWeight: '500',
  },
  navTabTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  qaToggle: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.canvas,
  },
  qaToggleArmed: {
    borderColor: colors.warning,
    backgroundColor: colors.warningSoft,
  },
  qaToggleText: {
    fontFamily: typography.mono,
    fontSize: 11,
    color: colors.ink,
  },
  qaPanel: {
    backgroundColor: colors.canvas,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  qaPanelInner: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    gap: spacing.xs,
  },
  qaLabel: {
    fontFamily: typography.sans,
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  qaChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    alignItems: 'center',
  },
  qaChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  qaChipActive: {
    borderColor: colors.warning,
    backgroundColor: colors.warningSoft,
  },
  qaChipText: { fontFamily: typography.sans, fontSize: 12, color: colors.ink },
  qaChipTextActive: { color: colors.warning, fontWeight: '700' },
  toast: {
    backgroundColor: colors.ink,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  toastError: { backgroundColor: colors.danger },
  toastSuccess: { backgroundColor: colors.success },
  toastText: { fontFamily: typography.sans, fontSize: 13, color: '#FFFFFF', flex: 1 },
  toastDismiss: {
    fontFamily: typography.sans,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  body: {
    flex: 1,
  },
});
