import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radius, spacing, typography } from '../theme/tokens';

/** Primary/secondary/danger/ghost architectural button with built-in loading lock. */
export function EditorialButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  compact = false,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  compact?: boolean;
}): React.ReactElement {
  const isDisabled = disabled || loading;

  const containerStyle = [
    styles.btnBase,
    compact && styles.btnCompact,
    variant === 'primary' && styles.btnPrimary,
    variant === 'secondary' && styles.btnSecondary,
    variant === 'danger' && styles.btnDanger,
    variant === 'ghost' && styles.btnGhost,
    isDisabled && styles.btnDisabled,
    style,
  ];

  const textStyle = [
    styles.btnText,
    compact && styles.btnTextCompact,
    variant === 'primary' && { color: colors.accentInk },
    variant === 'secondary' && { color: colors.ink },
    variant === 'danger' && { color: '#FFFFFF' },
    variant === 'ghost' && { color: colors.accent },
  ];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [containerStyle, pressed && !isDisabled && { opacity: 0.85 }]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'danger' ? '#FFFFFF' : colors.accent}
        />
      ) : (
        <Text style={textStyle}>{label}</Text>
      )}
    </Pressable>
  );
}

/** Hairline status pill with semantic tone for order, payment, and catalog statuses. */
export function StatusBadge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
}): React.ReactElement {
  const palette: Record<typeof tone, { bg: string; fg: string; border: string }> = {
    neutral: { bg: colors.surfaceAlt, fg: colors.muted, border: colors.border },
    accent: { bg: colors.accentSoft, fg: colors.accent, border: '#C9D8EA' },
    success: { bg: colors.successSoft, fg: colors.success, border: '#BCE0CE' },
    warning: { bg: colors.warningSoft, fg: colors.warning, border: '#E8CFA7' },
    danger: { bg: colors.dangerSoft, fg: colors.danger, border: '#EABEC4' },
  };
  const p = palette[tone];
  return (
    <View style={[styles.badge, { backgroundColor: p.bg, borderColor: p.border }]}>
      <Text style={[styles.badgeText, { color: p.fg }]}>{label}</Text>
    </View>
  );
}

/**
 * Product visual frame supporting both local garment:// artwork tokens (for 100% offline
 * cross-platform Android/Web rendering) and remote http(s) URLs with loading/error states.
 */
