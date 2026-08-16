import { Redirect } from 'expo-router';

import { useAuth } from '@/store/auth';

export default function Index() {
  const session = useAuth((s) => s.session);
  if (!session) return <Redirect href="/login" />;
  return <Redirect href="/(app)/(tabs)" />;
}
