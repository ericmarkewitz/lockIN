import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { getExerciseUsage, removeExercise, updateExercise, type ExerciseUsage } from '@/data/exercises';
import type { Exercise } from '@/data/types';
import { useDb } from '@/db/DbContext';
import { DAY_NAMES } from '@/lib/calendar';
import { todayKey } from '@/lib/dates';
import { useTheme } from '@/theme';
import { ConfirmDialog } from './ConfirmDialog';
import { MuscleGroupChips, toggled } from './MuscleGroupChips';
import { Button } from './ui';

const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];

const listed = (names: string[]) =>
  names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/** What removing an exercise does, for the confirmation. */
export function removalMessage({ plannedWeekdays, loggedWorkouts }: ExerciseUsage): string {
  const parts: string[] = [];
  if (plannedWeekdays.length) {
    const days = MONDAY_FIRST.filter((d) => plannedWeekdays.includes(d)).map((d) => DAY_NAMES[d]);
    parts.push(`It comes off your plan on ${listed(days)}.`);
  }
  if (loggedWorkouts) {
    parts.push(loggedWorkouts === 1
      ? 'The 1 workout you logged it in keeps it.'
      : `The ${loggedWorkouts} workouts you logged it in keep it.`);
  }
  return parts.join(' ') || "It isn't in your plan and hasn't been logged.";
}

/** Renames a custom exercise, changes its muscle groups, or removes it. */
export function EditExerciseSheet({ exercise, subcategories, onSaved, onRemoved, onClose }: {
  exercise: Exercise;
  /** The muscle groups its category offers; empty hides the chips. */
  subcategories: readonly string[];
  onSaved: (e: Exercise) => void;
  onRemoved: (id: number) => void;
  onClose: () => void;
}) {
  const db = useDb();
  const t = useTheme();
  const [name, setName] = useState(exercise.name);
  const [groups, setGroups] = useState(() => [exercise.subcategory, ...exercise.alsoIn].filter((s): s is string => !!s));
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const save = async () => {
    try {
      const [main = null, ...alsoIn] = groups;
      onSaved(await updateExercise(db, exercise.id, { name, subcategory: main, alsoIn }));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const askRemove = async () => setConfirm(removalMessage(await getExerciseUsage(db, exercise.id)));
  const remove = async () => {
    setConfirm(null);
    await removeExercise(db, exercise.id, todayKey());
    onRemoved(exercise.id);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
        <Pressable testID="edit-backdrop" accessible={false} onPress={onClose} style={styles.backdrop} />
        <View style={[styles.sheet, { backgroundColor: t.card }]}>
          <Text accessibilityRole="header" style={[styles.title, { color: t.text }]}>Edit exercise</Text>
          <TextInput
            accessibilityLabel="Exercise name"
            value={name}
            onChangeText={(v) => { setName(v); setError(null); }}
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={save}
            style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.bg }]}
          />
          {subcategories.length > 0 && (
            <View>
              <Text style={[styles.label, { color: t.muted }]}>Muscle groups · the first is its main one</Text>
              <MuscleGroupChips options={subcategories} picked={groups} onToggle={(s) => setGroups(toggled(groups, s))} t={t} />
            </View>
          )}
          {error && <Text style={{ color: t.danger }}>{error}</Text>}
          <View style={styles.actions}>
            <Button title="Cancel" label="Cancel editing" variant="secondary" onPress={onClose} style={styles.action} />
            <Button title="Save" label="Save exercise" onPress={save} style={styles.action} />
          </View>
          <Button title="Remove exercise" variant="danger" onPress={askRemove} />
        </View>
      </KeyboardAvoidingView>
      {confirm && (
        <ConfirmDialog
          title={`Remove ${exercise.name}?`}
          message={confirm}
          confirmLabel="Remove"
          onConfirm={remove}
          onCancel={() => setConfirm(null)}
        />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: 24 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderRadius: 16, padding: 20, gap: 12, width: '100%', maxWidth: 420, alignSelf: 'center' },
  title: { fontSize: 17, fontWeight: '700' },
  input: { height: 44, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, fontSize: 16 },
  label: { fontSize: 13, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1 },
});
