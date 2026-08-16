export type ThemeId = 'system' | 'light' | 'dark' | 'dracula' | 'nightowl' | 'volcano' | 'oceanic';

export type AccentId = 'theme' | 'lime' | 'teal' | 'cyan' | 'pink' | 'purple' | 'orange' | 'blue' | 'yellow';

export type ThemeColors = {
  bg: string;
  bgDeep: string;
  surface: string;
  surfaceHover: string;
  elevate: string;
  elevateHover: string;
  text: string;
  textSub: string;
  textMuted: string;
  accent: string;
  accentPress: string;
  accentDim: string;
  onAccent: string;
  danger: string;
  overlay: string;
  tabBar: string;
  hairline: string;
  /** Translucent wash over blur / liquid glass. */
  glass: string;
  /** BlurView tint. */
  blurTint: 'dark' | 'light';
  /** iOS GlassView tint. */
  glassTint: string;
  isDark: boolean;
};

type Palette = Omit<ThemeColors, 'accent' | 'accentPress' | 'accentDim' | 'onAccent'> & {
  accent: string;
};

/** Neutral dark — black/gray chrome. Green is accent only. */
const brandDark: Palette = {
  bg: '#0E0E10',
  bgDeep: '#050506',
  surface: 'rgba(255,255,255,0.06)',
  surfaceHover: 'rgba(255,255,255,0.10)',
  elevate: 'rgba(255,255,255,0.10)',
  elevateHover: 'rgba(255,255,255,0.16)',
  text: '#FFFFFF',
  textSub: '#C8C8CC',
  textMuted: '#7A7A80',
  accent: '#1ED760',
  danger: '#E91429',
  overlay: 'rgba(6,6,8,0.52)',
  tabBar: 'transparent',
  hairline: 'rgba(255,255,255,0.14)',
  glass: 'rgba(18,18,20,0.62)',
  blurTint: 'dark',
  glassTint: '#141416',
  isDark: true,
};

/** Neutral light — white/gray chrome. Green is accent only. */
const brandLight: Palette = {
  bg: '#F3F4F7',
  bgDeep: '#E7E9EE',
  surface: 'rgba(255,255,255,0.72)',
  surfaceHover: 'rgba(255,255,255,0.88)',
  elevate: 'rgba(255,255,255,0.64)',
  elevateHover: 'rgba(255,255,255,0.84)',
  text: '#121214',
  textSub: '#4B4B52',
  textMuted: '#7A7A82',
  accent: '#169C46',
  danger: '#C62828',
  overlay: 'rgba(20,20,24,0.32)',
  tabBar: 'transparent',
  hairline: 'rgba(255,255,255,0.55)',
  glass: 'rgba(255,255,255,0.62)',
  blurTint: 'light',
  glassTint: '#F4F5F8',
  isDark: false,
};

/** Material Theme — Dracula (https://material-theme.com/). */
const dracula: Palette = {
  bg: '#1E1F2A',
  bgDeep: '#14151C',
  surface: 'rgba(68,71,90,0.42)',
  surfaceHover: 'rgba(68,71,90,0.58)',
  elevate: 'rgba(68,71,90,0.52)',
  elevateHover: 'rgba(86,90,115,0.64)',
  text: '#F8F8F2',
  textSub: '#C5C6D0',
  textMuted: '#6272A4',
  accent: '#BD93F9',
  danger: '#FF5555',
  overlay: 'rgba(12,12,18,0.52)',
  tabBar: 'transparent',
  hairline: 'rgba(248,248,242,0.16)',
  glass: 'rgba(40,42,54,0.68)',
  blurTint: 'dark',
  glassTint: '#282A36',
  isDark: true,
};

/** Material Theme — Night Owl. */
const nightowl: Palette = {
  bg: '#011221',
  bgDeep: '#00070F',
  surface: 'rgba(13,48,74,0.48)',
  surfaceHover: 'rgba(18,52,79,0.62)',
  elevate: 'rgba(29,59,83,0.56)',
  elevateHover: 'rgba(42,77,104,0.68)',
  text: '#D6DEEB',
  textSub: '#A5C4D4',
  textMuted: '#637777',
  accent: '#82AAFF',
  danger: '#EF5350',
  overlay: 'rgba(0,8,18,0.52)',
  tabBar: 'transparent',
  hairline: 'rgba(214,222,235,0.16)',
  glass: 'rgba(1,22,39,0.68)',
  blurTint: 'dark',
  glassTint: '#011627',
  isDark: true,
};

