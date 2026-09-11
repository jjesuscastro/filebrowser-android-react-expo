import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ApiError } from '../types';
import { useSession } from '../session/SessionContext';
import { useAppTheme } from '../theme/ThemeContext';

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.category === 'unauthorized' || error.category === 'forbidden') return 'Incorrect username or password.';
    return error.message;
  }
  return error instanceof Error ? error.message : 'Connection failed.';
}

export function AuthScreen() {
  const { colors, sharedStyles } = useAppTheme();
  const { connect, login, savedServerUrl, savedSourceName, forgetServer } = useSession();
  const [serverUrl, setServerUrl] = useState(savedServerUrl);
  const [sourceName, setSourceName] = useState(savedSourceName || 'srv');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const usingSavedServer = Boolean(savedServerUrl);

  const submit = async () => {
    if (!username.trim() || !password) { setError('Enter your username and password.'); return; }
    if (!usingSavedServer && !serverUrl.trim()) { setError('Enter your server address.'); return; }
    if (!usingSavedServer && !sourceName.trim()) { setError('Enter your Quantum source name.'); return; }
    const run = async () => {
      setBusy(true); setError('');
      try {
        if (usingSavedServer) await login(username.trim(), password, keepSignedIn);
        else await connect(serverUrl, sourceName.trim(), username.trim(), password, keepSignedIn);
      } catch (e) { setError(errorMessage(e)); }
      finally { setBusy(false); }
    };
    if (!usingSavedServer && serverUrl.trim().toLowerCase().startsWith('http://')) {
      Alert.alert('Unencrypted connection', 'HTTP exposes your password and files. Continue only on a trusted local network.', [
        { text: 'Cancel', style: 'cancel' }, { text: 'Use HTTP', style: 'destructive', onPress: () => void run() },
      ]);
    } else await run();
  };

  return <SafeAreaView style={sharedStyles.screen}>
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
      <View style={sharedStyles.card}>
        <Text style={sharedStyles.title}>File Browser</Text>
        <Text style={sharedStyles.subtitle}>{usingSavedServer ? `Sign in to ${savedServerUrl} · ${savedSourceName}` : 'Connect directly to your FileBrowser Quantum server.'}</Text>
        {!usingSavedServer && <><Text style={sharedStyles.label}>Server address</Text><TextInput autoCapitalize="none" autoCorrect={false} inputMode="url" value={serverUrl} onChangeText={setServerUrl} placeholder="https://files.example.com" placeholderTextColor={colors.muted} selectionColor={colors.blue} style={sharedStyles.input} /></>}
        {!usingSavedServer && <><Text style={sharedStyles.label}>Source name</Text><TextInput autoCapitalize="none" autoCorrect={false} value={sourceName} onChangeText={setSourceName} placeholder="srv" placeholderTextColor={colors.muted} selectionColor={colors.blue} style={sharedStyles.input} /></>}
        <Text style={sharedStyles.label}>Username</Text>
        <TextInput autoCapitalize="none" autoCorrect={false} value={username} onChangeText={setUsername} placeholderTextColor={colors.muted} selectionColor={colors.blue} style={sharedStyles.input} />
        <Text style={sharedStyles.label}>Password</Text>
        <TextInput secureTextEntry value={password} onChangeText={setPassword} onSubmitEditing={() => void submit()} placeholderTextColor={colors.muted} selectionColor={colors.blue} style={sharedStyles.input} />
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: keepSignedIn }}
          onPress={() => setKeepSignedIn(value => !value)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, marginBottom: 2 }}
        >
          <Ionicons name={keepSignedIn ? 'checkbox' : 'square-outline'} size={22} color={keepSignedIn ? colors.blue : colors.muted} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.ink, fontSize: 15 }}>Keep me signed in</Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>Securely reauthenticate if the server session expires.</Text>
          </View>
        </Pressable>
        {error ? <Text accessibilityLiveRegion="polite" style={sharedStyles.error}>{error}</Text> : null}
        <Pressable disabled={busy} onPress={() => void submit()} style={[sharedStyles.button, busy && { opacity: .55 }]}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={sharedStyles.buttonText}>Sign in</Text>}</Pressable>
        {usingSavedServer && <Pressable onPress={() => void forgetServer()} style={sharedStyles.secondaryButton}><Text style={sharedStyles.secondaryText}>Use another server</Text></Pressable>}
        <Text style={{ marginTop: 12, color: colors.muted, fontSize: 12, textAlign: 'center' }}>Requires FileBrowser Quantum API access</Text>
      </View></ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
