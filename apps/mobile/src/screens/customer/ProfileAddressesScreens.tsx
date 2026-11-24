import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fashionApi } from '../../api/client';
import {
  EditorialButton,
  FieldInput,
  StateCard,
  StatusBadge,
} from '../../components/UiPrimitives';
import { useApp } from '../../state/AppContext';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { Address, EntityId } from '../../types/api';

/** Authenticated user profile screen supporting getMe and logout (M1-09). */
export function ProfileScreen(): React.ReactElement {
  const { user, navigate, logout, handleApiError } = useApp();
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return (
      <View style={styles.pagePad}>
        <StateCard
          kind="empty"
          title="Bạn chưa đăng nhập"
          message="Đăng nhập để quản lý hồ sơ, sổ địa chỉ và lịch sử đơn hàng."
          actionLabel="Đi tới đăng nhập"
          onAction={() => navigate({ name: 'auth', mode: 'login' })}
        />
      </View>
    );
  }

  /** Sign out current session via API and return to public catalog. */
  const handleLogout = async () => {
    setLoggingOut(true);
    setError(null);
    try {
      await logout();
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.title}>Hồ sơ tài khoản</Text>
          <StatusBadge label={user.role} tone={user.role === 'CUSTOMER' ? 'success' : 'accent'} />
        </View>
        <View style={styles.infoGrid}>
          <Text style={styles.metaLabel}>ID tài khoản</Text>
          <Text style={styles.metaValue}>#{user.id}</Text>
          <Text style={styles.metaLabel}>Email</Text>
          <Text style={styles.metaValue}>{user.email}</Text>
          <Text style={styles.metaLabel}>Trạng thái</Text>
          <StatusBadge label={user.status} tone={user.status === 'ACTIVE' ? 'success' : 'danger'} />
          {user.role === 'STAFF' && user.permissions ? (
            <>
              <Text style={styles.metaLabel}>Quyền Staff MVP B</Text>
              <Text style={styles.metaValue}>{user.permissions.join(', ') || 'Chưa cấp quyền'}</Text>
            </>
          ) : null}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.actionsCol}>
          {user.role === 'CUSTOMER' ? (
            <>
              <EditorialButton
                label="Sổ địa chỉ giao hàng"
                variant="secondary"
                onPress={() => navigate({ name: 'addresses' })}
              />
              <EditorialButton
                label="Đơn hàng của tôi"
                variant="secondary"
                onPress={() => navigate({ name: 'orders' })}
              />
            </>
          ) : (
            <EditorialButton
              label="Mở khu vực quản trị"
              onPress={() => navigate({ name: 'admin', tab: 'orders' })}
            />
          )}
          <EditorialButton
            label="Đăng xuất"
            variant="danger"
            loading={loggingOut}
            onPress={() => void handleLogout()}
          />
        </View>
      </View>
    </ScrollView>
  );
}

