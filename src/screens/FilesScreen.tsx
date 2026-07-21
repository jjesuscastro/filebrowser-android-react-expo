import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, FlatList, Modal, Pressable, RefreshControl, Share as NativeShare, StyleSheet, Text, TextInput, View } from 'react-native';
import { PromptModal } from '../components/PromptModal';
import { FileIcon, fileVisual } from '../components/FileIcon';
import { RootStackParams } from '../navigation';
import { useSession } from '../session/SessionContext';
import { AppColors } from '../theme';
import { useAppTheme } from '../theme/ThemeContext';
import { ApiError, FileResource } from '../types';
import { useTransfers } from '../transfers/TransferContext';
import { joinPath, normalizePath, parentPath } from '../utils/path';

type Props = NativeStackScreenProps<RootStackParams, 'Files'>;
type SortKey = 'name' | 'size' | 'modified';

function bytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 ** 2) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 ** 3) return `${(size / 1024 ** 2).toFixed(1)} MB`;
  return `${(size / 1024 ** 3).toFixed(1)} GB`;
}

function message(error: unknown) {
  if (error instanceof ApiError) {
    const labels: Partial<Record<typeof error.category, string>> = {
      offline: 'You appear to be offline.', timeout: 'The server took too long to respond.', forbidden: 'Your account does not have permission for this action.',
      'not-found': 'The file no longer exists.', conflict: 'A file with that name already exists.', certificate: 'The server certificate is not trusted.',
    };
    return labels[error.category] ?? error.message;
  }
  return error instanceof Error ? error.message : 'The operation failed.';
}

