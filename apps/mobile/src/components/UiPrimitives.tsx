import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radius, shadows, spacing, typography } from '../theme/tokens';
import { ShimmerBlock } from './Motion';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

/** Tactile pill/rounded button with spring press bounce, hover lift, and built-in loading lock. */
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
  const scale = useRef(new Animated.Value(1)).current;
  const [hovered, setHovered] = useState(false);

  /** Compress slightly with spring physics on press. */
  const handlePressIn = () => {
    if (isDisabled) return;
    Animated.spring(scale, {
      toValue: 0.96,
      friction: 7,
      tension: 200,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  };

  /** Spring back cleanly on release. */
  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 6,
      tension: 180,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  };

  const containerStyle = [
    styles.btnBase,
    compact && styles.btnCompact,
    variant === 'primary' && styles.btnPrimary,
    variant === 'secondary' && styles.btnSecondary,
    variant === 'danger' && styles.btnDanger,
    variant === 'ghost' && styles.btnGhost,
    variant === 'primary' && !isDisabled && shadows.soft,
    hovered && !isDisabled && styles.btnHovered,
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
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={containerStyle}
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
    </Animated.View>
  );
}

/** Smooth pill status badge with semantic background tint and soft perimeter. */
export function StatusBadge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
}): React.ReactElement {
  const palette: Record<typeof tone, { bg: string; fg: string; border: string }> = {
    neutral: { bg: colors.surfaceAlt, fg: colors.muted, border: colors.border },
    accent: { bg: colors.accentSoft, fg: colors.accent, border: '#CFDAEC' },
    success: { bg: colors.successSoft, fg: colors.success, border: '#C2E4D3' },
    warning: { bg: colors.warningSoft, fg: colors.warning, border: '#EED6B2' },
    danger: { bg: colors.dangerSoft, fg: colors.danger, border: '#F0C5CD' },
  };
  const p = palette[tone];
  return (
    <View style={[styles.badge, { backgroundColor: p.bg, borderColor: p.border }]}>
      <Text style={[styles.badgeText, { color: p.fg }]}>{label}</Text>
    </View>
  );
}

/**
 * Soft-curved garment lookbook visual frame with layered ambient depth, atelier garment
 * illustration for local garment:// tokens, and fade-in loading for remote URLs.
 */
export function GarmentArtwork({
  uri,
  altText,
  height = 220,
  hideCaption = false,
}: {
  uri?: string;
  altText: string;
  height?: number;
  hideCaption?: boolean;
}): React.ReactElement {
  const [imgFailed, setImgFailed] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

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
    const fg = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(23,22,27,0.88)';
    const line = isDark ? 'rgba(255,255,255,0.28)' : 'rgba(23,22,27,0.18)';
    const orbTint = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.55)';

    return (
      <View
        style={[styles.artContainer, { height, backgroundColor: toneHex }]}
        accessibilityLabel={altText}
      >
        {/* Layered ambient textile sheen circles */}
        <View style={[styles.artGlowTop, { backgroundColor: orbTint }]} />
        <View style={[styles.artGlowBottom, { backgroundColor: orbTint }]} />

        <View style={[styles.artInnerFrame, { borderColor: line }]}>
          <GarmentSilhouette kind={silhouette} stroke={line} />
          {!hideCaption ? (
            <View style={styles.artCaptionPill}>
              <Text style={[styles.artCaption, { color: fg }]} numberOfLines={1}>
                {title}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  if (!uri || imgFailed) {
    return (
      <View
        style={[styles.artContainer, styles.artFallback, { height }]}
        accessibilityLabel={altText}
      >
        <Text style={styles.artFallbackText}>{altText || 'Ảnh sản phẩm'}</Text>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.artImageWrap, { height, opacity: fadeAnim }]}>
      <Image
        source={{ uri }}
        accessibilityLabel={altText}
        onLoad={() =>
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 280,
            useNativeDriver: USE_NATIVE_DRIVER,
          }).start()
        }
        onError={() => setImgFailed(true)}
        style={[styles.artImage, { height }]}
        resizeMode="cover"
      />
    </Animated.View>
  );
}