/** Customer address book screen supporting listAddresses, createAddress, and updateAddress. */
export function AddressesScreen(): React.ReactElement {
  const { user, navigate, goBack, handleApiError, showToast } = useApp();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<EntityId | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [addressText, setAddressText] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  /** Load Customer's owned addresses from API. */
  const fetchAddresses = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await fashionApi.listAddresses();
      setAddresses(list);
      if (list.length === 0) {
        setShowForm(true);
      }
    } catch (err) {
      setLoadError(handleApiError(err, 'Không thể tải danh sách địa chỉ.'));
    } finally {
      setLoading(false);
    }
  }, [handleApiError]);

  useEffect(() => {
    if (user?.role === 'CUSTOMER') {
      void fetchAddresses();
    } else {
      setLoading(false);
    }
  }, [fetchAddresses, user]);

  /** Open form pre-filled to edit an existing address or blank to create a new one. */
  const openEditor = (addr?: Address) => {
    setSaveError(null);
    if (addr) {
      setEditingId(addr.id);
      setName(addr.name);
      setPhone(addr.phone);
      setAddressText(addr.addressText);
      setIsDefault(addr.isDefault);
    } else {
      setEditingId(null);
      setName('');
      setPhone('');
      setAddressText('');
      setIsDefault(addresses.length === 0);
    }
    setShowForm(true);
  };

  /** Submit new or updated address while preserving user inputs if save fails. */
  const handleSave = async () => {
    setSaveError(null);
    if (!name.trim() || !phone.trim() || !addressText.trim()) {
      setSaveError('Vui lòng nhập đầy đủ tên người nhận, số điện thoại và địa chỉ.');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await fashionApi.updateAddress(editingId, {
          name: name.trim(),
          phone: phone.trim(),
          addressText: addressText.trim(),
          isDefault,
        });
        showToast('success', 'Đã cập nhật địa chỉ giao hàng.');
      } else {
        await fashionApi.createAddress({
          name: name.trim(),
          phone: phone.trim(),
          addressText: addressText.trim(),
          isDefault,
        });
        showToast('success', 'Đã thêm địa chỉ giao hàng mới.');
      }
      setShowForm(false);
      await fetchAddresses();
    } catch (err) {
      setSaveError(handleApiError(err, 'Không thể lưu địa chỉ.'));
    } finally {
      setSaving(false);
    }
  };

  if (!user || user.role !== 'CUSTOMER') {
    return (
      <View style={styles.pagePad}>
        <StateCard
          kind="error"
          title="Cần tài khoản Customer"
          message="Vui lòng đăng nhập bằng tài khoản Khách hàng để quản lý địa chỉ."
          actionLabel="Đăng nhập"
          onAction={() => navigate({ name: 'auth', mode: 'login' })}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.rowBetween}>
        <EditorialButton label="Quay lại" variant="secondary" compact onPress={goBack} />
        <EditorialButton label="Thêm địa chỉ mới" compact onPress={() => openEditor()} />
      </View>

      <Text style={styles.title}>Địa chỉ giao hàng</Text>

      {loading ? (
        <StateCard kind="loading" title="Đang tải sổ địa chỉ..." />
      ) : loadError ? (
        <StateCard
          kind="error"
          title="Lỗi tải danh sách địa chỉ"
          message={loadError}
          actionLabel="Thử lại"
          onAction={() => void fetchAddresses()}
        />
      ) : addresses.length === 0 && !showForm ? (
        <StateCard
          kind="empty"
          title="Chưa có địa chỉ nào"
          message="Thêm địa chỉ nhận hàng để tiến hành đặt hàng COD."
          actionLabel="Thêm địa chỉ"
          onAction={() => openEditor()}
        />
      ) : (
        <View style={styles.list}>
          {addresses.map((addr) => (
            <View key={addr.id} style={styles.addressCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.addrName}>{addr.name}</Text>
                {addr.isDefault ? <StatusBadge label="Mặc định" tone="accent" /> : null}
              </View>
              <Text style={styles.addrPhone}>{addr.phone}</Text>
              <Text style={styles.addrText}>{addr.addressText}</Text>
              <View style={styles.addrActions}>
                <EditorialButton
                  label="Chỉnh sửa"
                  variant="secondary"
                  compact
                  onPress={() => openEditor(addr)}
                />
                {!addr.isDefault ? (
                  <EditorialButton
                    label="Đặt làm mặc định"
                    variant="ghost"
                    compact
                    onPress={async () => {
                      try {
                        await fashionApi.updateAddress(addr.id, { isDefault: true });
                        await fetchAddresses();
                      } catch (err) {
                        showToast('error', handleApiError(err));
                      }
                    }}
                  />
                ) : null}
              </View>
            </View>
          ))}
        </View>
      )}

      {showForm ? (
        <View style={styles.card}>
          <Text style={styles.formHeading}>
            {editingId ? 'Cập nhật địa chỉ' : 'Thêm địa chỉ nhận hàng'}
          </Text>
          {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
          <FieldInput label="Tên người nhận" value={name} onChangeText={setName} />
          <FieldInput
            label="Số điện thoại"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <FieldInput
            label="Địa chỉ chi tiết"
            value={addressText}
            onChangeText={setAddressText}
            multiline
          />
          <Pressable
            onPress={() => setIsDefault((v) => !v)}
            style={styles.checkboxRow}
          >
            <View style={[styles.checkboxBox, isDefault && styles.checkboxChecked]} />
            <Text style={styles.checkboxLabel}>Đặt làm địa chỉ giao hàng mặc định</Text>
          </Pressable>
          <View style={styles.addrActions}>
            <EditorialButton
              label="Lưu địa chỉ"
              loading={saving}
              onPress={() => void handleSave()}
            />
            {addresses.length > 0 ? (
              <EditorialButton
                label="Hủy"
                variant="secondary"
                disabled={saving}
                onPress={() => setShowForm(false)}
              />
            ) : null}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  pagePad: { padding: spacing.lg, maxWidth: 720, width: '100%', alignSelf: 'center' },
  content: {
    padding: spacing.lg,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
    gap: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.xl,
    gap: spacing.md,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: { fontFamily: typography.serif, fontSize: 24, color: colors.ink },
  formHeading: { fontFamily: typography.serif, fontSize: 18, color: colors.ink },
  infoGrid: { gap: spacing.xs },
  metaLabel: { fontFamily: typography.sans, fontSize: 12, color: colors.muted, marginTop: 6 },
  metaValue: { fontFamily: typography.sans, fontSize: 15, color: colors.ink, fontWeight: '500' },
  actionsCol: { gap: spacing.sm, marginTop: spacing.sm },
  errorText: { fontFamily: typography.sans, fontSize: 13, color: colors.danger },
  list: { gap: spacing.md },
  addressCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  addrName: { fontFamily: typography.sans, fontSize: 15, fontWeight: '700', color: colors.ink },
  addrPhone: { fontFamily: typography.mono, fontSize: 13, color: colors.muted },
  addrText: { fontFamily: typography.sans, fontSize: 14, lineHeight: 20, color: colors.ink },
  addrActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  checkboxBox: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: 2,
    backgroundColor: colors.surface,
  },
  checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkboxLabel: { fontFamily: typography.sans, fontSize: 13, color: colors.ink },
});
