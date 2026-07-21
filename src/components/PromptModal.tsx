import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppColors } from '../theme';
import { useAppTheme } from '../theme/ThemeContext';

export function PromptModal({ visible, title, value, placeholder, confirmLabel = 'Save', destructive, onChange, onCancel, onConfirm }: {
  visible: boolean; title: string; value: string; placeholder?: string; confirmLabel?: string; destructive?: boolean;
  onChange: (value: string) => void; onCancel: () => void; onConfirm: () => void;
}) {
  const { colors, sharedStyles } = useAppTheme();
  const styles = makeStyles(colors);
  return <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
    <KeyboardAvoidingView behavior="padding" style={styles.backdrop}><View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <TextInput autoFocus value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.muted} selectionColor={colors.blue} style={sharedStyles.input} onSubmitEditing={onConfirm} />
      <View style={styles.row}>
        <Pressable onPress={onCancel} style={sharedStyles.secondaryButton}><Text style={sharedStyles.secondaryText}>Cancel</Text></Pressable>
        <Pressable onPress={onConfirm} style={[styles.confirm, destructive && { backgroundColor: colors.danger }]}><Text style={sharedStyles.buttonText}>{confirmLabel}</Text></Pressable>
      </View>
    </View></KeyboardAvoidingView>
  </Modal>;
}
const makeStyles = (colors: AppColors) => StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,.38)' },
  card: { width: '100%', maxWidth: 420, padding: 20, borderRadius: 16, backgroundColor: colors.surface },
  title: { marginBottom: 14, color: colors.ink, fontSize: 19, fontWeight: '700' },
  row: { marginTop: 14, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  confirm: { minHeight: 44, minWidth: 90, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.blue, paddingHorizontal: 14 },
});
