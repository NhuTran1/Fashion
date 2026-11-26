import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { FadeSlideIn } from '../../components/Motion';
import { EditorialButton, StateCard, StatusBadge } from '../../components/UiPrimitives';
import { useApp } from '../../state/AppContext';
import { colors, radius, shadows, spacing, typography } from '../../theme/tokens';
import { AdminCatalogPanel } from './AdminCatalogPanel';
import {
  AdminInventoryPanel,
  AdminOrdersPanel,
  AdminReviewsPanel,
  AdminUsersPanel,
} from './AdminOperationsPanels';

type AdminTab = 'orders' | 'catalog' | 'inventory' | 'reviews' | 'users';

/**
 * Web-first Admin & Staff Operations Workspace with soft rounded panels,
 * animated tab transitions, and M1-10 authorization-aware routing.
 */
export function AdminWorkspaceScreen({
  initialTab = 'orders',
}: {
  initialTab?: AdminTab;
}): React.ReactElement {
  const { user, sessionLoading, navigate, hasStaffPermission } = useApp();
  const { width } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);

  if (sessionLoading) {
    return (
      <View style={styles.guardWrap}>
        <StateCard kind="loading" title="Đang xác minh phiên và quyền quản trị..." />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.guardWrap}>
        <StateCard
          kind="error"
          title="401 — Yêu cầu đăng nhập quản trị"
          message="Truy cập khu vực Admin/Staff cần xác thực phiên trước khi tải dữ liệu."
          actionLabel="Đi tới đăng nhập"
          onAction={() => navigate({ name: 'auth', mode: 'login' })}
        />
      </View>
    );
  }

  if (user.role === 'CUSTOMER') {
    return (
      <View style={styles.guardWrap}>
        <StateCard
          kind="error"
          title="403 FORBIDDEN — Không có quyền truy cập"
          message="Tài khoản Khách hàng không được phép mở khu vực quản trị. Dữ liệu nội bộ được bảo vệ ở máy chủ."
          actionLabel="Quay về cửa hàng Customer"
          onAction={() => navigate({ name: 'catalog' })}
        />
      </View>
    );
  }

  const tabs: Array<{ id: AdminTab; label: string; allowed: boolean }> = [
    {
      id: 'orders',
      label: 'Đơn hàng & COD',
      allowed: user.role === 'ADMIN' || hasStaffPermission('orders.read'),
    },
    {
      id: 'catalog',
      label: 'Catalog & Ảnh',
      allowed: user.role === 'ADMIN' || hasStaffPermission('catalog.content.edit'),
    },
    {
      id: 'inventory',
      label: 'Tồn kho SKU',
      allowed: user.role === 'ADMIN' || hasStaffPermission('inventory.adjust'),
    },
    { id: 'reviews', label: 'Kiểm duyệt Đánh giá', allowed: user.role === 'ADMIN' },
    { id: 'users', label: 'Tài khoản & RBAC', allowed: user.role === 'ADMIN' },
  ];

  const isWide = width >= 900;

  return (
    <View style={[styles.shell, isWide && styles.shellWide]}>
      {/* Soft elevated left rail on wide screens / sleek horizontal rail on compact mobile */}
      <View style={[styles.rail, shadows.card, isWide && styles.railWide]}>
        <View style={[styles.railHeader, !isWide && styles.railHeaderCompact]}>
          <View style={styles.railTitleGroup}>
            <Text style={[styles.railTitle, !isWide && styles.railTitleCompact]}>
              Quản trị cửa hàng
            </Text>
            <StatusBadge
              label={user.role === 'ADMIN' ? 'ADMIN · MVP A' : 'STAFF · MVP B'}
              tone={user.role === 'ADMIN' ? 'accent' : 'warning'}
            />
          </View>
          {!isWide ? (
            <EditorialButton
              label="Cửa hàng"
              variant="secondary"
              compact
              onPress={() => navigate({ name: 'catalog' })}
            />
          ) : null}
        </View>
        {isWide ? (
          <View style={styles.tabCol}>
            {tabs.map((t) => {
              const active = activeTab === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setActiveTab(t.id)}
                  style={[
                    styles.navItem,
                    active && styles.navItemActive,
                    !t.allowed && { opacity: 0.65 },
                  ]}
                >
                  <Text style={[styles.navText, active && styles.navTextActive]}>
                    {t.label}
                    {!t.allowed ? ' (403)' : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.tabRow}>
              {tabs.map((t) => {
                const active = activeTab === t.id;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => setActiveTab(t.id)}
                    style={[
                      styles.navItem,
                      active && styles.navItemActive,
                      !t.allowed && { opacity: 0.65 },
                    ]}
                  >
                    <Text style={[styles.navText, active && styles.navTextActive]}>
                      {t.label}
                      {!t.allowed ? ' (403)' : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        )}
        {isWide ? (
          <EditorialButton
            label="Xem góc nhìn Customer"
            variant="secondary"
            compact
            onPress={() => navigate({ name: 'catalog' })}
          />
        ) : null}
      </View>

      <ScrollView style={styles.main} contentContainerStyle={styles.mainContent}>
        <FadeSlideIn key={activeTab} distance={10} duration={240}>
          {activeTab === 'orders' ? <AdminOrdersPanel /> : null}
          {activeTab === 'catalog' ? <AdminCatalogPanel /> : null}
          {activeTab === 'inventory' ? <AdminInventoryPanel /> : null}
          {activeTab === 'reviews' ? <AdminReviewsPanel /> : null}
          {activeTab === 'users' ? <AdminUsersPanel /> : null}
        </FadeSlideIn>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  guardWrap: {
    flex: 1,
    padding: spacing.lg,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
    justifyContent: 'center',
  },
  shell: {
    flex: 1,
    backgroundColor: colors.canvas,
    width: '100%',
  },
  shellWide: {
    flexDirection: 'row',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  rail: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  railWide: {
    width: 250,
    borderWidth: 1,
    borderRadius: radius.lg,
    alignSelf: 'flex-start',
    padding: spacing.lg,
  },
  railHeader: { gap: spacing.xs },
  railHeaderCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  railTitleGroup: {
    gap: 4,
    flexShrink: 1,
    alignItems: 'flex-start',
  },
  railTitle: { fontFamily: typography.serif, fontSize: 19, color: colors.ink },
  railTitleCompact: { fontSize: 17 },
  tabCol: { gap: spacing.xs },
  tabRow: { flexDirection: 'row', gap: spacing.xs },
  navItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  navItemActive: {
    borderColor: '#BEE4CE',
    backgroundColor: colors.accentSoft,
  },
  navText: { fontFamily: typography.sans, fontSize: 13, color: colors.ink },
  navTextActive: { color: colors.accent, fontWeight: '700' },
  main: { flex: 1 },
  mainContent: { padding: spacing.md, paddingBottom: spacing.xxxl },
});
