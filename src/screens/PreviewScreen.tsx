import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAudioPlayer } from 'expo-audio';
import * as Sharing from 'expo-sharing';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ImageViewing from 'react-native-image-viewing';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { RootStackParams } from '../navigation';
import { useSession } from '../session/SessionContext';
import { AppColors } from '../theme';
import { useAppTheme } from '../theme/ThemeContext';

type Props = NativeStackScreenProps<RootStackParams, 'Preview'>;
const imageExt = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif']);
const videoExt = new Set(['mp4', 'm4v', 'webm', 'mov', 'mkv']);
const audioExt = new Set(['mp3', 'm4a', 'aac', 'wav', 'ogg', 'flac']);
const textExt = new Set(['txt', 'md', 'json', 'xml', 'yaml', 'yml', 'csv', 'log', 'js', 'ts', 'tsx', 'jsx', 'css', 'html', 'ini', 'conf', 'sh', 'py', 'go', 'rs']);

function fileKind(name: string, provided?: string) {
  const ext = (provided || name.split('.').pop() || '').toLowerCase().replace('.', '');
  return imageExt.has(ext) ? 'image' : videoExt.has(ext) ? 'video' : audioExt.has(ext) ? 'audio' : textExt.has(ext) ? 'text' : 'other';
}

export function PreviewScreen({ route, navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { client } = useSession();
  const file = route.params.file;
  const kind = fileKind(file.name, file.extension);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(kind === 'text');
  const [busy, setBusy] = useState(false);
  const [imageVisible, setImageVisible] = useState(kind === 'image');
  const token = client?.getToken() ?? '';
  const rawUrl = client?.rawUrl(file.path) ?? '';
  const source = useMemo(() => ({ uri: rawUrl, headers: { 'X-Auth': token } }), [rawUrl, token]);

  useEffect(() => {
    navigation.setOptions({ headerShown: kind !== 'image', title: kind === 'video' ? 'Video player' : file.name });
  }, [file.name, kind, navigation]);

  useEffect(() => {
    if (kind !== 'text' || !client) return;
    client.readText(file.path).then(setContent).catch(error => setContent(error instanceof Error ? error.message : 'Preview failed.')).finally(() => setLoading(false));
  }, [client, file.path, kind]);

  const cacheFile = async () => {
    if (!client) throw new Error('Not connected.');
    const result = await client.download(file.path, () => {}, true);
    return result.path();
  };

  const runFileAction = async (action: 'open' | 'share') => {
    setBusy(true);
    try {
      const path = await cacheFile();
      if (action === 'share') {
        if (!await Sharing.isAvailableAsync()) throw new Error('Sharing is unavailable on this device.');
        await Sharing.shareAsync(`file://${path}`, { mimeType: file.type, dialogTitle: `Share ${file.name}` });
      } else await ReactNativeBlobUtil.android.actionViewIntent(path, file.type || 'application/octet-stream');
    } catch (e) { Alert.alert(action === 'share' ? 'Cannot share file' : 'Cannot open file', e instanceof Error ? e.message : 'The operation failed.'); }
    finally { setBusy(false); }
  };

  if (kind === 'image') {
    return <View style={styles.blackScreen}>
      <ImageViewing
        images={[source]}
        imageIndex={0}
        visible={imageVisible}
        swipeToCloseEnabled
        doubleTapToZoomEnabled
        onRequestClose={() => { setImageVisible(false); navigation.goBack(); }}
        HeaderComponent={() => <View style={styles.viewerHeader}><Pressable accessibilityLabel="Back" onPress={() => navigation.goBack()} style={styles.circleButton}><Ionicons name="arrow-back" color="#fff" size={23} /></Pressable><Text numberOfLines={1} style={styles.viewerTitle}>{file.name}</Text><Pressable accessibilityLabel="Share" onPress={() => void runFileAction('share')} style={styles.circleButton}><Ionicons name="share-outline" color="#fff" size={22} /></Pressable></View>}
        FooterComponent={() => <View style={styles.viewerFooter}><Text style={styles.viewerHint}>Pinch or double-tap to zoom · Swipe down to close</Text></View>}
      />
    </View>;
  }

  return <View style={[styles.screen, kind === 'video' && styles.blackScreen]}>
    <View style={[styles.preview, kind === 'video' && styles.videoStage]}>
      {kind === 'video' && <VideoPlayer source={source} name={file.name} />}
      {kind === 'audio' && <AudioPlayer source={source} name={file.name} />}
      {kind === 'text' && (loading ? <ActivityIndicator color={colors.blue} size="large" /> : <ScrollView style={styles.textScroll} contentContainerStyle={styles.textContainer}><Text selectable style={styles.code}>{content}</Text></ScrollView>)}
      {kind === 'other' && <View style={styles.placeholder}><View style={styles.documentTile}><Ionicons name="document-text-outline" color={colors.blue} size={42} /></View><Text style={styles.fileName}>{file.name}</Text><Text style={styles.hint}>There isn’t an in-app preview for this format yet.</Text></View>}
    </View>
    {kind !== 'video' && <View style={styles.actions}><Pressable disabled={busy} onPress={() => void runFileAction('open')} style={styles.button}><Ionicons name="open-outline" color="#fff" size={19} /><Text style={styles.buttonText}>{busy ? 'Preparing…' : 'Open in another app'}</Text></Pressable><Pressable disabled={busy} onPress={() => void runFileAction('share')} style={styles.secondary}><Ionicons name="share-outline" color={colors.blue} size={18} /><Text style={styles.secondaryText}>Share</Text></Pressable></View>}
  </View>;
}

function VideoPlayer({ source, name }: { source: { uri: string; headers: Record<string, string> }; name: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [ready, setReady] = useState(false);
  const [looping, setLooping] = useState(false);
  const player = useVideoPlayer(source, instance => { instance.play(); });
  useEffect(() => { player.loop = looping; }, [looping, player]);
  return <View style={styles.videoPlayer}>
    {!ready && <View style={styles.videoLoading}><ActivityIndicator color="#fff" size="large" /><Text style={styles.videoLoadingText}>Loading video…</Text></View>}
    <VideoView player={player} nativeControls contentFit="contain" fullscreenOptions={{ enable: true, orientation: 'default' }} onFirstFrameRender={() => setReady(true)} style={StyleSheet.absoluteFill} />
    <View style={styles.videoCaption}><Text numberOfLines={1} style={styles.videoName}>{name}</Text><Pressable accessibilityLabel={looping ? 'Disable video loop' : 'Enable video loop'} accessibilityRole="switch" accessibilityState={{ checked: looping }} onPress={() => setLooping(value => !value)} style={[styles.loopButton, looping && styles.loopButtonActive]}><Ionicons name="repeat" color="#fff" size={18} /><Text style={styles.loopText}>{looping ? 'Loop on' : 'Loop'}</Text></Pressable></View>
  </View>;
}

function AudioPlayer({ source, name }: { source: { uri: string; headers: Record<string, string> }; name: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const player = useAudioPlayer(source);
  const [playing, setPlaying] = useState(false);
  return <View style={styles.audioCard}><View style={styles.album}><Ionicons name="musical-note" color="#fff" size={52} /></View><Text numberOfLines={2} style={styles.audioName}>{name}</Text><Pressable accessibilityLabel={playing ? 'Pause' : 'Play'} onPress={() => { playing ? player.pause() : player.play(); setPlaying(!playing); }} style={styles.playButton}><Ionicons name={playing ? 'pause' : 'play'} color="#fff" size={30} /></Pressable></View>;
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, blackScreen: { flex: 1, backgroundColor: '#000' }, preview: { flex: 1, alignItems: 'center', justifyContent: 'center' }, videoStage: { backgroundColor: '#000' },
  viewerHeader: { position: 'absolute', zIndex: 5, top: 0, left: 0, right: 0, minHeight: 88, paddingTop: 30, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(0,0,0,.46)' }, circleButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: 'rgba(255,255,255,.12)' }, viewerTitle: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '700', textAlign: 'center' }, viewerFooter: { minHeight: 64, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,.4)' }, viewerHint: { color: 'rgba(255,255,255,.72)', fontSize: 12 },
  videoPlayer: { width: '100%', height: '100%', backgroundColor: '#000' }, videoLoading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' }, videoLoadingText: { marginTop: 12, color: 'rgba(255,255,255,.7)', fontSize: 13 }, videoCaption: { position: 'absolute', top: 0, left: 0, right: 0, minHeight: 58, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(0,0,0,.42)' }, videoName: { flex: 1, color: '#fff', fontWeight: '700' }, loopButton: { minHeight: 36, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,.28)', borderRadius: 18, backgroundColor: 'rgba(255,255,255,.12)' }, loopButtonActive: { borderColor: '#60a5fa', backgroundColor: '#2563eb' }, loopText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  textScroll: { alignSelf: 'stretch' }, textContainer: { padding: 20 }, code: { color: colors.ink, fontFamily: 'monospace', fontSize: 13, lineHeight: 20 },
  placeholder: { alignItems: 'center', padding: 28 }, documentTile: { width: 86, height: 86, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: colors.selected }, fileName: { marginTop: 18, color: colors.ink, fontSize: 18, fontWeight: '800', textAlign: 'center' }, hint: { maxWidth: 280, marginTop: 8, color: colors.muted, lineHeight: 20, textAlign: 'center' },
  audioCard: { width: '86%', padding: 28, alignItems: 'center', borderRadius: 26, backgroundColor: colors.surface, elevation: 3 }, album: { width: 128, height: 128, alignItems: 'center', justifyContent: 'center', borderRadius: 32, backgroundColor: '#14b8a6' }, audioName: { marginTop: 22, color: colors.ink, fontSize: 18, fontWeight: '800', textAlign: 'center' }, playButton: { width: 64, height: 64, marginTop: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 32, backgroundColor: colors.blue },
  actions: { padding: 14, gap: 6, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, button: { minHeight: 48, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.blue, paddingHorizontal: 18 }, buttonText: { color: '#fff', fontWeight: '700' }, secondary: { minHeight: 43, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' }, secondaryText: { color: colors.blue, fontWeight: '700' },
});
