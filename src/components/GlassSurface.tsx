import { BlurTargetView, BlurView, type BlurTint } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { createContext, useContext, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useColors } from '@/theme/useColors';

const GlassTargetContext = createContext<RefObject<View | null> | null>(null);

function liquidGlassOn(): boolean {
  if (Platform.OS !== 'ios') return false;
  try {
    return isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
  } catch {
    return false;
  }
}

export function GlassProvider({ children }: { children: ReactNode }) {
  const targetRef = useRef<View | null>(null);

  return (
    <GlassTargetContext.Provider value={targetRef}>
      <BlurTargetView ref={targetRef} style={styles.fill}>
        {children}
      </BlurTargetView>
    </GlassTargetContext.Provider>
  );
}

type Props = {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  intensity?: number;
};

export function GlassSurface({ style, children, intensity }: Props) {
  const c = useColors();
  const target = useContext(GlassTargetContext);
  const tint = c.blurTint as BlurTint;
  const strength = intensity ?? (c.isDark ? 52 : 68);
  const liquid = useMemo(() => liquidGlassOn(), []);

  if (liquid) {
    return (
      <GlassView
        style={[styles.clip, style]}
        glassEffectStyle="regular"
        colorScheme={c.isDark ? 'dark' : 'light'}
        tintColor={c.glassTint}>
        {children}
      </GlassView>
    );
  }

  return (
    <BlurView
      style={[styles.clip, style]}
      intensity={strength}
      tint={tint}
      blurTarget={Platform.OS === 'android' ? (target ?? undefined) : undefined}
      blurMethod="none">
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: c.glass }]} />
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  clip: { overflow: 'hidden' },
});
