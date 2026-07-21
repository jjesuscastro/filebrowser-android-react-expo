import { Ionicons } from '@expo/vector-icons';
import { StyleProp, ViewStyle } from 'react-native';

function extension(name: string) { return name.split('.').pop()?.toLowerCase() ?? ''; }

export function fileVisual(name: string, isDir: boolean): { icon: keyof typeof Ionicons.glyphMap; color: string; tint: string } {
  if (isDir) return { icon: 'folder', color: '#f2a93b', tint: '#fff6e6' };
  const ext = extension(name);
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif'].includes(ext)) return { icon: 'image', color: '#8b5cf6', tint: '#f2edff' };
  if (['mp4', 'm4v', 'webm', 'mov', 'mkv'].includes(ext)) return { icon: 'play-circle', color: '#ec4899', tint: '#fff0f7' };
  if (['mp3', 'm4a', 'aac', 'wav', 'ogg', 'flac'].includes(ext)) return { icon: 'musical-note', color: '#14b8a6', tint: '#e9fbf8' };
  if (ext === 'pdf') return { icon: 'document-text', color: '#ef4444', tint: '#fff0f0' };
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return { icon: 'archive', color: '#d97706', tint: '#fff7e8' };
  if (['txt', 'md', 'json', 'xml', 'csv', 'log', 'js', 'ts', 'tsx', 'py'].includes(ext)) return { icon: 'code-slash', color: '#3b82f6', tint: '#edf5ff' };
  return { icon: 'document', color: '#64748b', tint: '#f1f5f9' };
}

export function FileIcon({ name, isDir, size = 22, style }: { name: string; isDir: boolean; size?: number; style?: StyleProp<ViewStyle> }) {
  const visual = fileVisual(name, isDir);
  return <Ionicons name={visual.icon} color={visual.color} size={size} style={style} />;
}
