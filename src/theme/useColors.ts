import { useMemo } from 'react';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSettings } from '@/store/settings';
import { resolveColors, type ThemeColors } from '@/theme/palettes';

export function useColors(): ThemeColors {
  const themeId = useSettings((s) => s.themeId) ?? 'dark';
  const accentId = useSettings((s) => s.accentId) ?? 'theme';
  const scheme = useColorScheme();
  return useMemo(
    () => resolveColors(themeId, accentId, scheme === 'light' ? 'light' : 'dark'),
    [themeId, accentId, scheme]
  );
}