export function FilesScreen({ navigation }: Props) {
  const { colors, dark } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { client, connection, user } = useSession();
  const transfers = useTransfers();
  const [path, setPath] = useState('/');
  const [resource, setResource] = useState<FileResource | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<FileResource | null>(null);
  const [grid, setGrid] = useState(false);
  const [sort, setSort] = useState<SortKey>('name');
  const [searchVisible, setSearchVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FileResource[] | null>(null);
  const [prompt, setPrompt] = useState<'folder' | 'rename' | 'move' | 'copy' | null>(null);
  const [promptValue, setPromptValue] = useState('');
  const [createMenu, setCreateMenu] = useState(false);
  const crumbs = normalizePath(path).split('/').filter(Boolean);
  const currentFolderName = crumbs.at(-1) ?? 'My files';

  const load = useCallback(async (refresh = false) => {
    if (!client) return;
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try { setResource(await client.list(path)); }
    catch (e) { setError(message(e)); }
    finally { setLoading(false); setRefreshing(false); }
  }, [client, path]);

  useEffect(() => { setSelected(null); setSearchResults(null); setQuery(''); void load(); }, [load]);

  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selected) { setSelected(null); return true; }
      if (createMenu) { setCreateMenu(false); return true; }
      if (prompt) { setPrompt(null); return true; }
      if (searchVisible) { setSearchVisible(false); setSearchResults(null); setQuery(''); return true; }
      if (normalizePath(path) !== '/') { setPath(parentPath(path)); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [createMenu, path, prompt, searchVisible, selected]));

  useEffect(() => {
    navigation.setOptions({
      title: currentFolderName,
      headerRight: () => <View style={styles.headerActions}>
        <Pressable accessibilityLabel="Search" onPress={() => setSearchVisible(value => !value)} style={styles.headerButton}><Ionicons name="search" color="#fff" size={21} /></Pressable>
        <Pressable accessibilityLabel="Transfers" onPress={() => navigation.navigate('Transfers')} style={styles.headerButton}><Ionicons name="swap-vertical" color="#fff" size={22} /></Pressable>
        <Pressable accessibilityLabel="Settings" onPress={() => navigation.navigate('Settings')} style={styles.headerButton}><Ionicons name="settings-outline" color="#fff" size={21} /></Pressable>
      </View>,
    });
  }, [colors, currentFolderName, navigation, styles]);

  const items = useMemo(() => {
    const source = searchResults ?? resource?.items ?? [];
    return [...source].sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      if (sort === 'size') return a.size - b.size;
      if (sort === 'modified') return new Date(b.modified).getTime() - new Date(a.modified).getTime();
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [resource, searchResults, sort]);

  const open = (item: FileResource) => {
    setSelected(null);
    const itemPath = item.path?.startsWith('/') ? item.path : joinPath(path, item.name);
    if (item.isDir) setPath(itemPath);
    else navigation.navigate('Preview', { file: { ...item, path: itemPath } });
  };

  const runSearch = async () => {
    if (!client || !query.trim()) { setSearchResults(null); return; }
    try { setLoading(true); setSearchResults(await client.search(path, query.trim())); }
    catch (e) { Alert.alert('Search failed', message(e)); }
    finally { setLoading(false); }
  };

  const startUpload = async () => {
    if (!client) return;
    const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
    if (result.canceled) return;
    const uploadOne = async (asset: DocumentPicker.DocumentPickerAsset, remoteName = asset.name, overwrite = false) => {
      const id = `up-${Date.now()}-${remoteName}`;
      transfers.begin({ id, name: remoteName, direction: 'upload', totalBytes: asset.size });
      try {
        await client.upload(asset.uri, joinPath(path, remoteName), overwrite, (sent, total) => transfers.progress(id, sent, total));
        transfers.finish(id);
        await load(true);
      } catch (e) {
        transfers.fail(id, message(e));
        const conflict = e instanceof Error && /409|exist|conflict/i.test(e.message);
        if (conflict && !overwrite) {
          Alert.alert('File already exists', remoteName, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Keep both', onPress: () => {
              const dot = remoteName.lastIndexOf('.');
              const suffix = ` (${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)})`;
              const name = dot > 0 ? `${remoteName.slice(0, dot)}${suffix}${remoteName.slice(dot)}` : `${remoteName}${suffix}`;
              void uploadOne(asset, name);
            } },
            { text: 'Overwrite', style: 'destructive', onPress: () => void uploadOne(asset, remoteName, true) },
          ]);
        } else Alert.alert('Upload failed', message(e));
      }
    };
    result.assets.forEach(asset => void uploadOne(asset));
  };

  const download = async (item: FileResource) => {
    if (!client) return;
    const itemPath = item.path?.startsWith('/') ? item.path : joinPath(path, item.name);
    const id = `down-${Date.now()}-${item.name}`;
    transfers.begin({ id, name: item.name, direction: 'download', totalBytes: item.size });
    try {
      await client.download(itemPath, (received, total) => transfers.progress(id, received, total));
      transfers.finish(id); Alert.alert('Download complete', `${item.name} was saved to Downloads.`);
    } catch (e) { transfers.fail(id, message(e)); Alert.alert('Download failed', message(e)); }
  };

  const confirmPrompt = async () => {
    if (!client || !prompt || !promptValue.trim()) return;
    try {
      if (prompt === 'folder') await client.createFolder(joinPath(path, promptValue.trim()));
      else if (selected) {
        const source = selected.path?.startsWith('/') ? selected.path : joinPath(path, selected.name);
        const destination = prompt === 'rename' ? joinPath(parentPath(source), promptValue.trim()) : normalizePath(promptValue.trim());
        await client.move(source, destination, { copy: prompt === 'copy' });
      }
      setPrompt(null); setSelected(null); await load(true);
    } catch (e) {
      if (e instanceof ApiError && e.category === 'conflict' && selected) {
        Alert.alert('Destination exists', 'Choose how to resolve the conflict.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Keep both', onPress: async () => { try { await client.move(selected.path, promptValue.trim(), { copy: prompt === 'copy', rename: true }); setPrompt(null); await load(true); } catch (err) { Alert.alert('Operation failed', message(err)); } } },
          { text: 'Overwrite', style: 'destructive', onPress: async () => { try { await client.move(selected.path, promptValue.trim(), { copy: prompt === 'copy', overwrite: true }); setPrompt(null); await load(true); } catch (err) { Alert.alert('Operation failed', message(err)); } } },
        ]);
      } else Alert.alert('Operation failed', message(e));
    }
  };

  const deleteSelected = () => selected && client && Alert.alert(`Delete ${selected.name}?`, 'This cannot be undone.', [
    { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => {
      try { await client.remove(selected.path); setSelected(null); await load(true); }
      catch (e) { Alert.alert('Delete failed', message(e)); }
    } },
  ]);

  const shareSelected = async () => {
    if (!selected || !client) return;
    try { const share = await client.createShare(selected.path); await NativeShare.share({ message: client.shareUrl(share.hash), url: client.shareUrl(share.hash) }); }
    catch (e) { Alert.alert('Could not create link', message(e)); }
  };

  const beginPrompt = (kind: typeof prompt) => {
    setPrompt(kind);
    if (kind === 'folder') setPromptValue('');
    else if (kind === 'rename') setPromptValue(selected?.name ?? '');
    else setPromptValue(selected ? joinPath(path, selected.name) : path);
  };

  return <View style={styles.screen}>
    {searchVisible && <View style={styles.searchBar}><Ionicons name="search" color={colors.muted} size={19} /><TextInput autoFocus value={query} onChangeText={setQuery} onSubmitEditing={() => void runSearch()} placeholder="Search this folder" placeholderTextColor={colors.muted} selectionColor={colors.blue} returnKeyType="search" style={styles.searchInput} /><Pressable onPress={() => { setQuery(''); setSearchResults(null); setSearchVisible(false); }}><Ionicons name="close-circle" color={colors.muted} size={21} /></Pressable></View>}
    <View style={styles.breadcrumbs}>
      <Ionicons name="home" color={colors.blue} size={14} /><Pressable onPress={() => setPath('/')}><Text style={styles.crumb}>Home</Text></Pressable>
      {crumbs.map((crumb, index) => <View key={`${crumb}-${index}`} style={{ flexDirection: 'row' }}><Text style={styles.separator}> / </Text><Pressable onPress={() => setPath(`/${crumbs.slice(0, index + 1).join('/')}`)}><Text numberOfLines={1} style={styles.crumb}>{crumb}</Text></Pressable></View>)}
    </View>
    <View style={styles.resultBar}><Text numberOfLines={1} style={styles.resultText}>{items.length} item{items.length === 1 ? '' : 's'}{searchResults ? ` matching “${query}”` : ''}</Text><View style={styles.viewActions}><Pressable accessibilityLabel={`Sorted by ${sort}. Change sort`} onPress={() => setSort(sort === 'name' ? 'modified' : sort === 'modified' ? 'size' : 'name')} style={styles.compactControl}><Ionicons name="swap-vertical" color={colors.muted} size={17} /><Text style={styles.sortText}>{sort}</Text></Pressable><Pressable accessibilityLabel={grid ? 'List view' : 'Grid view'} onPress={() => setGrid(value => !value)} style={styles.compactIconControl}><Ionicons name={grid ? 'list' : 'grid-outline'} color={colors.ink} size={18} /></Pressable></View></View>
    {error ? <View style={styles.center}><Text style={styles.error}>{error}</Text><Pressable onPress={() => void load()} style={styles.retry}><Text style={styles.smallButtonText}>Retry</Text></Pressable></View> : loading ? <View style={styles.center}><ActivityIndicator color={colors.blue} size="large" /></View> :
      <FlatList key={grid ? 'grid' : 'list'} data={items} numColumns={grid ? 2 : 1} keyExtractor={(item, index) => `${item.path || item.name}-${index}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} colors={[colors.blue]} />}
        contentContainerStyle={items.length ? styles.list : styles.center}
        ListEmptyComponent={<Text style={styles.empty}>{searchResults ? 'No matches found.' : 'This folder is empty.'}</Text>}
        renderItem={({ item }) => { const visual = fileVisual(item.name, item.isDir); return <Pressable onPress={() => open(item)} onLongPress={() => setSelected(item)} style={[grid ? styles.gridItem : styles.row, selected === item && styles.selected]}>
          <View style={[grid ? styles.gridIconTile : styles.iconTile, { backgroundColor: dark ? `${visual.color}22` : visual.tint }]}><FileIcon name={item.name} isDir={item.isDir} size={grid ? 34 : 24} /></View>
          <View style={grid ? { alignItems: 'center' } : { flex: 1 }}><Text numberOfLines={grid ? 2 : 1} style={[styles.name, grid && { textAlign: 'center' }]}>{item.name}</Text><Text style={styles.meta}>{item.isDir ? 'Folder' : bytes(item.size)} · {new Date(item.modified).toLocaleDateString()}</Text></View>
          {!grid && <Pressable accessibilityLabel={`Actions for ${item.name}`} onPress={() => setSelected(item)} style={styles.more}><Ionicons name="ellipsis-horizontal" color={colors.muted} size={20} /></Pressable>}
        </Pressable>; }} />}
    {user?.perm.create && <Pressable accessibilityLabel="Add files" onPress={() => setCreateMenu(true)} style={styles.fab}><Ionicons name="add" color="#fff" size={30} /></Pressable>}
    <Modal transparent animationType="fade" visible={Boolean(selected)} onRequestClose={() => setSelected(null)}>
      <Pressable onPress={() => setSelected(null)} style={styles.modalBackdrop}><View style={styles.sheet}>
        <Text numberOfLines={2} style={styles.sheetTitle}>{selected?.name}</Text>
        {selected && !selected.isDir && user?.perm.download && <Action label="Download" onPress={() => { const item = selected; setSelected(null); void download(item); }} />}
        {user?.perm.rename && <Action label="Rename" onPress={() => beginPrompt('rename')} />}
        {user?.perm.create && <Action label="Move" onPress={() => beginPrompt('move')} />}
        {user?.perm.create && <Action label="Copy" onPress={() => beginPrompt('copy')} />}
        {connection?.capabilities.shares && user?.perm.share && <Action label="Create public link" onPress={() => void shareSelected()} />}
        {user?.perm.delete && <Action danger label="Delete" onPress={deleteSelected} />}
      </View></Pressable>
    </Modal>
    <Modal transparent animationType="fade" visible={createMenu} onRequestClose={() => setCreateMenu(false)}><Pressable onPress={() => setCreateMenu(false)} style={styles.modalBackdrop}><View style={styles.createSheet}><Text style={styles.createTitle}>Add to this folder</Text><View style={styles.createChoices}><Pressable onPress={() => { setCreateMenu(false); beginPrompt('folder'); }} style={styles.createChoice}><View style={[styles.createIcon, { backgroundColor: dark ? '#352b1b' : '#fff6e6' }]}><Ionicons name="folder-outline" color="#d88b16" size={28} /></View><Text style={styles.createLabel}>New folder</Text></Pressable><Pressable onPress={() => { setCreateMenu(false); void startUpload(); }} style={styles.createChoice}><View style={[styles.createIcon, { backgroundColor: dark ? colors.selected : '#edf5ff' }]}><Ionicons name="cloud-upload-outline" color={colors.blue} size={29} /></View><Text style={styles.createLabel}>Upload files</Text></Pressable></View></View></Pressable></Modal>
    <PromptModal visible={Boolean(prompt)} title={prompt === 'folder' ? 'New folder' : prompt === 'rename' ? 'Rename' : prompt === 'copy' ? 'Copy to path' : 'Move to path'} value={promptValue} onChange={setPromptValue} onCancel={() => setPrompt(null)} onConfirm={() => void confirmPrompt()} />
  </View>;
}

function Action({ label, danger, onPress }: { label: string; danger?: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <Pressable onPress={onPress} style={styles.action}><Text style={[styles.actionText, danger && { color: colors.danger }]}>{label}</Text></Pressable>;
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, headerActions: { flexDirection: 'row', gap: 2 }, headerButton: { width: 39, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  searchBar: { height: 54, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10, backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.border }, searchInput: { flex: 1, height: 48, color: colors.ink, fontSize: 15 },
  smallButton: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: 9, backgroundColor: colors.blue }, smallButtonText: { color: '#fff', fontWeight: '700' },
  viewActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  breadcrumbs: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 16, backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.border }, crumb: { maxWidth: 110, color: colors.blue, fontSize: 12, fontWeight: '600' }, separator: { color: colors.muted }, resultBar: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15 }, resultText: { flex: 1, marginRight: 8, color: colors.muted, fontSize: 12 }, compactControl: { height: 34, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, borderWidth: 1, borderColor: colors.border, borderRadius: 9, backgroundColor: colors.surface }, compactIconControl: { width: 36, height: 34, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 9, backgroundColor: colors.surface }, sortText: { color: colors.muted, fontSize: 11, textTransform: 'capitalize' },
  list: { paddingHorizontal: 12, paddingBottom: 100 }, row: { flex: 1, minHeight: 72, marginVertical: 4, marginHorizontal: 3, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderRadius: 14, backgroundColor: colors.surface, elevation: 1 },
  gridItem: { flex: 1, minHeight: 156, margin: 5, padding: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.subtle, borderRadius: 16, backgroundColor: colors.surface }, selected: { borderWidth: 2, borderColor: colors.blue, backgroundColor: colors.selected },
  iconTile: { width: 44, height: 44, marginRight: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 12 }, gridIconTile: { width: 64, height: 64, marginBottom: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 18 }, name: { color: colors.ink, fontSize: 14, fontWeight: '600' }, meta: { marginTop: 5, color: colors.muted, fontSize: 11 }, more: { width: 40, height: 48, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, minHeight: 220, alignItems: 'center', justifyContent: 'center', padding: 28 }, empty: { color: colors.muted, textAlign: 'center' }, error: { marginBottom: 15, color: colors.danger, textAlign: 'center' }, retry: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 20, borderRadius: 9, backgroundColor: colors.blue },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 29, backgroundColor: colors.blue, elevation: 8, shadowColor: colors.blue, shadowOpacity: .3, shadowRadius: 10 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,.55)' }, sheet: { paddingBottom: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.surface }, sheetTitle: { padding: 20, color: colors.ink, fontSize: 16, fontWeight: '700', borderBottomWidth: 1, borderColor: colors.border }, action: { minHeight: 54, justifyContent: 'center', paddingHorizontal: 24 }, actionText: { color: colors.ink, fontSize: 16 },
  createSheet: { padding: 24, paddingBottom: 36, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: colors.surface }, createTitle: { color: colors.ink, fontSize: 19, fontWeight: '800' }, createChoices: { flexDirection: 'row', gap: 14, marginTop: 20 }, createChoice: { flex: 1, minHeight: 115, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 16 }, createIcon: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 16 }, createLabel: { marginTop: 9, color: colors.ink, fontWeight: '700' },
});
