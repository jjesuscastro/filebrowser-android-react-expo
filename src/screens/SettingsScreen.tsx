import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useSession } from '../session/SessionContext';
import { AppColors } from '../theme';
import { useAppTheme } from '../theme/ThemeContext';

export function SettingsScreen() {
  const { colors, dark, setDark } = useAppTheme();
  const styles = makeStyles(colors);
  const { connection, user, logout, forgetServer } = useSession();
  return <View style={styles.screen}>
    <View style={styles.card}><Text style={styles.label}>Server</Text><Text selectable style={styles.value}>{connection?.baseUrl}</Text><Text style={styles.label}>Signed in as</Text><Text style={styles.value}>{user?.username}</Text></View>
    <View style={styles.card}><View style={styles.settingRow}><View style={{ flex: 1 }}><Text style={styles.heading}>Dark mode</Text><Text style={styles.settingHint}>Use the darker app appearance</Text></View><Switch accessibilityLabel="Dark mode" value={dark} onValueChange={setDark} trackColor={{ false: colors.border, true: colors.blue }} thumbColor={dark ? '#fff' : colors.muted} /></View></View>
    <View style={styles.card}><Text style={styles.heading}>Server capabilities</Text>{connection && Object.entries(connection.capabilities).map(([name, enabled]) => <View key={name} style={styles.cap}><Text style={styles.capName}>{name}</Text><Text style={{ color: enabled ? colors.success : colors.muted }}>{enabled ? 'Available' : 'Unavailable'}</Text></View>)}</View>
    <Pressable onPress={() => void logout()} style={styles.button}><Text style={styles.buttonText}>Sign out</Text></Pressable>
    <Pressable onPress={() => Alert.alert('Forget this server?', 'The saved address and sign-in token will be removed.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Forget', style: 'destructive', onPress: () => void forgetServer() }])} style={styles.button}><Text style={styles.danger}>Forget server</Text></Pressable>
    <Text style={styles.footer}>Native File Browser client · Requires File Browser 2.34.1+</Text>
  </View>;
}
const makeStyles = (colors: AppColors) => StyleSheet.create({
  screen: { flex: 1, padding: 14, backgroundColor: colors.background }, card: { marginBottom: 12, padding: 17, borderRadius: 14, backgroundColor: colors.surface }, heading: { marginBottom: 10, color: colors.ink, fontSize: 16, fontWeight: '700' }, settingRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center' }, settingHint: { color: colors.muted, fontSize: 13 }, label: { marginTop: 5, color: colors.muted, fontSize: 12 }, value: { marginTop: 3, marginBottom: 13, color: colors.ink, fontSize: 15 }, cap: { minHeight: 38, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, capName: { color: colors.ink, textTransform: 'capitalize' }, button: { minHeight: 50, justifyContent: 'center', paddingHorizontal: 18, borderBottomWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, buttonText: { color: colors.blue, fontSize: 16, fontWeight: '600' }, danger: { color: colors.danger, fontSize: 16, fontWeight: '600' }, footer: { marginTop: 18, color: colors.muted, fontSize: 12, textAlign: 'center' },
});
