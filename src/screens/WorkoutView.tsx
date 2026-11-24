import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ChangeRecords } from '@/components/ChangeRecords';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DragHandle } from '@/components/DragHandle';
import { ExercisePicker } from '@/components/ExercisePicker';
import { ExerciseMotionFor } from '@/components/motion/ExerciseMotion';
import { Icon, sym } from '@/components/Icon';
import { SetHeader, SetRow } from '@/components/SetRow';
import { AddButton, Button, Eyebrow, Toggle, useRaised } from '@/components/ui';
import type { Exercise, WorkoutExercise } from '@/data/types';
import {
  addExerciseToWorkout, addSet, loadDay, removeExerciseFromWorkout, removeSet, reorderWorkoutExercises,
  setRestDay, setWorkoutNotes, shownExercises, updateSet, type SetPatch,
} from '@/data/workouts';
import { useDb } from '@/db/DbContext';
import { useLoad } from '@/hooks/useLoad';
import { defaultTargets, formatTargets } from '@/lib/fields';
import { dropIndexByHeights, moveItem } from '@/lib/reorder';
import { formatSets } from '@/lib/workoutMode';
import { mix, tint, useTheme } from '@/theme';

/** An exercise is finished once it has sets and every one is marked done. */
const isFinished = (e: WorkoutExercise) => e.sets.length > 0 && e.sets.every((x) => x.completed);

/** Space between the cards; part of how far a dragged card has to travel. */
const GAP = 14;

type Props = {
  date: string;
  /** Told when an exercise drag starts and ends, so the screen can hold its scrolling still. */
  onDragChange?: (dragging: boolean) => void;
};

