import { useCallback, useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ExercisePicker } from '@/components/ExercisePicker';
import { SetRow } from '@/components/SetRow';
import { Button, Card, Segmented } from '@/components/ui';
import type { Exercise, WorkoutExercise, WorkoutSet } from '@/data/types';
import {
  addExerciseToWorkout, addSet, ensureWorkout, getLastPerformance, removeExerciseFromWorkout, removeSet,
  setRestDay, setWorkoutNotes, updateSet, type SetPatch,
} from '@/data/workouts';
import { getWeightUnit, type WeightUnit } from '@/data/settings';
import { useDb } from '@/db/DbContext';
import { useLoad } from '@/hooks/useLoad';
import { formatDuration } from '@/lib/duration';
import { toDisplayWeight } from '@/lib/units';
import { useTheme } from '@/theme';

type Mode = 'plan' | 'focus';

async function loadDay(db: ReturnType<typeof useDb>, date: string) {
  const workout = await ensureWorkout(db, date);
  const unit = await getWeightUnit(db);
  const last: Record<number, { date: string; sets: WorkoutSet[] } | null> = {};
  for (const e of workout.exercises) last[e.exerciseId] = await getLastPerformance(db, e.exerciseId, date);
  return { workout, unit, last };
}

const fmtLast = (l: { date: string; sets: WorkoutSet[] }, kind: WorkoutExercise['categoryKind'], unit: WeightUnit) =>
  `Last (${l.date}): ` +
  l.sets
    .map((s) => (kind === 'strength' ? `${toDisplayWeight(s.weight, unit) ?? '–'}×${s.reps ?? '–'}` : `${formatDuration(s.durationMin) || '–'}${s.distance ? ` ${s.distance}` : ''}`))
    .join(', ');

