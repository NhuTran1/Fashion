import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
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
import { EditorialButton } from './UiPrimitives';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

const FAULT_OPTIONS: Array<{ mode: MockFaultMode; label: string }> = [
  { mode: 'NONE', label: 'Bình thường' },
  { mode: 'INTERNAL_ERROR', label: 'Lỗi 500 kế tiếp' },
  { mode: 'NETWORK_TIMEOUT', label: 'Mất phản hồi (Timeout)' },
  { mode: 'OUT_OF_STOCK', label: 'Hết tồn (409)' },
  { mode: 'SESSION_EXPIRED', label: 'Hết phiên (401)' },
  { mode: 'CSRF_INVALID', label: 'CSRF lỗi (403)' },
];

/**
 * Top-level responsive application shell modeled after Bean Farm's two-tier e-commerce
 * header: brand logo + rounded search + utility pills on tier 1, and category amber button,
 * emerald active navigation pills, and quick-order CTA on tier 2.
 */
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
  const [headerQuery, setHeaderQuery] = useState('');
  const [catalogSearchTrigger, setCatalogSearchTrigger] = useState<{
    q: string;
    nonce: number;
  } | null>(null);

  const cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  const isWide = width >= 920;

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

  /** Submit header search bar into CatalogScreen and navigate to storefront. */
  const handleHeaderSearch = () => {
    setCatalogSearchTrigger({ q: headerQuery.trim(), nonce: Date.now() });
    navigate({ name: 'catalog' });
  };

  const routeKey =
    route.name === 'product'
      ? `product-${route.productId}`
      : route.name === 'order-detail'
        ? `order-${route.orderId}`
        : route.name;

  return (
    <SafeAreaView style={styles.root}>
      {/* Two-Tier Bean Farm Inspired E-Commerce Header */}
      <View style={[styles.header, shadows.soft]}>
        {/* Tier 1: Brand mark + Search input + Utility action pills */}
        <View style={styles.tierOne}>
          <Pressable
            onPress={() => {
              setHeaderQuery('');
              setCatalogSearchTrigger({ q: '', nonce: Date.now() });
              navigate({ name: 'catalog' });
            }}
            style={styles.brandBtn}
          >
            <View style={styles.brandLogoMark}>
              <View style={styles.brandLogoLeaf} />
            </View>
            <View>
              <Text style={styles.brandWordmark}>
                <Text style={{ color: colors.accent }}>SỞI </Text>
                <Text style={{ color: colors.amber }}>Fashion</Text>
              </Text>
              <Text style={styles.brandTagline}>Chất lượng - Tự nhiên</Text>
            </View>
          </Pressable>

          {isWide ? (
            <View style={styles.headerSearchBox}>
              <TextInput
                value={headerQuery}
                onChangeText={setHeaderQuery}
                onSubmitEditing={handleHeaderSearch}
                placeholder="Tìm kiếm áo sơ mi, quần denim, blazer..."
                placeholderTextColor={colors.muted}
                style={styles.headerSearchInput}
                returnKeyType="search"
              />
              <Pressable onPress={handleHeaderSearch} style={styles.headerSearchBtn}>
                <Text style={styles.headerSearchIcon}>Tìm</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.utilityRow}>
            {user?.role === 'CUSTOMER' ? (
              <UtilityPill
                label="Đơn hàng"
                active={route.name === 'orders' || route.name === 'order-detail'}
                onPress={() => navigate({ name: 'orders' })}
              />
            ) : null}

            <UtilityPill
              label={user ? user.email.split('@')[0] : 'Tài khoản'}
              active={
                route.name === 'auth' || route.name === 'profile' || route.name === 'addresses'
              }
              onPress={() =>
                user ? navigate({ name: 'profile' }) : navigate({ name: 'auth', mode: 'login' })
              }
            />

            {!user || user.role === 'CUSTOMER' ? (
              <Animated.View style={{ transform: [{ scale: cartScale }] }}>
                <Pressable
                  onPress={() => navigate({ name: 'cart' })}
                  style={[
                    styles.cartUtilityPill,
                    (route.name === 'cart' || route.name === 'checkout') &&
                      styles.utilityPillActive,
                  ]}
                >
                  <Text style={styles.utilityText}>Giỏ hàng</Text>
                  <View style={styles.cartCountBadge}>
                    <Text style={styles.cartCountText}>{cartCount}</Text>
                  </View>
                </Pressable>
              </Animated.View>
            ) : null}

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

        {/* Tier 2: Amber Category Pill + Navigation Pills + Coral Quick-Buy CTA */}
        <View style={styles.tierTwo}>
          <Pressable
            onPress={() => navigate({ name: 'catalog' })}
            style={styles.amberCategoryBtn}
            accessibilityRole="button"
          >
            <Text style={styles.amberCategoryText}>☰ Danh mục sản phẩm</Text>
          </Pressable>

          <View style={styles.navActions}>
            <NavTab
              label="Trang chủ"
              active={route.name === 'catalog'}
              onPress={() => navigate({ name: 'catalog' })}
            />
            <NavTab
              label="Sản phẩm"
              active={route.name === 'product'}
              onPress={() => navigate({ name: 'catalog' })}
            />
            {user?.role === 'CUSTOMER' ? (
              <NavTab
                label="Địa chỉ"
                active={route.name === 'addresses'}
                onPress={() => navigate({ name: 'addresses' })}
              />
            ) : null}
            <NavTab
              label="Quản trị"
              active={route.name === 'admin'}
              onPress={() => navigate({ name: 'admin', tab: 'orders' })}
            />
            {!user ? (
              <NavTab
                label="Đăng nhập"
                active={route.name === 'auth'}
                onPress={() => navigate({ name: 'auth', mode: 'login' })}
              />
            ) : null}
          </View>

          <Pressable
            onPress={() =>
              user?.role === 'CUSTOMER'
                ? navigate({ name: cartCount > 0 ? 'checkout' : 'catalog' })
                : navigate({ name: 'auth', mode: 'login' })
            }
            style={styles.quickOrderBtn}
            accessibilityRole="button"
          >
            <Text style={styles.quickOrderText}>Mua hàng nhanh</Text>
          </Pressable>
        </View>

        {/* Collapsible Mock Fault Simulator */}
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

      {/* Floating pill toast notification */}
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

      {/* Active route renderer */}
      <FadeSlideIn key={routeKey} distance={10} duration={260} style={styles.body}>
        {route.name === 'catalog' ? (
          <CatalogScreen externalSearch={catalogSearchTrigger} />
        ) : null}
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

/** Outlined utility pill button in header tier 1. */
function UtilityPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable onPress={onPress} style={[styles.utilityPill, active && styles.utilityPillActive]}>
      <Text style={[styles.utilityText, active && { color: colors.accent }]}>{label}</Text>
    </Pressable>
  );
}

