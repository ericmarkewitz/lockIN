import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { FieldId } from '@/data/fields';
import type { CategoryKind } from '@/data/types';
import { useTheme } from '@/theme';
import { FieldChips } from './FieldChips';
import { Button } from './ui';

/** Asks what an exercise should record, starting from `initial`. */
export function RecordSheet({
  exerciseName, kind, initial, confirmLabel, confirmA11yLabel, onConfirm, onClose,
}: {
  exerciseName: string; kind: CategoryKind; initial: readonly FieldId[];
  /** "Add" when it's asked on adding the exercise to the plan, "Save" when changing it. */
  confirmLabel: string;
  /** What the confirm button is announced as; "<confirmLabel> <exercise>" by default. */
  confirmA11yLabel?: string;
  onConfirm: (fields: FieldId[]) => void; onClose: () => void;
}) {
  const t = useTheme();
  const [fields, setFields] = useState<FieldId[]>([...initial]);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable testID="record-backdrop" accessible={false} onPress={onClose} style={styles.backdrop} />
        <View style={[styles.sheet, { backgroundColor: t.card }]}>
          <Text accessibilityRole="header" style={[styles.title, { color: t.text }]}>What to record</Text>
          <Text style={{ color: t.muted }}>{exerciseName}</Text>
          <FieldChips kind={kind} picked={fields} onChange={setFields} t={t} />
          <View style={styles.actions}>
            <Button title="Cancel" variant="secondary" onPress={onClose} style={styles.action} />
            <Button title={confirmLabel} label={confirmA11yLabel ?? `${confirmLabel} ${exerciseName}`} onPress={() => onConfirm(fields)} style={styles.action} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: 24 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderRadius: 16, padding: 20, gap: 8, width: '100%', maxWidth: 420, alignSelf: 'center' },
  title: { fontSize: 17, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  action: { flex: 1 },
});