export function WorkoutView({ date }: { date: string }) {
  const db = useDb();
  const t = useTheme();
  const { data, reload } = useLoad(() => loadDay(db, date), [db, date]);
  const [mode, setMode] = useState<Mode>('plan');
  const [focusIdx, setFocusIdx] = useState(0);
  const [picking, setPicking] = useState(false);
  const [removal, setRemoval] = useState<{ title: string; message: string; remove: () => Promise<void> } | null>(null);

  const act = useCallback(async (fn: () => Promise<unknown>) => { await fn(); await reload(); }, [reload]);

  if (!data) return null;
  const { workout, unit, last } = data;
  // A rest day hides what was only planned, but never what was logged.
  const exercises = workout.isRest ? workout.exercises.filter((e) => e.hasLoggedSets) : workout.exercises;
  const idx = Math.min(focusIdx, Math.max(exercises.length - 1, 0));
  const shown = mode === 'focus' && exercises.length ? [exercises[idx]] : exercises;

  const addEx = async (e: Exercise) => {
    setPicking(false);
    await act(() => addExerciseToWorkout(db, workout.id, e.id, e.categoryKind === 'strength' ? { targetSets: 3, targetReps: 10 } : {}));
  };

  return (
    <View style={{ gap: 12 }}>
      <Card style={styles.restRow}>
        <Text style={{ color: t.text, fontWeight: '600' }}>Rest day</Text>
        <Switch accessibilityLabel="Rest day" value={workout.isRest} onValueChange={(v) => act(() => setRestDay(db, date, v))} />
      </Card>

      {workout.isRest && (
        <Text style={{ color: t.muted, textAlign: 'center', padding: 16 }}>
          {exercises.length ? 'Marked as a rest day. Logged sets stay in your history.' : 'Rest and recover. 😴'}
        </Text>
      )}
      {(!workout.isRest || exercises.length > 0) && (
        <>
          {exercises.length > 1 && (
            <Segmented<Mode>
              options={[{ value: 'plan', label: 'Full plan' }, { value: 'focus', label: 'Current lift' }]}
              value={mode}
              onChange={setMode}
            />
          )}
          {shown.map((ex) => (
            <Card key={ex.id} style={{ gap: 4 }}>
              <View style={styles.exHead}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.exName, { color: t.text }]}>{ex.exerciseName}</Text>
                  <Text style={{ color: t.muted, fontSize: 12 }}>
                    {ex.categoryName}
                    {ex.subcategory ? ` · ${ex.subcategory}` : ''}
                    {ex.categoryKind === 'strength' && ex.targetSets ? ` · ${ex.targetSets}×${ex.targetReps ?? '?'}` : ''}
                    {ex.targetDurationMin ? ` · ${formatDuration(ex.targetDurationMin)}` : ''}
                    {ex.targetDistance ? ` · ${ex.targetDistance} dist` : ''}
                  </Text>
                </View>
                <Button title="Remove" variant="danger" label={`Remove ${ex.exerciseName}`} onPress={() => {
                  const remove = () => removeExerciseFromWorkout(db, ex.id);
                  if (ex.hasLoggedSets) setRemoval({ title: `Remove ${ex.exerciseName}?`, message: "Its logged sets will be deleted. This can't be undone.", remove });
                  else act(remove);
                }} style={styles.small} />
              </View>
              {last[ex.exerciseId] && <Text style={{ color: t.muted, fontSize: 12 }}>{fmtLast(last[ex.exerciseId]!, ex.categoryKind, unit)}</Text>}
              {ex.sets.map((s) => (
                <SetRow
                  key={s.id}
                  kind={ex.categoryKind}
                  set={s}
                  targetDurationMin={ex.targetDurationMin}
                  unit={unit}
                  onChange={(patch: SetPatch) => act(() => updateSet(db, s.id, patch))}
                  onRemove={() => {
                    const remove = () => removeSet(db, s.id);
                    if (s.isLogged) setRemoval({ title: `Remove set ${s.setNumber}?`, message: `This deletes what you logged for ${ex.exerciseName}. This can't be undone.`, remove });
                    else act(remove);
                  }}
                />
              ))}
              <Button title="+ Add set" variant="secondary" label={`Add set to ${ex.exerciseName}`} onPress={() => act(() => addSet(db, ex.id))} />
            </Card>
          ))}
          {mode === 'focus' && exercises.length > 1 && (
            <View style={styles.nav}>
              <Button title="‹ Previous" variant="secondary" disabled={idx === 0} onPress={() => setFocusIdx(idx - 1)} style={{ flex: 1 }} />
              <Text style={{ color: t.muted, alignSelf: 'center' }}>{idx + 1} / {exercises.length}</Text>
              <Button title="Next ›" variant="secondary" disabled={idx >= exercises.length - 1} onPress={() => setFocusIdx(idx + 1)} style={{ flex: 1 }} />
            </View>
          )}
          {!workout.isRest && <Button title="+ Add exercise" variant="secondary" onPress={() => setPicking(true)} />}
          <TextInput
            accessibilityLabel="Workout notes"
            defaultValue={workout.notes ?? ''}
            placeholder="Notes (how did it feel?)"
            placeholderTextColor={t.muted}
            multiline
            onEndEditing={(e) => act(() => setWorkoutNotes(db, date, e.nativeEvent.text))}
            style={[styles.notes, { color: t.text, borderColor: t.border, backgroundColor: t.card }]}
          />
        </>
      )}
      <ExercisePicker visible={picking} onClose={() => setPicking(false)} onPick={addEx} />
      {removal && (
        <ConfirmDialog
          title={removal.title}
          message={removal.message}
          confirmLabel="Remove"
          onCancel={() => setRemoval(null)}
          onConfirm={() => {
            setRemoval(null);
            act(removal.remove);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  restRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  exHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exName: { fontSize: 17, fontWeight: '700' },
  small: { paddingVertical: 4, paddingHorizontal: 8 },
  nav: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  notes: { borderWidth: 1, borderRadius: 10, padding: 12, minHeight: 60, textAlignVertical: 'top' },
});
