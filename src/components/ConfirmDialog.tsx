import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';
import { Button } from './ui';

/**
 * Asks before a destructive action. Built on Modal rather than Alert because
 * react-native-web's Alert does nothing, which would leave the action unreachable.
 */
export function ConfirmDialog({
  title, message, confirmLabel, onConfirm, onCancel,
}: { title: string; message: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void }) {
  const t = useTheme();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.root}>
        <Pressable testID="confirm-backdrop" accessible={false} onPress={onCancel} style={styles.backdrop} />
        <View accessibilityRole="alert" style={[styles.dialog, { backgroundColor: t.card }]}>
          <Text style={[styles.title, { color: t.text }]}>{title}</Text>
          <Text style={{ color: t.muted }}>{message}</Text>
          <View style={styles.actions}>
            <Button title="Cancel" variant="secondary" onPress={onCancel} style={styles.action} />
            <Button title={confirmLabel} variant="danger" onPress={onConfirm} style={styles.action} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: 24 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  dialog: { borderRadius: 16, padding: 20, gap: 8, width: '100%', maxWidth: 400, alignSelf: 'center' },
  title: { fontSize: 17, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  action: { flex: 1 },
});
