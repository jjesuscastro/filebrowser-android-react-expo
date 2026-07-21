import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
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
  const { connect, login, savedServerUrl, forgetServer } = useSession();
  const [serverUrl, setServerUrl] = useState(savedServerUrl);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const usingSavedServer = Boolean(savedServerUrl);

  const submit = async () => {
    if (!username.trim() || !password) { setError('Enter your username and password.'); return; }
    if (!usingSavedServer && !serverUrl.trim()) { setError('Enter your server address.'); return; }
    const run = async () => {
      setBusy(true); setError('');
      try {
        if (usingSavedServer) await login(username.trim(), password);
        else await connect(serverUrl, username.trim(), password);
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
        <Text style={sharedStyles.subtitle}>{usingSavedServer ? `Sign in to ${savedServerUrl}` : 'Connect directly to your File Browser server.'}</Text>
        {!usingSavedServer && <><Text style={sharedStyles.label}>Server address</Text><TextInput autoCapitalize="none" autoCorrect={false} inputMode="url" value={serverUrl} onChangeText={setServerUrl} placeholder="https://files.example.com" placeholderTextColor={colors.muted} selectionColor={colors.blue} style={sharedStyles.input} /></>}
        <Text style={sharedStyles.label}>Username</Text>
        <TextInput autoCapitalize="none" autoCorrect={false} value={username} onChangeText={setUsername} placeholderTextColor={colors.muted} selectionColor={colors.blue} style={sharedStyles.input} />
        <Text style={sharedStyles.label}>Password</Text>
        <TextInput secureTextEntry value={password} onChangeText={setPassword} onSubmitEditing={() => void submit()} placeholderTextColor={colors.muted} selectionColor={colors.blue} style={sharedStyles.input} />
        {error ? <Text accessibilityLiveRegion="polite" style={sharedStyles.error}>{error}</Text> : null}
        <Pressable disabled={busy} onPress={() => void submit()} style={[sharedStyles.button, busy && { opacity: .55 }]}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={sharedStyles.buttonText}>Sign in</Text>}</Pressable>
        {usingSavedServer && <Pressable onPress={() => void forgetServer()} style={sharedStyles.secondaryButton}><Text style={sharedStyles.secondaryText}>Use another server</Text></Pressable>}
        <Text style={{ marginTop: 12, color: colors.muted, fontSize: 12, textAlign: 'center' }}>Requires File Browser 2.34.1 or newer</Text>
      </View></ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
