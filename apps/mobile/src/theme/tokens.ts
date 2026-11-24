import { Platform, ViewStyle } from 'react-native';

/**
 * Fresh, vibrant e-commerce design tokens for SỞI Fashion inspired by the Bean Farm
 * storefront structure: luminous white surfaces, crisp emerald-green primary actions,
 * warm golden-amber category highlights, and soft mint promotional hero backdrops.
 */
export const colors = {
  canvas: '#F6F8F7',
  surface: '#FFFFFF',
  surfaceSoft: '#F9FBFA',
  surfaceAlt: '#EEF3F0',
  surfaceGlass: Platform.select({
    web: 'rgba(255, 255, 255, 0.94)',
    default: '#FFFFFF',
  }),
  mintHero: '#DDF3E8',
  mintHeroAccent: '#C5EAD7',
  oliveBanner: '#63882B',
  warmHighlight: '#FEF6DF',
  amber: '#F5B82E',
  amberInk: '#1F2937',
  coralRed: '#E53935',
  ink: '#1E242B',
  muted: '#64706A',
  accent: '#0E8A44',
  accentLight: '#16A34A',
  accentDark: '#096B34',
  accentSoft: '#E6F5EC',
  accentInk: '#FFFFFF',
  border: '#E3EAE6',
  borderStrong: '#C9D6CF',
  success: '#0E8A44',
  successSoft: '#E6F5EC',
  warning: '#B4690E',
  warningSoft: '#FEF4DC',
  danger: '#DC2626',
  dangerSoft: '#FEECEC',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 22,
  pill: 999,
} as const;

export const shadows: Record<'soft' | 'card' | 'lifted', ViewStyle> = {
  soft: Platform.select({
    web: {
      boxShadow: '0 2px 10px rgba(14, 42, 26, 0.05)',
    } as ViewStyle,
    default: {
      shadowColor: '#0E2A1A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
  }),
  card: Platform.select({
    web: {
      boxShadow: '0 6px 20px rgba(14, 42, 26, 0.06), 0 1px 3px rgba(14, 42, 26, 0.03)',
    } as ViewStyle,
    default: {
      shadowColor: '#0E2A1A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.07,
      shadowRadius: 12,
      elevation: 3,
    },
  }),
  lifted: Platform.select({
    web: {
      boxShadow: '0 14px 32px rgba(14, 138, 68, 0.14), 0 4px 10px rgba(14, 42, 26, 0.06)',
    } as ViewStyle,
    default: {
      shadowColor: '#0E8A44',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.16,
      shadowRadius: 16,
      elevation: 6,
    },
  }),
};

export const typography = {
  serif: Platform.select({
    web: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
    ios: 'System',
    android: 'sans-serif-medium',
    default: 'sans-serif',
  }),
  sans: Platform.select({
    web: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    ios: 'System',
    android: 'sans-serif',
    default: 'sans-serif',
  }),
  mono: Platform.select({
    web: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    ios: 'Menlo',
    android: 'monospace',
    default: 'monospace',
  }),
} as const;

/** Map named garment color tokens to visual swatch hex values for product cards and selectors. */
export const colorSwatchMap: Record<string, string> = {
  Đen: '#1C1D21',
  Trắng: '#F9F9F7',
  'Xanh Indigo': '#1E3A5F',
  'Xám Đá': '#8A909A',
  Be: '#D9CFC1',
  'Xanh Rêu': '#3C4D3B',
  Nâu: '#6B4C3B',
  'Xanh Nhạt': '#B5C8DC',
};

/** Resolve a swatch hex color from a garment color label with a neutral fallback. */
export function resolveColorSwatch(colorName: string): string {
  return colorSwatchMap[colorName] ?? '#9BA1AB';
}
