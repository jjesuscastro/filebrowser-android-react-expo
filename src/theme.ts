import { StyleSheet } from 'react-native';

export const lightColors = {
  navy: '#0b1220', blue: '#2563eb', cyan: '#38bdf8', ink: '#172033',
  muted: '#718096', border: '#e5eaf1', surface: '#ffffff', background: '#f6f8fc',
  input: '#ffffff', selected: '#eff6ff', subtle: '#edf0f5',
  danger: '#b42318', success: '#16835a', warning: '#b54708',
};

export const darkColors: AppColors = {
  navy: '#080d17', blue: '#60a5fa', cyan: '#38bdf8', ink: '#eef4ff',
  muted: '#9aa8bd', border: '#2b3545', surface: '#151d2a', background: '#0d1420',
  input: '#101926', selected: '#182d4b', subtle: '#202a39',
  danger: '#ff7b72', success: '#55d6a5', warning: '#f5a65b',
};

export type AppColors = typeof lightColors;
// Kept for non-themed utility code; UI components should use useAppTheme().colors.
export const colors = lightColors;

export function makeSharedStyles(palette: AppColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.background },
    card: { margin: 16, padding: 18, borderRadius: 16, backgroundColor: palette.surface, elevation: 2 },
    title: { fontSize: 24, fontWeight: '700', color: palette.ink },
    subtitle: { marginTop: 6, color: palette.muted, fontSize: 14, lineHeight: 20 },
    label: { marginTop: 18, marginBottom: 6, color: palette.ink, fontWeight: '600' },
    input: { minHeight: 48, borderWidth: 1, borderColor: palette.border, borderRadius: 10, paddingHorizontal: 13, backgroundColor: palette.input, color: palette.ink },
    button: { minHeight: 48, marginTop: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: palette.blue, paddingHorizontal: 16 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    secondaryButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
    secondaryText: { color: palette.blue, fontWeight: '600' },
    error: { marginTop: 10, color: palette.danger, lineHeight: 19 },
  });
}
