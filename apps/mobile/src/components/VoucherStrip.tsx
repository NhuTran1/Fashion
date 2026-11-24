import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../state/AppContext';
import { colors, radius, shadows, spacing, typography } from '../theme/tokens';

/** Demo P1 Voucher definitions displayed in Sudes-inspired ticket strip. */
export interface DemoVoucher {
  code: string;
  stubTop: string;
  stubValue: string;
  title: string;
  description: string;
  conditionNote: string;
  stubColor: string;
}

export const DEMO_VOUCHERS: DemoVoucher[] = [
  {
    code: 'HELLO',
    stubTop: 'Tặng',
    stubValue: '200K',
    title: 'TẶNG BẠN MỚI',
    description: 'Giảm 15% cho đơn hàng đầu tiên từ 699K',
    conditionNote: 'Áp dụng cho khách hàng đăng ký mới (P1 Voucher Preview).',
    stubColor: colors.accent,
  },
  {
    code: 'FREESHIP',
    stubTop: 'Freeship',
    stubValue: '0 ₫',
    title: 'MIỄN PHÍ VẬN CHUYỂN',
    description: 'Miễn phí giao hàng cho hóa đơn từ 250K',
    conditionNote: 'Bản demo MVP A mặc định phí giao hàng COD = 0 ₫.',
    stubColor: colors.accentLight,
  },
  {
    code: 'SOI50K',
    stubTop: 'Giảm',
    stubValue: '50K',
    title: 'GIẢM 50K',
    description: 'Áp dụng khi mua với hóa đơn từ 150K',
    conditionNote: 'Voucher mô phỏng P1-02 (chưa trừ vào tổng server MVP A).',
    stubColor: colors.oliveBanner,
  },
  {
    code: 'SOI50',
    stubTop: 'Quà tặng',
    stubValue: '50%',
    title: 'TẶNG VOUCHER 50%',
    description: 'Khi mua từ 5 sản phẩm trở lên',
    conditionNote: 'Voucher mô phỏng P1-02 cho đơn hàng số lượng lớn.',
    stubColor: '#2E6F5E',
  },
];

/** Horizontal row of Sudes-inspired notched voucher ticket cards with copy-to-clipboard action. */
export function VoucherStrip(): React.ReactElement {
  const { showToast } = useApp();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [activeInfoCode, setActiveInfoCode] = useState<string | null>(null);

  /** Copy voucher code to Web clipboard when available and show instant feedback toast. */
  const handleCopyCode = async (voucher: DemoVoucher) => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(voucher.code);
      } catch {
        // Ignore clipboard permission fallback.
      }
    }
    setCopiedCode(voucher.code);
    showToast('success', `Đã sao chép mã ưu đãi ${voucher.code}.`);
  };

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Ưu đãi & Voucher dành cho bạn</Text>
        <Text style={styles.sectionSub}>Chạm &ldquo;Sao chép&rdquo; để dùng thử ở bước Checkout</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.row}>
          {DEMO_VOUCHERS.map((v) => {
            const isCopied = copiedCode === v.code;
            const showInfo = activeInfoCode === v.code;

            return (
              <View key={v.code} style={[styles.ticketCard, shadows.soft]}>
                {/* Top & bottom circular ticket notches */}
                <View style={styles.notchTop} />
                <View style={styles.notchBottom} />

                {/* Left colored stub */}
                <View style={[styles.stub, { backgroundColor: v.stubColor }]}>
                  <Text style={styles.stubTop}>{v.stubTop}</Text>
                  <Text style={styles.stubValue}>{v.stubValue}</Text>
                </View>

                {/* Vertical dashed divider */}
                <View style={styles.dashedDivider} />

                {/* Right details & copy button */}
                <View style={styles.body}>
                  <View style={styles.titleRow}>
                    <Text style={styles.title} numberOfLines={1}>
                      {v.title}
                    </Text>
                    <Pressable
                      onPress={() => setActiveInfoCode(showInfo ? null : v.code)}
                      style={styles.infoBtn}
                      accessibilityLabel={`Điều kiện mã ${v.code}`}
                    >
                      <Text style={styles.infoIcon}>i</Text>
                    </Pressable>
                  </View>

                  <Text style={styles.desc} numberOfLines={2}>
                    {showInfo ? v.conditionNote : v.description}
                  </Text>

                  <View style={styles.footerRow}>
                    <View>
                      <Text style={styles.codeLabel}>Nhập mã</Text>
                      <Text style={styles.codeValue}>{v.code}</Text>
                    </View>

                    <Pressable
                      onPress={() => void handleCopyCode(v)}
                      style={[styles.copyBtn, isCopied && styles.copyBtnDone]}
                      accessibilityRole="button"
                      accessibilityLabel={`Sao chép mã ${v.code}`}
                    >
                      <Text style={styles.copyBtnText}>{isCopied ? 'Đã chép ✓' : 'Sao chép'}</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  sectionTitle: {
    fontFamily: typography.serif,
    fontSize: 19,
    fontWeight: '700',
    color: colors.ink,
  },
  sectionSub: {
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.muted,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: 4,
  },
  ticketCard: {
    width: 316,
    minHeight: 118,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'stretch',
    padding: spacing.sm,
    position: 'relative',
    overflow: 'hidden',
  },
  notchTop: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 99,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.border,
    top: -8,
    left: 91,
    zIndex: 4,
  },
  notchBottom: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 99,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.border,
    bottom: -8,
    left: 91,
    zIndex: 4,
  },
  stub: {
    width: 82,
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    gap: 2,
  },
  stubTop: {
    fontFamily: typography.sans,
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
  },
  stubValue: {
    fontFamily: typography.sans,
    fontSize: 19,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  dashedDivider: {
    width: 1,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    marginHorizontal: spacing.sm,
    marginVertical: 4,
  },
  body: {
    flex: 1,
    justifyContent: 'space-between',
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 4,
  },
  title: {
    flex: 1,
    fontFamily: typography.sans,
    fontSize: 13,
    fontWeight: '800',
    color: colors.ink,
  },
  infoBtn: {
    width: 20,
    height: 20,
    borderRadius: 99,
    borderWidth: 1.5,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoIcon: {
    fontFamily: typography.sans,
    fontSize: 11,
    fontWeight: '800',
    color: colors.accent,
  },
  desc: {
    fontFamily: typography.sans,
    fontSize: 11,
    lineHeight: 16,
    color: colors.muted,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 2,
  },
  codeLabel: {
    fontFamily: typography.sans,
    fontSize: 10,
    color: colors.accent,
  },
  codeValue: {
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: '800',
    color: colors.accent,
  },
  copyBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.xs,
  },
  copyBtnDone: {
    backgroundColor: colors.accentDark,
  },
  copyBtnText: {
    fontFamily: typography.sans,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
