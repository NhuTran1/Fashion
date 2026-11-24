import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { fashionApi } from '../api/client';
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
import { colors, radius, shadows, spacing, typography } from '../theme/tokens';
import { MockFaultMode } from '../types/api';
import { FadeSlideIn } from './Motion';
import { EditorialButton, StatusBadge } from './UiPrimitives';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

const FAULT_OPTIONS: Array<{ mode: MockFaultMode; label: string }> = [
  { mode: 'NONE', label: 'Bình thường' },
  { mode: 'INTERNAL_ERROR', label: 'Lỗi 500 kế tiếp' },
  { mode: 'NETWORK_TIMEOUT', label: 'Mất phản hồi (Timeout)' },
  { mode: 'OUT_OF_STOCK', label: 'Hết tồn (409)' },
  { mode: 'SESSION_EXPIRED', label: 'Hết phiên (401)' },
  { mode: 'CSRF_INVALID', label: 'CSRF lỗi (403)' },
];

/** Top-level responsive application shell with frosted glass header, animated cart badge, and route transitions. */
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

  // Pop animation whenever cart item count changes.
  const cartScale = useRef(new Animated.Value(1)).current;
  const prevCartCount = useRef(cartCount);
  useEffect(() => {
    if (prevCartCount.current !== cartCount) {
      prevCartCount.current = cartCount;
      Animated.sequence([
        Animated.spring(cartScale, {
          toValue: 1.14,
          friction: 5,
          tension: 240,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.spring(cartScale, {
          toValue: 1,
          friction: 6,
          tension: 200,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start();
    }
  }, [cartCount, cartScale]);

  const routeKey =
    route.name === 'product'
      ? `product-${route.productId}`
      : route.name === 'order-detail'
        ? `order-${route.orderId}`
        : route.name;

  return (
    <SafeAreaView style={styles.root}>
      {/* Frosted glass sticky header bar */}
      <View style={[styles.header, shadows.soft]}>
        <View style={styles.headerInner}>
          <Pressable onPress={() => navigate({ name: 'catalog' })} style={styles.brandBtn}>
            <View style={styles.brandDot} />
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
              <Animated.View style={{ transform: [{ scale: cartScale }] }}>
                <NavTab
                  label={`Giỏ hàng (${cartCount})`}
                  active={route.name === 'cart' || route.name === 'checkout'}
                  onPress={() => navigate({ name: 'cart' })}
                />
              </Animated.View>
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
          <FadeSlideIn distance={8} duration={220} style={styles.qaPanel}>
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
          </FadeSlideIn>
        ) : null}
      </View>

      {/* Floating pill toast notification with smooth slide-in */}
      {toast ? (
        <FadeSlideIn key={toast.id} distance={10} duration={240} style={styles.toastWrap}>
          <View
            style={[
              styles.toast,
              shadows.lifted,
              toast.tone === 'error' && styles.toastError,
              toast.tone === 'success' && styles.toastSuccess,
            ]}
          >
            <Text style={styles.toastText}>{toast.message}</Text>
            <Pressable onPress={clearToast} style={styles.toastDismissBtn}>
              <Text style={styles.toastDismiss}>Đóng</Text>
            </Pressable>
          </View>
        </FadeSlideIn>
      ) : null}

      {/* Active route renderer with smooth fade-slide entrance */}
      <FadeSlideIn key={routeKey} distance={10} duration={260} style={styles.body}>
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
      </FadeSlideIn>
    </SafeAreaView>
  );
}

/** Pill-shaped navigation tab with subtle hover feedback. */
function NavTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}): React.ReactElement {
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[
        styles.navTab,
        hovered && !active && styles.navTabHover,
        active && styles.navTabActive,
      ]}
    >
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
    backgroundColor: colors.surfaceGlass,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    zIndex: 20,
    ...(Platform.OS === 'web'
      ? ({ backdropFilter: 'blur(16px)', position: 'sticky', top: 0 } as unknown as ViewStyle)
      : {}),
  },
  headerInner: {
    width: '100%',
    paddingHorizontal: spacing.xl,
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
  brandDot: {
    width: 10,
    height: 10,
    borderRadius: 99,
    backgroundColor: colors.accent,
  },
  brandWordmark: {
    fontFamily: typography.serif,
    fontSize: 19,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: 1.1,
  },
  navActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
  navTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  navTabHover: {
    backgroundColor: colors.surfaceAlt,
  },
  navTabActive: {
    borderColor: '#C9D8EC',
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
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
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
    backgroundColor: colors.surfaceSoft,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  qaPanelInner: {
    width: '100%',
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
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
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
  toastWrap: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    width: '100%',
  },
  toast: {
    backgroundColor: colors.ink,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  toastError: { backgroundColor: colors.danger },
  toastSuccess: { backgroundColor: colors.success },
  toastText: { fontFamily: typography.sans, fontSize: 13, color: '#FFFFFF', flex: 1 },
  toastDismissBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
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
