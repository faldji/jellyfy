import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { useColors } from '@/theme/useColors';

export default function NotFound() {
  const c = useColors();
  return (
    <>
      <Stack.Screen options={{ title: 'Missing', headerShown: false }} />
      <View style={[styles.wrap, { backgroundColor: c.bg }]}>
        <Text style={[styles.title, { color: c.text }]}>Page not found</Text>
        <Link href="/" style={styles.link}>
          <Text style={[styles.linkText, { color: c.accent }]}>Back to Home</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  title: { fontSize: 20, fontWeight: '800' },
  linkText: { fontWeight: '700' },
  link: { padding: 8 },
});
