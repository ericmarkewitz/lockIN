import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ExercisePicker } from '@/components/ExercisePicker';
import { ExerciseMotionFor } from '@/components/motion/ExerciseMotion';
import { Icon, sym } from '@/components/Icon';
import { SetHeader, SetRow } from '@/components/SetRow';
import { AddButton, Button, Segmented } from '@/components/ui';
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
import { tint, useTheme } from '@/theme';

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

/** An exercise is finished once it has sets and every one is marked done. */
const isFinished = (e: WorkoutExercise) => e.sets.length > 0 && e.sets.every((x) => x.completed);

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

  // The full plan counts finished exercises; focus mode counts the current lift's sets.
  const focused = mode === 'focus' && exercises.length > 0 ? exercises[idx] : null;
  const progress = focused
    ? { done: focused.sets.filter((x) => x.completed).length, total: focused.sets.length, unit: 'sets', finished: 'Exercise complete', empty: 'No sets yet' }
    : { done: exercises.filter(isFinished).length, total: exercises.length, unit: 'exercises', finished: 'Workout complete', empty: 'No exercises yet' };
  const complete = progress.total > 0 && progress.done === progress.total;

  const confirmRemoveExercise = (ex: WorkoutExercise) => {
    const remove = () => removeExerciseFromWorkout(db, ex.id);
    if (ex.hasLoggedSets) setRemoval({ title: `Remove ${ex.exerciseName}?`, message: "Its logged sets will be deleted. This can't be undone.", remove });
    else act(remove);
  };

  return (
    <View style={{ gap: 14 }}>
      <View style={[styles.summary, { backgroundColor: t.card, borderColor: t.border }]}>
        {!workout.isRest && (
          <View accessible accessibilityLabel={`${progress.done} of ${progress.total} ${progress.unit} done`} style={styles.progress}>
            <View style={styles.progressTop}>
              <Text style={[styles.big, { color: t.text }]}>
                {progress.done}<Text style={{ color: t.muted }}>/{progress.total}</Text>
              </Text>
              <Text style={[styles.progressLabel, { color: complete ? t.success : t.muted }]}>
                {complete ? progress.finished : progress.total ? `${progress.unit} done` : progress.empty}
              </Text>
            </View>
            <View style={[styles.track, { backgroundColor: t.surface }]}>
              <View style={[styles.fill, { backgroundColor: t.success, width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }]} />
            </View>
          </View>
        )}
        <View style={[styles.restRow, !workout.isRest && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: t.border, paddingTop: 12 }]}>
          <Icon name={sym('moon.zzz.fill', 'bedtime')} size={16} color={workout.isRest ? t.rest : t.muted} fallback="☾" />
          <Text style={{ color: t.text, fontWeight: '600', flex: 1 }}>Rest day</Text>
          <Switch accessibilityLabel="Rest day" value={workout.isRest} onValueChange={(v) => act(() => setRestDay(db, date, v))} />
        </View>
      </View>

      {workout.isRest && (
        <View style={[styles.restBox, { backgroundColor: tint(t.rest, 0.08) }]}>
          <Icon name={sym('moon.stars.fill', 'nights_stay')} size={30} color={t.rest} fallback="☾" />
          <Text style={{ color: t.muted, textAlign: 'center' }}>
            {exercises.length ? 'Marked as a rest day. Logged sets stay in your history.' : 'Rest and recover. 😴'}
          </Text>
        </View>
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
          {shown.map((ex) => {
            const exDone = ex.sets.filter((x) => x.completed).length;
            const finished = isFinished(ex);
            return (
              <View key={ex.id} testID={`exercise-${ex.exerciseName}`} style={[styles.exCard, { backgroundColor: t.card, borderColor: t.border }]}>
                <View style={styles.exHead}>
                  <View style={[styles.figure, { backgroundColor: tint(t.primary, 0.07) }]}>
                    {ex.isCustom ? (
                      <Text style={[styles.initial, { color: t.primary }]}>{ex.exerciseName.trim().charAt(0).toUpperCase()}</Text>
                    ) : (
                      <ExerciseMotionFor name={ex.exerciseName} isCustom={ex.isCustom} size={44} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.exName, { color: t.text }]}>{ex.exerciseName}</Text>
                    <Text style={{ color: t.muted, fontSize: 13 }}>
                      {ex.categoryName}
                      {ex.subcategory ? ` · ${ex.subcategory}` : ''}
                      {ex.categoryKind === 'strength' && ex.targetSets ? ` · ${ex.targetSets}×${ex.targetReps ?? '?'}` : ''}
                      {ex.targetDurationMin ? ` · ${formatDuration(ex.targetDurationMin)}` : ''}
                      {ex.targetDistance ? ` · ${ex.targetDistance} dist` : ''}
                    </Text>
                  </View>
                  <View style={[styles.count, { backgroundColor: finished ? tint(t.success, 0.15) : t.surface }]}>
                    <Text style={[styles.countText, { color: finished ? t.success : t.muted }]}>{exDone}/{ex.sets.length}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${ex.exerciseName}`}
                    onPress={() => confirmRemoveExercise(ex)}
                    hitSlop={8}
                    style={({ pressed }) => [styles.trash, { opacity: pressed ? 0.5 : 1 }]}
                  >
                    <Icon name={sym('trash', 'delete')} size={16} color={t.muted} fallback="✕" />
                  </Pressable>
                </View>
                {last[ex.exerciseId] && (
                  <View style={[styles.last, { backgroundColor: t.surface }]}>
                    <Icon name={sym('clock.arrow.circlepath', 'history')} size={12} color={t.muted} fallback="↺" />
                    <Text style={{ color: t.muted, fontSize: 12, flexShrink: 1 }}>{fmtLast(last[ex.exerciseId]!, ex.categoryKind, unit)}</Text>
                  </View>
                )}
                {ex.sets.length > 0 && <SetHeader kind={ex.categoryKind} />}
                {ex.sets.map((x) => (
                  <SetRow
                    key={x.id}
                    kind={ex.categoryKind}
                    set={x}
                    targetDurationMin={ex.targetDurationMin}
                    unit={unit}
                    onChange={(patch: SetPatch) => act(() => updateSet(db, x.id, patch))}
                    onRemove={() => {
                      const remove = () => removeSet(db, x.id);
                      if (x.isLogged) setRemoval({ title: `Remove set ${x.setNumber}?`, message: `This deletes what you logged for ${ex.exerciseName}. This can't be undone.`, remove });
                      else act(remove);
                    }}
                  />
                ))}
                <AddButton quiet title="Add set" label={`Add set to ${ex.exerciseName}`} onPress={() => act(() => addSet(db, ex.id))} />
              </View>
            );
          })}
          {mode === 'focus' && exercises.length > 1 && (
            <View style={styles.nav}>
              <Button title="‹ Previous" variant="secondary" disabled={idx === 0} onPress={() => setFocusIdx(idx - 1)} style={{ flex: 1 }} />
              <Text style={{ color: t.muted, alignSelf: 'center', fontVariant: ['tabular-nums'] }}>{idx + 1} / {exercises.length}</Text>
              <Button title="Next ›" variant="secondary" disabled={idx >= exercises.length - 1} onPress={() => setFocusIdx(idx + 1)} style={{ flex: 1 }} />
            </View>
          )}
          {!workout.isRest && <AddButton title="Add exercise" onPress={() => setPicking(true)} />}
          <View style={[styles.notesCard, { backgroundColor: t.card, borderColor: t.border }]}>
            <View style={styles.notesHead}>
              <Icon name={sym('square.and.pencil', 'edit_note')} size={14} color={t.muted} fallback="✎" />
              <Text style={[styles.notesTitle, { color: t.muted }]}>Notes</Text>
            </View>
            <TextInput
              accessibilityLabel="Workout notes"
              defaultValue={workout.notes ?? ''}
              placeholder="How did it feel?"
              placeholderTextColor={t.muted}
              multiline
              onEndEditing={(e) => act(() => setWorkoutNotes(db, date, e.nativeEvent.text))}
              style={[styles.notes, { color: t.text }]}
            />
          </View>
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
  summary: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 12 },
  progress: { gap: 10 },
  progressTop: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  big: { fontSize: 30, fontWeight: '800', fontVariant: ['tabular-nums'] },
  progressLabel: { fontSize: 14, fontWeight: '700' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  restRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  restBox: { alignItems: 'center', gap: 10, padding: 28, borderRadius: 18 },
  exCard: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 6 },
  exHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 4 },
  figure: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 22, fontWeight: '800' },
  exName: { fontSize: 17, fontWeight: '800' },
  count: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  countText: { fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] },
  trash: { padding: 4 },
  last: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  nav: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  notesCard: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 6 },
  notesHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  notesTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  notes: { minHeight: 48, fontSize: 15, textAlignVertical: 'top', padding: 0 },
});
