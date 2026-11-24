import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { EditorialButton, FieldInput, StatusBadge } from '../../components/UiPrimitives';
import { DEMO_ACCOUNTS } from '../../mock/seedData';
import { useApp } from '../../state/AppContext';
import { colors, radius, spacing, typography } from '../../theme/tokens';

/** Login & Public Customer Registration screen adhering to ADR-0003 & M1-09. */
export function AuthScreen({ initialMode = 'login' }: { initialMode?: 'login' | 'register' }): React.ReactElement {
  const { login, register, handleApiError, showToast } = useApp();

  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  /** Validate form fields and dispatch login or public Customer registration. */
  const handleSubmit = async () => {
    setFormError(null);
    const nextFieldErrors: { email?: string; password?: string } = {};
    if (!email.trim().includes('@')) {
      nextFieldErrors.email = 'Vui lòng nhập email hợp lệ.';
    }
    if (password.length < 6) {
      nextFieldErrors.password = 'Mật khẩu tối thiểu 6 ký tự.';
    }
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login({ email: email.trim(), password });
      } else {
        await register({ email: email.trim(), password });
        showToast('success', 'Đăng ký Customer thành công. Vui lòng đăng nhập.');
        setMode('login');
      }
    } catch (err) {
      setFormError(handleApiError(err, 'Thao tác xác thực thất bại.'));
    } finally {
      setSubmitting(false);
    }
  };

  /** Populate form and immediately sign in with a synthetic demo account. */
  const handleQuickDemoLogin = async (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setFormError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      await login({ email: demoEmail, password: demoPassword });
    } catch (err) {
      setFormError(handleApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.tabRow}>
          <Pressable
            onPress={() => {
              setMode('login');
              setFormError(null);
            }}
            style={[styles.tabBtn, mode === 'login' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>
              Đăng nhập
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setMode('register');
              setFormError(null);
            }}
            style={[styles.tabBtn, mode === 'register' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, mode === 'register' && styles.tabTextActive]}>
              Đăng ký Customer
            </Text>
          </Pressable>
        </View>

        <Text style={styles.title}>
          {mode === 'login' ? 'Truy cập tài khoản SỞI Atelier' : 'Tạo tài khoản mua sắm'}
        </Text>
        <Text style={styles.subtitle}>
          {mode === 'login'
            ? Platform.OS === 'web'
              ? 'Phiên Web dùng cookie bảo mật kèm CSRF token (ADR-0003).'
              : 'Phiên Android dùng opaque bearer token lưu trong SecureStore (ADR-0003).'
            : 'Đăng ký công khai chỉ tạo vai trò Customer. Tài khoản Admin/Staff được cấp nội bộ.'}
        </Text>

        {formError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{formError}</Text>
          </View>
        ) : null}

        <FieldInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="customer@example.test"
          error={fieldErrors.email}
        />
        <FieldInput
          label="Mật khẩu"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
          error={fieldErrors.password}
        />

        <EditorialButton
          label={mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
          onPress={() => void handleSubmit()}
          loading={submitting}
        />
      </View>

      {/* Synthetic Demo Accounts for rapid QA across Customer / Admin / Staff */}
      <View style={styles.demoCard}>
        <Text style={styles.demoTitle}>Tài khoản mẫu kiểm thử (Synthetic Demo Data)</Text>
        <Text style={styles.demoHint}>
          Chọn nhanh một vai trò để kiểm thử luồng Customer, Admin MVP A hoặc Staff MVP B:
        </Text>
        <View style={styles.demoList}>
          {DEMO_ACCOUNTS.map((acc) => (
            <View key={acc.email} style={styles.demoItem}>
              <View style={styles.demoInfo}>
                <View style={styles.demoTop}>
                  <Text style={styles.demoLabel}>{acc.label}</Text>
                  <StatusBadge
                    label={acc.role}
                    tone={acc.role === 'ADMIN' ? 'accent' : acc.role === 'STAFF' ? 'warning' : 'success'}
                  />
                </View>
                <Text style={styles.demoCreds}>
                  {acc.email} / {acc.password}
                </Text>
                <Text style={styles.demoNote}>{acc.note}</Text>
              </View>
              <EditorialButton
                label="Vào nhanh"
                variant="secondary"
                compact
                disabled={submitting}
                onPress={() => void handleQuickDemoLogin(acc.email, acc.password)}
              />
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: {
    padding: spacing.lg,
    maxWidth: 620,
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
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.xs,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: colors.accent },
  tabText: { fontFamily: typography.sans, fontSize: 14, color: colors.muted, fontWeight: '500' },
  tabTextActive: { color: colors.accent, fontWeight: '700' },
  title: { fontFamily: typography.serif, fontSize: 22, color: colors.ink },
  subtitle: { fontFamily: typography.sans, fontSize: 13, lineHeight: 19, color: colors.muted },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: '#EABEC4',
    padding: spacing.md,
    borderRadius: radius.xs,
  },
  errorText: { fontFamily: typography.sans, fontSize: 13, color: colors.danger },
  demoCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  demoTitle: { fontFamily: typography.sans, fontSize: 15, fontWeight: '700', color: colors.ink },
  demoHint: { fontFamily: typography.sans, fontSize: 13, color: colors.muted },
  demoList: { gap: spacing.sm, marginTop: spacing.xs },
  demoItem: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xs,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  demoInfo: { flex: 1, gap: 3 },
  demoTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  demoLabel: { fontFamily: typography.sans, fontSize: 14, fontWeight: '600', color: colors.ink },
  demoCreds: { fontFamily: typography.mono, fontSize: 12, color: colors.accent },
  demoNote: { fontFamily: typography.sans, fontSize: 12, color: colors.muted },
});