/** Pill-shaped navigation tab in header tier 2 using solid emerald fill when active. */
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
  tierOne: {
    width: '100%',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  brandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandLogoMark: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  brandLogoLeaf: {
    width: 14,
    height: 14,
    borderTopLeftRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: colors.accent,
  },
  brandWordmark: {
    fontFamily: typography.serif,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  brandTagline: {
    fontFamily: typography.sans,
    fontSize: 11,
    color: colors.ink,
    fontWeight: '600',
  },
  headerSearchBox: {
    flex: 1,
    maxWidth: 480,
    minWidth: 240,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingLeft: spacing.lg,
    paddingRight: 4,
    height: 40,
  },
  headerSearchInput: {
    flex: 1,
    fontFamily: typography.sans,
    fontSize: 13,
    color: colors.ink,
  },
  headerSearchBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
  headerSearchIcon: {
    fontFamily: typography.sans,
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  utilityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
  utilityPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  utilityPillActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  utilityText: {
    fontFamily: typography.sans,
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
  },
  cartUtilityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  cartCountBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 99,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  cartCountText: {
    fontFamily: typography.sans,
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tierTwo: {
    width: '100%',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  amberCategoryBtn: {
    backgroundColor: colors.amber,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  amberCategoryText: {
    fontFamily: typography.sans,
    fontSize: 13,
    fontWeight: '700',
    color: colors.amberInk,
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
  },
  navTabHover: {
    backgroundColor: colors.surfaceAlt,
  },
  navTabActive: {
    backgroundColor: colors.accent,
  },
  navTabText: {
    fontFamily: typography.sans,
    fontSize: 13,
    color: colors.ink,
    fontWeight: '600',
  },
  navTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  quickOrderBtn: {
    backgroundColor: colors.coralRed,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  quickOrderText: {
    fontFamily: typography.sans,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  qaToggle: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSoft,
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
    paddingHorizontal: spacing.xl,
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
