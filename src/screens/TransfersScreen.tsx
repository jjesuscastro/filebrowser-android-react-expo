import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTransfers } from '../transfers/TransferContext';
import { AppColors } from '../theme';
import { useAppTheme } from '../theme/ThemeContext';

export function TransfersScreen() {
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);
  const { transfers, clearFinished } = useTransfers();
  return <View style={styles.screen}>
    <View style={styles.toolbar}><Text style={styles.summary}>{transfers.length} transfer{transfers.length === 1 ? '' : 's'}</Text><Pressable onPress={clearFinished}><Text style={styles.clear}>Clear finished</Text></Pressable></View>
    <FlatList data={transfers} keyExtractor={item => item.id} contentContainerStyle={transfers.length ? styles.list : styles.empty}
      ListEmptyComponent={<Text style={styles.emptyText}>No transfers yet.</Text>}
      renderItem={({ item }) => {
        const progress = item.totalBytes ? Math.min(1, item.bytesTransferred / item.totalBytes) : 0;
        return <View style={styles.card}><View style={styles.row}><Text style={styles.icon}>{item.direction === 'upload' ? '↑' : '↓'}</Text><View style={{ flex: 1 }}><Text numberOfLines={1} style={styles.name}>{item.name}</Text><Text style={[styles.status, item.state === 'failed' && { color: colors.danger }]}>{item.state}{item.error ? ` · ${item.error}` : ''}</Text></View></View>
          <View style={styles.track}><View style={[styles.bar, { width: item.state === 'completed' ? '100%' : `${progress * 100}%` }]} /></View>
        </View>;
      }} />
  </View>;
}
const makeStyles = (colors: AppColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, toolbar: { flexDirection: 'row', justifyContent: 'space-between', padding: 16 }, summary: { color: colors.muted }, clear: { color: colors.blue, fontWeight: '600' }, list: { paddingHorizontal: 12 }, empty: { flex: 1, alignItems: 'center', justifyContent: 'center' }, emptyText: { color: colors.muted },
  card: { marginBottom: 9, padding: 14, borderRadius: 12, backgroundColor: colors.surface }, row: { flexDirection: 'row', alignItems: 'center' }, icon: { width: 34, color: colors.blue, fontSize: 25 }, name: { color: colors.ink, fontWeight: '600' }, status: { marginTop: 3, color: colors.muted, fontSize: 12 }, track: { height: 4, marginTop: 12, overflow: 'hidden', borderRadius: 2, backgroundColor: colors.border }, bar: { height: 4, backgroundColor: colors.blue },
});