/** Material Theme — Volcano. */
const volcano: Palette = {
  bg: '#22110D',
  bgDeep: '#120705',
  surface: 'rgba(82,38,29,0.46)',
  surfaceHover: 'rgba(102,48,38,0.58)',
  elevate: 'rgba(82,38,29,0.56)',
  elevateHover: 'rgba(102,48,38,0.7)',
  text: '#FFEDE6',
  textSub: '#E8B4A2',
  textMuted: '#A07068',
  accent: '#FF6E40',
  danger: '#FF5252',
  overlay: 'rgba(16,6,4,0.52)',
  tabBar: 'transparent',
  hairline: 'rgba(255,237,230,0.16)',
  glass: 'rgba(43,20,16,0.68)',
  blurTint: 'dark',
  glassTint: '#2B1410',
  isDark: true,
};

/** Material Theme — Oceanic. */
const oceanic: Palette = {
  bg: '#1C262A',
  bgDeep: '#12181B',
  surface: 'rgba(49,69,73,0.46)',
  surfaceHover: 'rgba(62,86,91,0.58)',
  elevate: 'rgba(49,69,73,0.56)',
  elevateHover: 'rgba(62,86,91,0.7)',
  text: '#ECEFF1',
  textSub: '#B0BEC5',
  textMuted: '#78909C',
  accent: '#009688',
  danger: '#F07178',
  overlay: 'rgba(10,14,16,0.52)',
  tabBar: 'transparent',
  hairline: 'rgba(236,239,241,0.16)',
  glass: 'rgba(38,50,56,0.68)',
  blurTint: 'dark',
  glassTint: '#263238',
  isDark: true,
};

export const THEME_META: { id: ThemeId; label: string; hint: string }[] = [
  { id: 'system', label: 'System', hint: 'Match the device' },
  { id: 'light', label: 'Light', hint: 'Frosted white' },
  { id: 'dark', label: 'Dark', hint: 'Smoked glass' },
  { id: 'dracula', label: 'Dracula', hint: 'Purple frost' },
  { id: 'nightowl', label: 'Night Owl', hint: 'Cool blue glass' },
  { id: 'volcano', label: 'Volcano', hint: 'Warm ember glass' },
  { id: 'oceanic', label: 'Oceanic', hint: 'Teal frost' },
];

export const ACCENT_SWATCHES: { id: AccentId; label: string; hex: string }[] = [
  { id: 'theme', label: 'Theme', hex: '' },
  { id: 'lime', label: 'Lime', hex: '#1ED760' },
  { id: 'teal', label: 'Teal', hex: '#009688' },
  { id: 'cyan', label: 'Cyan', hex: '#8BE9FD' },
  { id: 'blue', label: 'Blue', hex: '#82AAFF' },
  { id: 'purple', label: 'Purple', hex: '#BD93F9' },
  { id: 'pink', label: 'Pink', hex: '#FF79C6' },
  { id: 'orange', label: 'Orange', hex: '#FF6E40' },
  { id: 'yellow', label: 'Yellow', hex: '#FFCB6B' },
];

function mix(hex: string, amount: number): string {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  const t = amount > 0 ? 255 : 0;
  const a = Math.abs(amount);
  const ch = (c: number) => Math.round(c + (t - c) * a);
  return `#${[ch(r), ch(g), ch(b)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function onAccentFor(hex: string): string {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.45 ? '#0B1A0F' : '#FFFFFF';
}

export function previewColors(themeId: ThemeId): Palette {
  if (themeId === 'light' || themeId === 'system') return themeId === 'light' ? brandLight : brandDark;
  if (themeId === 'dracula') return dracula;
  if (themeId === 'nightowl') return nightowl;
  if (themeId === 'volcano') return volcano;
  if (themeId === 'oceanic') return oceanic;
  return brandDark;
}

export function resolveColors(
  themeId: ThemeId,
  accentId: AccentId,
  systemScheme: 'light' | 'dark'
): ThemeColors {
  let base: Palette;
  if (themeId === 'system') base = systemScheme === 'light' ? brandLight : brandDark;
  else if (themeId === 'light') base = brandLight;
  else if (themeId === 'dark') base = brandDark;
  else if (themeId === 'dracula') base = dracula;
  else if (themeId === 'nightowl') base = nightowl;
  else if (themeId === 'volcano') base = volcano;
  else if (themeId === 'oceanic') base = oceanic;
  else base = brandDark;

  const swatch = ACCENT_SWATCHES.find((s) => s.id === accentId);
  const accent = accentId !== 'theme' && swatch?.hex ? swatch.hex : base.accent;

  return {
    ...base,
    accent,
    accentPress: mix(accent, -0.12),
    accentDim: mix(accent, -0.28),
    onAccent: onAccentFor(accent),
  };
}
