import { Platform } from 'react-native';

/**
 * Design tokens for SỞI ATELIER — contemporary single-vendor fashion storefront & ops studio.
 * Deliberately avoids warm cream/terracotta or generic bubbly SaaS cards:
 * uses cool gallery limestone, architectural hairlines, and deep Prussian denim-indigo.
 */
export const colors = {
  canvas: '#F7F7F5',
  surface: '#FFFFFF',
  surfaceAlt: '#EFEFF2',
  ink: '#181A1F',
  muted: '#636873',
  accent: '#1E3A5F',
  accentSoft: '#E8EEF5',
  accentInk: '#FFFFFF',
  border: '#E2E4E9',
  borderStrong: '#C6CBD4',
  success: '#1B6B4A',
  successSoft: '#E7F3ED',
  warning: '#9A5B13',
  warningSoft: '#FAF1E4',
  danger: '#A62639',
  dangerSoft: '#FBEAEC',
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
  none: 0,
  xs: 2,
  sm: 4,
  md: 6,
  pill: 999,
} as const;

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
