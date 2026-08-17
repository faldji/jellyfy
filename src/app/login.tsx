import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { radii, spacing } from '@/constants/theme';
import { normalizeServerUrl } from '@/lib/format';
import { useAuth } from '@/store/auth';
import { useSettings } from '@/store/settings';
import { useColors } from '@/theme/useColors';

export default function LoginScreen() {
  const c = useColors();
  const session = useAuth((s) => s.session);
  const connect = useAuth((s) => s.connect);
  const login = useAuth((s) => s.login);
  const router = useRouter();

  const lastServerUrl = useSettings((s) => s.lastServerUrl);
  const lastUsername = useSettings((s) => s.lastUsername);
  const rememberLogin = useSettings((s) => s.rememberLogin);
  const savedSrUrl = useSettings((s) => s.srBaseUrl) ?? '';
  const savedSrEnabled = Boolean(useSettings((s) => s.srEnabled));
  const setSrEnabled = useSettings((s) => s.setSrEnabled);
  const setSrBaseUrl = useSettings((s) => s.setSrBaseUrl);
  const [server, setServer] = useState(lastServerUrl);
  const [username, setUsername] = useState(lastUsername);
  const [password, setPassword] = useState('');
  const [srUrl, setSrUrl] = useState(savedSrUrl);
  const [srOn, setSrOn] = useState(savedSrEnabled);
  const [showSr, setShowSr] = useState(savedSrEnabled || Boolean(savedSrUrl));
  const [serverName, setServerName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (lastServerUrl) setServer((current) => current || lastServerUrl);
    if (lastUsername) setUsername((current) => current || lastUsername);
  }, [lastServerUrl, lastUsername]);

  useEffect(() => {
    if (savedSrUrl) setSrUrl((current) => current || savedSrUrl);
    setSrOn(savedSrEnabled);
    if (savedSrEnabled || savedSrUrl) setShowSr(true);
  }, [savedSrUrl, savedSrEnabled]);

  if (session) return <Redirect href="/(app)/(tabs)" />;

  const persistSr = () => {
    try {
      const smartUrl = normalizeServerUrl(srUrl);
      setSrBaseUrl?.(smartUrl);
      setSrEnabled?.(Boolean(srOn && smartUrl));
    } catch {
      // Jellyfin login must not depend on the optional plugin.
    }
  };

  const loginErrorMessage = (err: unknown, serverUrl: string) => {
    if (err instanceof ApiError || (err && typeof err === 'object' && 'status' in err && typeof (err as ApiError).status === 'number')) {
      const status = (err as ApiError).status;
      if (status === 401) return 'Wrong username or password.';
      return `Could not sign in (${status}) at ${serverUrl}.`;
    }
    if (err instanceof Error && err.message.includes('access token')) {
      return 'This address did not look like a Jellyfin server.';
    }
    const detail = err instanceof Error && err.message ? err.message : 'network error';
    return `Could not reach ${serverUrl}. ${detail}`;
  };

  const onConnect = async () => {
    setError(null);
    const url = normalizeServerUrl(server);
    if (!url) {
      setError('Enter your Jellyfin server address.');
      return;
    }
    setBusy(true);
    try {
      const info = await connect(url);
      setServer(url);
      setServerName(info.serverName);
      rememberLogin(url, username.trim());
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `Could not reach server (${err.status}). Check the URL and that the server allows this device.`
          : 'Could not reach the server. Include http:// or https:// if needed.'
      );
    } finally {
      setBusy(false);
    }
  };

  const onLogin = async () => {
    setError(null);
    const serverUrl = normalizeServerUrl(server);
    if (!serverUrl) {
      setError('Enter your Jellyfin server address.');
      return;
    }
    if (!username.trim() || !password) {
      setError('Enter your username and password.');
      return;
    }
    setBusy(true);
    try {
      await login({ serverUrl, username: username.trim(), password });
      rememberLogin(serverUrl, username.trim());
    } catch (err) {
      setError(loginErrorMessage(err, serverUrl));
      setBusy(false);
      return;
    }
    persistSr();
    setBusy(false);
    router.replace('/(app)/(tabs)');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bgDeep }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Image
              source={require('../../assets/images/logo.png')}
              style={styles.logo}
              accessibilityIgnoresInvertColors
            />
            <Text style={[styles.mark, { color: c.text }]}>Jellyfy</Text>
            <Text style={[styles.tag, { color: c.textSub }]}>Music from your Jellyfin server</Text>
          </View>

          <View style={styles.form}>
            <Text style={[styles.label, { color: c.text }]}>Server</Text>
            <TextInput
              value={server}
              onChangeText={setServer}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="https://jellyfin.example.com"
              placeholderTextColor={c.textMuted}
              style={[styles.input, { backgroundColor: c.elevate, color: c.text }]}
              editable={!busy}
            />

            {serverName ? (
              <Text style={[styles.serverOk, { color: c.accent }]}>Connected to {serverName}</Text>
            ) : (
              <Pressable style={[styles.secondary, { borderColor: c.textMuted }]} onPress={() => void onConnect()} disabled={busy}>
                {busy && !serverName ? <ActivityIndicator color={c.text} /> : <Text style={[styles.secondaryText, { color: c.text }]}>Find server</Text>}
              </Pressable>
            )}

            <Text style={[styles.label, { color: c.text }]}>Username</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Username"
              placeholderTextColor={c.textMuted}
              style={[styles.input, { backgroundColor: c.elevate, color: c.text }]}
              editable={!busy}
            />

            <Text style={[styles.label, { color: c.text }]}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Password"
              placeholderTextColor={c.textMuted}
              style={[styles.input, { backgroundColor: c.elevate, color: c.text }]}
              editable={!busy}
              onSubmitEditing={() => void onLogin()}
            />

            {error ? <Text style={[styles.error, { color: c.danger }]}>{error}</Text> : null}

            <Pressable style={[styles.primary, { backgroundColor: c.accent }]} onPress={() => void onLogin()} disabled={busy}>
              {busy ? (
                <ActivityIndicator color={c.onAccent} />
              ) : (
                <Text style={[styles.primaryText, { color: c.onAccent }]}>Log in</Text>
              )}
            </Pressable>

            <Pressable onPress={() => setShowSr((value) => !value)} style={styles.srDisclosure} disabled={busy}>
              <Text style={[styles.srDisclosureText, { color: c.textSub }]}>
                {showSr ? 'Hide Smart Recommendations' : 'Optional: Smart Recommendations'}
              </Text>
            </Pressable>

            {showSr ? (
              <>
                <TextInput
                  value={srUrl}
                  onChangeText={setSrUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  placeholder="https://sr.example.com"
                  placeholderTextColor={c.textMuted}
                  style={[styles.input, { backgroundColor: c.elevate, color: c.text }]}
                  editable={!busy}
                />
                <Pressable
                  style={styles.srToggle}
                  onPress={() => setSrOn((value) => !value)}
                  disabled={busy}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: srOn }}>
                  <View
                    style={[
                      styles.radio,
                      { borderColor: srOn ? c.accent : c.textMuted, backgroundColor: srOn ? c.accent : 'transparent' },
                    ]}
                  />
                  <Text style={[styles.srToggleText, { color: c.text }]}>Use Smart Recommendations</Text>
                </Pressable>
                <Text style={[styles.srHint, { color: c.textMuted }]}>
                  Separate service from Jellyfin. You can also set this later in Settings. Leave empty to use Jellyfin only.
                </Text>
              </>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.xl, paddingVertical: 24 },
  hero: { alignItems: 'center', marginBottom: 32, gap: 8 },
  logo: { width: 88, height: 88, borderRadius: 22, marginBottom: 8 },
  mark: { fontSize: 48, fontWeight: '900', letterSpacing: -1.5 },
  tag: { fontSize: 16 },
  form: { gap: 10 },
  label: { fontWeight: '700', marginTop: 8 },
  input: {
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
  },
  primary: {
    borderRadius: radii.pill,
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 16,
  },
  primaryText: { fontWeight: '900', fontSize: 16 },
  secondary: {
    borderWidth: 1,
    borderRadius: radii.pill,
    alignItems: 'center',
    paddingVertical: 12,
  },
  secondaryText: { fontWeight: '800' },
  serverOk: { fontWeight: '700' },
  error: { marginTop: 8, lineHeight: 18 },
  srDisclosure: { alignItems: 'center', paddingVertical: 14 },
  srDisclosureText: { fontWeight: '700', fontSize: 13 },
  srToggle: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  srToggleText: { fontWeight: '700', fontSize: 15 },
  srHint: { fontSize: 12, lineHeight: 16 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
});