export function WorkoutView({ date, onDragChange }: Props) {
  const db = useDb();
  const t = useTheme();
  const router = useRouter();
  const raised = useRaised();
  const { data, reload } = useLoad(() => loadDay(db, date), [db, date]);
  // Workout mode logs sets on its own screen; pick them up on the way back. Not on the first
  // focus: useLoad is already loading, and two loads at once would both create the day.
  const focusedBefore = useRef(false);
  useFocusEffect(useCallback(() => {
    if (focusedBefore.current) reload();
    focusedBefore.current = true;
  }, [reload]));
  const [picking, setPicking] = useState(false);
  /** The exercise whose fields are being changed for this day. */
  const [changing, setChanging] = useState<WorkoutExercise | null>(null);
  const [removal, setRemoval] = useState<{ title: string; message: string; remove: () => Promise<void> } | null>(null);
  /** A new order shown straight away, while it is saved. */
  const [pendingOrder, setPendingOrder] = useState<number[] | null>(null);
  const [drag, setDrag] = useState<{ from: number; over: number; height: number } | null>(null);
  const dragRef = useRef(drag);
  const [dragY] = useState(() => new Animated.Value(0));
  const cardHeights = useRef(new Map<number, number>());

  const act = useCallback(async (fn: () => Promise<unknown>) => { await fn(); await reload(); }, [reload]);

  if (!data) return null;
  const { workout, units, last } = data;
  const shown = shownExercises(workout);
  const exercises = pendingOrder
    ? [...shown].sort((a, b) => pendingOrder.indexOf(a.id) - pendingOrder.indexOf(b.id))
    : shown;

  const reorder = async (from: number, to: number) => {
    const ids = exercises.map((e) => e.id);
    const next = moveItem(ids, from, to);
    if (next.every((id, i) => id === ids[i])) return;
    setPendingOrder(next);
    try {
      await act(() => reorderWorkoutExercises(db, workout.id, next));
    } finally {
      setPendingOrder(null);
    }
  };
  const setDragState = (next: typeof drag) => {
    dragRef.current = next;
    setDrag(next);
    onDragChange?.(next !== null);
  };
  const heights = () => exercises.map((e) => cardHeights.current.get(e.id));
  const startDrag = (from: number) => {
    dragY.setValue(0);
    setDragState({ from, over: from, height: cardHeights.current.get(exercises[from].id) ?? 0 });
  };
  const moveDrag = (dy: number) => {
    const cur = dragRef.current;
    if (!cur) return;
    dragY.setValue(dy);
    const over = dropIndexByHeights(cur.from, dy, heights(), GAP);
    if (over !== cur.over) setDragState({ ...cur, over });
  };
  const cancelDrag = () => {
    dragY.setValue(0);
    setDragState(null);
  };
  const endDrag = (dy: number) => {
    const cur = dragRef.current;
    if (!cur) return;
    cancelDrag();
    reorder(cur.from, dropIndexByHeights(cur.from, dy, heights(), GAP));
  };
  /** Cards between the dragged one and its drop slot slide out of its way. */
  const cardShift = (idx: number) => {
    if (!drag || idx === drag.from) return 0;
    const pitch = drag.height + GAP;
    if (drag.from < drag.over && idx > drag.from && idx <= drag.over) return -pitch;
    if (drag.from > drag.over && idx < drag.from && idx >= drag.over) return pitch;
    return 0;
  };

  const addEx = async (e: Exercise) => {
    setPicking(false);
    await act(() => addExerciseToWorkout(db, workout.id, e.id, defaultTargets(e)));
  };

  const progress = { done: exercises.filter(isFinished).length, total: exercises.length };
  const complete = progress.total > 0 && progress.done === progress.total;
  const allSets = exercises.flatMap((e) => e.sets);
  const canReorder = exercises.length > 1;
  const canStart = !workout.isRest && allSets.some((x) => !x.completed);

  const confirmRemoveExercise = (ex: WorkoutExercise) => {
    const remove = () => removeExerciseFromWorkout(db, ex.id);
    const message = ex.categoryKind === 'strength' ? "Its logged sets will be deleted. This can't be undone." : "What you logged will be deleted. This can't be undone.";
    if (ex.hasLoggedSets) setRemoval({ title: `Remove ${ex.exerciseName}?`, message, remove });
    else act(remove);
  };

  return (
    <View style={{ gap: GAP }}>
      <View style={[styles.summary, { backgroundColor: t.card, borderColor: t.border }, raised]}>
        {!workout.isRest && (
          <View accessible accessibilityLabel={`${progress.done} of ${progress.total} exercises done`} style={styles.progress}>
            <Eyebrow>Progress</Eyebrow>
            <View style={styles.progressTop}>
              <Text style={[styles.big, { color: t.text }]}>
                {progress.done}<Text style={{ color: t.muted }}>/{progress.total}</Text>
              </Text>
              <Text style={[styles.progressLabel, { color: complete ? t.success : t.muted }]}>
                {complete ? 'Workout complete' : progress.total ? 'exercises done' : 'No exercises yet'}
              </Text>
            </View>
            <View style={[styles.track, { backgroundColor: t.surface }]}>
              <View style={[styles.fill, { backgroundColor: t.success, experimental_backgroundImage: `linear-gradient(90deg, ${mix(t.success, t.primary, 0.35)}, ${t.success})`, width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }]} />
            </View>
          </View>
        )}
        <View style={[styles.restRow, !workout.isRest && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: t.border, paddingTop: 12 }]}>
          <Icon name={sym('moon.zzz.fill', 'bedtime')} size={16} color={workout.isRest ? t.rest : t.muted} fallback="☾" />
          <Text style={{ color: t.text, fontWeight: '600', flex: 1 }}>Rest day</Text>
          <Toggle label="Rest day" value={workout.isRest} onChange={(v) => act(() => setRestDay(db, date, v))} />
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
      {canStart && (
        <Button
          title={allSets.some((x) => x.isLogged) ? 'Resume workout' : 'Start workout'}
          onPress={() => router.push({ pathname: '/workout/[date]', params: { date } })}
          style={styles.start}
        />
      )}
      {(!workout.isRest || exercises.length > 0) && (
        <>
          {exercises.map((ex, idx) => {
            const exDone = ex.sets.filter((x) => x.completed).length;
            const finished = isFinished(ex);
            const isStrength = ex.categoryKind === 'strength';
            return (
              <Animated.View
                key={ex.id}
                testID={`exercise-${ex.exerciseName}`}
                onLayout={(e) => cardHeights.current.set(ex.id, e.nativeEvent.layout.height)}
                style={[
                  styles.exCard,
                  { backgroundColor: t.card, borderColor: finished ? tint(t.success, 0.5) : t.border },
                  raised,
                  drag?.from === idx
                    ? [styles.dragging, { transform: [{ translateY: dragY }] }]
                    : { transform: [{ translateY: cardShift(idx) }] },
                ]}
              >
                <View style={styles.exHead}>
                  {/* Away from remove. It reaches into the card's padding, so the picture only moves over a little. */}
                  {canReorder && (
                    <View style={styles.handle}>
                      <DragHandle
                        label={`Reorder ${ex.exerciseName}`}
                        onStart={() => startDrag(idx)}
                        onMove={moveDrag}
                        onEnd={endDrag}
                        onCancel={cancelDrag}
                        onMoveUp={() => reorder(idx, idx - 1)}
                        onMoveDown={() => reorder(idx, idx + 1)}
                      />
                    </View>
                  )}
                  <View style={[styles.figure, { backgroundColor: tint(t.primary, 0.1) }]}>
                    {ex.isCustom ? (
                      <Text style={[styles.initial, { color: t.primary }]}>{ex.exerciseName.trim().charAt(0).toUpperCase()}</Text>
                    ) : (
                      <ExerciseMotionFor name={ex.exerciseName} isCustom={ex.isCustom} size={44} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.exName, { color: t.text }]}>{ex.exerciseName}</Text>
                    <Text style={{ color: t.muted, fontSize: 13 }}>
                      {[ex.categoryName, ex.subcategory, ...formatTargets(ex, units)].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  {isStrength && (
                    <View style={[styles.count, { backgroundColor: finished ? tint(t.success, 0.15) : t.surface }]}>
                      <Text style={[styles.countText, { color: finished ? t.success : t.muted }]}>{exDone}/{ex.sets.length}</Text>
                    </View>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Change what ${ex.exerciseName} records`}
                    onPress={() => setChanging(ex)}
                    hitSlop={8}
                    style={({ pressed }) => [styles.trash, { opacity: pressed ? 0.5 : 1 }]}
                  >
                    <Icon name={sym('slider.horizontal.3', 'tune')} size={16} color={t.muted} fallback="⋯" />
                  </Pressable>
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
                    <Text style={{ color: t.muted, fontSize: 12, flexShrink: 1 }}>
                      {`Last (${last[ex.exerciseId]!.date}): ${formatSets(last[ex.exerciseId]!.sets, ex.fields, units)}`}
                    </Text>
                  </View>
                )}
                {isStrength && ex.sets.length > 0 && <SetHeader fields={ex.fields} />}
                {ex.sets.map((x) => (
                  <SetRow
                    key={x.id}
                    kind={ex.categoryKind}
                    fields={ex.fields}
                    set={x}
                    targetDurationMin={ex.targetDurationMin}
                    unit={units.weight}
                    distanceUnit={units.distance}
                    onChange={(patch: SetPatch) => act(() => updateSet(db, x.id, patch))}
                    exerciseName={ex.exerciseName}
                    // A cardio, yoga or mobility entry goes with its exercise; only extras from before can go alone.
                    onRemove={!isStrength && x.setNumber === 1 ? undefined : () => {
                      const remove = () => removeSet(db, x.id);
                      if (x.isLogged) setRemoval({ title: isStrength ? `Remove set ${x.setNumber}?` : `Remove ${ex.exerciseName} ${x.setNumber}?`, message: `This deletes what you logged for ${ex.exerciseName}. This can't be undone.`, remove });
                      else act(remove);
                    }}
                  />
                ))}
                {isStrength && (
                  <AddButton quiet title="Add set" label={`Add set to ${ex.exerciseName}`} onPress={() => act(() => addSet(db, ex.id))} />
                )}
              </Animated.View>
            );
          })}
          {!workout.isRest && <AddButton title="Add exercise" onPress={() => setPicking(true)} />}
          <View style={[styles.notesCard, { backgroundColor: t.card, borderColor: t.border }, raised]}>
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
      {changing && <ChangeRecords exercise={changing} onDone={() => { setChanging(null); reload(); }} />}
      <ExercisePicker visible={picking} onClose={() => setPicking(false)} onPick={addEx} onEdited={reload} onRemoved={reload} />
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
  summary: { borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 14 },
  progress: { gap: 6 },
  progressTop: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  big: { fontSize: 40, fontWeight: '900', fontStyle: 'italic', letterSpacing: -1.5, fontVariant: ['tabular-nums'] },
  progressLabel: { fontSize: 15, fontWeight: '800' },
  track: { height: 12, borderRadius: 6, overflow: 'hidden', marginTop: 4 },
  fill: { height: '100%', borderRadius: 6 },
  restRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  restBox: { alignItems: 'center', gap: 10, padding: 28, borderRadius: 24 },
  exCard: { borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 8 },
  exHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 4 },
  // The handle keeps a 48pt grab area but tucks into the card's padding and the gap before the
  // picture, so it takes about 30pt of the row and its icon sits just clear of the picture.
  handle: { marginVertical: -8, marginLeft: -12, marginRight: -16 },
  dragging: { zIndex: 10, elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  figure: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 22, fontWeight: '800' },
  exName: { fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  count: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  countText: { fontSize: 13, fontWeight: '900', fontVariant: ['tabular-nums'] },
  trash: { padding: 4 },
  last: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  start: { paddingVertical: 18 },
  notesCard: { borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 6 },
  notesHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  notesTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  notes: { minHeight: 48, fontSize: 15, textAlignVertical: 'top', padding: 0 },
});