/** Detailed soft-lined garment silhouette with hanger/lapel cues. */
function GarmentSilhouette({ kind, stroke }: { kind: string; stroke: string }): React.ReactElement {
  if (kind === 'trouser') {
    return (
      <View style={styles.silWrap}>
        <View style={[styles.silHangerHook, { borderColor: stroke }]} />
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
        <View style={[styles.silHangerHook, { borderColor: stroke }]} />
        <View style={[styles.silCollar, { borderColor: stroke }]} />
        <View style={[styles.silCoatBody, { borderColor: stroke }]}>
          <View style={[styles.silSeamCenter, { backgroundColor: stroke }]} />
        </View>
      </View>
    );
  }
  return (
    <View style={styles.silWrap}>
      <View style={[styles.silHangerHook, { borderColor: stroke }]} />
      <View style={[styles.silCollar, { borderColor: stroke }]} />
      <View style={[styles.silShirtBody, { borderColor: stroke }]}>
        <View style={[styles.silPocket, { borderColor: stroke }]} />
      </View>
    </View>
  );
}

/** Unified Loading (with pulsing shimmer bars), Empty, or Error + Retry state container. */
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
    <View style={[styles.stateCard, shadows.soft, kind === 'error' && styles.stateCardError]}>
      {kind === 'loading' ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={colors.accent} />
          <ShimmerBlock height={12} width="60%" borderRadius={radius.pill} />
          <ShimmerBlock height={10} width="40%" borderRadius={radius.pill} />
        </View>
      ) : null}
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

/** Soft-curved labeled input field with focus border highlight and validation text. */
export function FieldInput({
  label,
  error,
  style,
  onFocus,
  onBlur,
  ...rest
}: TextInputProps & { label: string; error?: string }): React.ReactElement {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...rest}
        style={[
          styles.input,
          focused && styles.inputFocused,
          error ? styles.inputError : undefined,
          style,
        ]}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  btnBase: {
    minHeight: 44,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  btnCompact: {
    minHeight: 36,
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
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
  btnHovered: {
    opacity: 0.92,
  },
  btnDisabled: {
    opacity: 0.45,
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
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
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
    borderRadius: radius.md,
    padding: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  artGlowTop: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 999,
    top: -60,
    right: -40,
  },
  artGlowBottom: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 999,
    bottom: -55,
    left: -35,
  },
  artInnerFrame: {
    width: '100%',
    height: '100%',
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.md,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  artCaptionPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.1)',
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
  artImageWrap: {
    width: '100%',
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  artImage: {
    width: '100%',
  },
  silWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  silHangerHook: {
    width: 10,
    height: 8,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    marginBottom: 1,
  },
  silCollar: {
    width: 28,
    height: 10,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  silShirtBody: {
    width: 60,
    height: 64,
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 10,
    alignItems: 'flex-end',
  },
  silPocket: {
    width: 14,
    height: 15,
    borderWidth: 1,
    borderRadius: 3,
    marginTop: 6,
  },
  silCoatBody: {
    width: 66,
    height: 74,
    borderWidth: 1.5,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  silSeamCenter: {
    width: 1,
    height: '78%',
  },
  silWaist: {
    width: 50,
    height: 12,
    borderWidth: 1.5,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  silLegs: {
    flexDirection: 'row',
    gap: 5,
  },
  silLeg: {
    width: 22,
    height: 62,
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
  },
  stateCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  loadingWrap: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  stateCardError: {
    borderColor: '#F0C5CD',
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
    lineHeight: 20,
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
    minHeight: 46,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    fontFamily: typography.sans,
    fontSize: 14,
    color: colors.ink,
  },
  inputFocused: {
    borderColor: colors.accent,
    backgroundColor: colors.surface,
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
