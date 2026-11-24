import { Platform, ViewStyle } from 'react-native';

/**
 * Refined modern fashion boutique design tokens for SỞI ATELIER.
 * Features soft multi-tier border radii, layered elevation shadows, luminous silk-pearl
 * canvas, and tailored Prussian indigo accents across both Android and Web.
 */
export const colors = {
  canvas: '#F5F4F8',
  surface: '#FFFFFF',
  surfaceSoft: '#FAF9FC',
  surfaceAlt: '#EFEFF4',
  surfaceGlass: Platform.select({
    web: 'rgba(255, 255, 255, 0.86)',
    default: '#FFFFFF',
  }),
  warmHighlight: '#EFE9E1',
  ink: '#17161B',
  muted: '#6C6A76',
  accent: '#1E3A5F',
  accentLight: '#35598A',
  accentSoft: '#EBF0F8',
  accentInk: '#FFFFFF',
  border: '#E8E6EE',
  borderStrong: '#D0CDD9',
  success: '#176E4B',
  successSoft: '#E6F5EE',
  warning: '#A45D12',
  warningSoft: '#FDF2E3',
  danger: '#B4233A',
  dangerSoft: '#FCECEF',
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
  sm: 14,
  md: 18,
  lg: 24,
  pill: 999,
} as const;

export const shadows: Record<'soft' | 'card' | 'lifted', ViewStyle> = {
  soft: Platform.select({
    web: {
      boxShadow: '0 2px 10px rgba(23, 22, 27, 0.04)',
    } as ViewStyle,
    default: {
      shadowColor: '#17161B',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
  }),
  card: Platform.select({
    web: {
      boxShadow: '0 8px 24px rgba(23, 22, 27, 0.06), 0 1px 3px rgba(23, 22, 27, 0.03)',
    } as ViewStyle,
    default: {
      shadowColor: '#17161B',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 3,
    },
  }),
  lifted: Platform.select({
    web: {
      boxShadow: '0 16px 36px rgba(30, 58, 95, 0.12), 0 4px 10px rgba(23, 22, 27, 0.05)',
    } as ViewStyle,
    default: {
      shadowColor: '#1E3A5F',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.14,
      shadowRadius: 18,
      elevation: 6,
    },
  }),
};

export const typography = {
  serif: Platform.select({
    web: "'Georgia', 'Times New Roman', serif",
    ios: 'Georgia',
    android: 'serif',
    default: 'serif',
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