export function GarmentArtwork({
  uri,
  altText,
  height = 220,
}: {
  uri?: string;
  altText: string;
  height?: number;
}): React.ReactElement {
  const [imgFailed, setImgFailed] = useState(false);

  if (uri && uri.startsWith('garment://')) {
    const [, rawTone = '%231E3A5F', rawSil = 'shirt', rawTitle = 'SỞI'] = uri.split('://')[1]
      ? ['', ...uri.split('://')[1].split('/')]
      : [];
    const toneHex = decodeURIComponent(rawTone);
    const silhouette = decodeURIComponent(rawSil);
    const title = decodeURIComponent(rawTitle);
    const isDark =
      toneHex.toLowerCase() === '#1c1d21' ||
      toneHex.toLowerCase() === '#1e3a5f' ||
      toneHex.toLowerCase() === '#2b313b' ||
      toneHex.toLowerCase() === '#3c4d3b' ||
      toneHex.toLowerCase() === '#24456e' ||
      toneHex.toLowerCase() === '#6b4c3b';
    const fg = isDark ? 'rgba(255,255,255,0.88)' : 'rgba(24,26,31,0.86)';
    const line = isDark ? 'rgba(255,255,255,0.28)' : 'rgba(24,26,31,0.2)';

    return (
      <View
        style={[styles.artContainer, { height, backgroundColor: toneHex }]}
        accessibilityLabel={altText}
      >
        <View style={[styles.artInnerFrame, { borderColor: line }]}>
          <GarmentSilhouette kind={silhouette} stroke={line} />
          <Text style={[styles.artCaption, { color: fg }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
      </View>
    );
  }

  if (!uri || imgFailed) {
    return (
      <View style={[styles.artContainer, styles.artFallback, { height }]} accessibilityLabel={altText}>
        <Text style={styles.artFallbackText}>{altText || 'Ảnh sản phẩm'}</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      accessibilityLabel={altText}
      onError={() => setImgFailed(true)}
      style={[styles.artImage, { height }]}
      resizeMode="cover"
    />
  );
}

/** Minimal geometric garment silhouette drawn with pure RN Views (no external SVG dependency). */
function GarmentSilhouette({ kind, stroke }: { kind: string; stroke: string }): React.ReactElement {
  if (kind === 'trouser') {
    return (
      <View style={styles.silWrap}>
        <View style={[styles.silWaist, { borderColor: stroke }]} />
        <View style={styles.silLegs}>
          <View style={[styles.silLeg, { borderColor: stroke }]} />
          <View style={[styles.silLeg, { borderColor: stroke }]} />
        </View>
      </View>
    );
  }
  if (kind === 'coat') {
    return (
      <View style={styles.silWrap}>
        <View style={[styles.silCollar, { borderColor: stroke }]} />
        <View style={[styles.silCoatBody, { borderColor: stroke }]} />
      </View>
    );
  }
  return (
    <View style={styles.silWrap}>
      <View style={[styles.silCollar, { borderColor: stroke }]} />
      <View style={[styles.silShirtBody, { borderColor: stroke }]} />
    </View>
  );
}

/** Unified Loading, Empty, or Error + Retry state container required by M1-09 & M1-10. */
export function StateCard({
  kind,
  title,
  message,
  actionLabel,
  onAction,
}: {
  kind: 'loading' | 'empty' | 'error';
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}): React.ReactElement {
  return (
    <View style={[styles.stateCard, kind === 'error' && styles.stateCardError]}>
      {kind === 'loading' && <ActivityIndicator size="small" color={colors.accent} />}
      <Text style={[styles.stateTitle, kind === 'error' && { color: colors.danger }]}>{title}</Text>
      {message ? <Text style={styles.stateMessage}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <EditorialButton
          label={actionLabel}
          onPress={onAction}
          variant={kind === 'error' ? 'primary' : 'secondary'}
          compact
          style={{ marginTop: spacing.md }}
        />
      ) : null}
    </View>
  );
}

/** Labeled input field with optional inline validation hint. */
export function FieldInput({
  label,
  error,
  style,
  ...rest
}: TextInputProps & { label: string; error?: string }): React.ReactElement {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        {...rest}
        style={[styles.input, error ? styles.inputError : undefined, style]}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  btnBase: {
    minHeight: 42,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  btnCompact: {
    minHeight: 34,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  btnPrimary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  btnSecondary: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
  },
  btnDanger: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  btnGhost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  btnDisabled: {
    opacity: 0.48,
  },
  btnText: {
    fontFamily: typography.sans,
    fontSize: 14,
    fontWeight: '600',
  },
  btnTextCompact: {
    fontSize: 13,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.xs,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontFamily: typography.sans,
    fontSize: 12,
    fontWeight: '600',
  },
  artContainer: {
    width: '100%',
    borderRadius: radius.xs,
    padding: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  artInnerFrame: {
    width: '100%',
    height: '100%',
    borderWidth: 1,
    borderRadius: radius.xs,
    padding: spacing.md,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  artCaption: {
    fontFamily: typography.serif,
    fontSize: 13,
    letterSpacing: 0.3,
  },
  artFallback: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  artFallbackText: {
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
  },
  artImage: {
    width: '100%',
    borderRadius: radius.xs,
    backgroundColor: colors.surfaceAlt,
  },
  silWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  silCollar: {
    width: 24,
    height: 10,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  silShirtBody: {
    width: 56,
    height: 64,
    borderWidth: 1.5,
    borderRadius: 2,
  },
  silCoatBody: {
    width: 62,
    height: 74,
    borderWidth: 1.5,
    borderRadius: 2,
  },
  silWaist: {
    width: 48,
    height: 12,
    borderWidth: 1.5,
  },
  silLegs: {
    flexDirection: 'row',
    gap: 4,
  },
  silLeg: {
    width: 22,
    height: 62,
    borderWidth: 1.5,
    borderTopWidth: 0,
  },
  stateCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  stateCardError: {
    borderColor: '#EABEC4',
    backgroundColor: colors.dangerSoft,
  },
  stateTitle: {
    fontFamily: typography.sans,
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
    textAlign: 'center',
  },
  stateMessage: {
    fontFamily: typography.sans,
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    maxWidth: 420,
    lineHeight: 19,
  },
  fieldGroup: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontFamily: typography.sans,
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
  },
  input: {
    minHeight: 42,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: typography.sans,
    fontSize: 14,
    color: colors.ink,
  },
  inputError: {
    borderColor: colors.danger,
  },
  fieldError: {
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.danger,
  },
});
