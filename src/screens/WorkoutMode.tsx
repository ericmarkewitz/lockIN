import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { DurationButton } from '@/components/DurationButton';
import { ExerciseMedia } from '@/components/ExerciseMedia';
import { Icon, sym } from '@/components/Icon';
import { KeyboardAvoider, keyboardScrollProps } from '@/components/KeyboardAvoider';
import { RestTimer } from '@/components/RestTimer';
import { Button } from '@/components/ui';
import { UnitPill } from '@/components/UnitPill';
import { formTipsFor } from '@/data/formTips';
import { getRestSeconds, type Units } from '@/data/settings';
import type { WorkoutSet } from '@/data/types';
import { loadDay, setWorkoutNotes, shownExercises, updateSet, type SetPatch } from '@/data/workouts';
import { useDb } from '@/db/DbContext';
import { useLoad } from '@/hooks/useLoad';
import { formatDuration } from '@/lib/duration';
import { parseNumber } from '@/lib/numbers';
import {
  fromDisplayDistance, fromDisplayWeight, otherDistanceUnit, otherWeightUnit, toDisplayDistance, toDisplayWeight,
} from '@/lib/units';
import { MAX_REPS } from '@/lib/wheel';
import { firstOpenStep, formatSets, nextOpenStep, suggestEntry, workoutSteps, type Step } from '@/lib/workoutMode';
import { useTheme } from '@/theme';

/** Where workout mode is: a set (by id), the finish screen, or null for "the first set not done". */
type Cursor = number | 'finish' | null;

const WEIGHT_STEP = { lb: 5, kg: 2.5 } as const;
/** When a rest that starts now ends. Kept out of the component: it reads the clock. */
const restUntil = (seconds: number) => Date.now() + seconds * 1000;
const show = (n: number | null) => (n === null ? '' : String(Math.round(n * 100) / 100));

async function load(db: ReturnType<typeof useDb>, date: string) {
  return { ...(await loadDay(db, date)), restSeconds: await getRestSeconds(db) };
}

/**
 * One set at a time: shows the current exercise and set, filled in with what you're expected
 * to lift, and Done logs it and moves on. Nothing about where you are is stored, so it reopens
 * on the first set not done.
 */
export function WorkoutMode({ date }: { date: string }) {
  const db = useDb();
  const t = useTheme();
  const router = useRouter();
  const { data, reload } = useLoad(() => load(db, date), [db, date]);
  const [cursor, setCursor] = useState<Cursor>(null);
  /** A running rest, and the exercise it followed (to say when the next set is a new lift). */
  const [rest, setRest] = useState<{ endsAt: number; afterExerciseId: number } | null>(null);

  const header = (
    <Stack.Screen
      options={{
        title: 'Workout',
        headerLeft: () => (
          <Pressable accessibilityRole="button" accessibilityLabel="End workout" hitSlop={10} onPress={() => router.back()}>
            <Text style={{ color: t.primary, fontSize: 17, fontWeight: '600' }}>End</Text>
          </Pressable>
        ),
      }}
    />
  );
  if (!data) return header;

  const { workout, units, last, restSeconds } = data;
  const steps = workoutSteps(shownExercises(workout));
  const first = firstOpenStep(steps);
  const found = typeof cursor === 'number' ? steps.findIndex((s) => s.set.id === cursor) : -1;
  // A set that's gone (removed elsewhere) falls back to the first open one.
  const index = cursor === 'finish' ? -1 : found !== -1 ? found : first;
  const step = index === -1 ? null : steps[index];

  const goTo = (i: number) => setCursor(i === -1 ? 'finish' : steps[i].set.id);
  const finishStep = async (patch: SetPatch) => {
    const wasDone = steps[index].set.completed;
    const next = nextOpenStep(steps, index);
    await updateSet(db, steps[index].set.id, { ...patch, completed: true });
    await reload();
    setRest(!wasDone && next !== -1 && restSeconds > 0
      ? { endsAt: restUntil(restSeconds), afterExerciseId: steps[index].exercise.id }
      : null);
    goTo(next);
  };
  const move = (i: number) => {
    setRest(null);
    goTo(i);
  };

  const done = steps.filter((s) => s.set.completed).length;
  const exerciseCount = steps.length ? steps[steps.length - 1].exerciseIndex + 1 : 0;

  return (
    <KeyboardAvoider>
      {header}
      <ScrollView
        {...keyboardScrollProps}
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: t.bg }}
        contentContainerStyle={styles.wrap}
      >
        {steps.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.title, { color: t.text }]}>Nothing planned</Text>
            <Text style={{ color: t.muted, textAlign: 'center' }}>Add exercises to this day, then start workout mode.</Text>
            <Button title="Back to the day" variant="secondary" onPress={() => router.back()} />
          </View>
        ) : (
          <>
            <View accessible accessibilityLabel={`${done} of ${steps.length} sets done`} style={[styles.track, { backgroundColor: t.surface }]}>
              <View style={[styles.fill, { backgroundColor: t.success, width: `${(done / steps.length) * 100}%` }]} />
            </View>
            {step ? (
              <>
                <StepView
                  key={step.set.id}
                  step={step}
                  exerciseCount={exerciseCount}
                  units={units}
                  last={last[step.exercise.exerciseId] ?? null}
                  rest={rest && {
                    endsAt: rest.endsAt,
                    newExercise: rest.afterExerciseId !== step.exercise.id,
                    onAdjust: (s) => setRest({ ...rest, endsAt: Math.max(restUntil(0), rest.endsAt + s * 1000) }),
                    onEnd: () => setRest(null),
                  }}
                  onDone={finishStep}
                  onSkip={() => move(nextOpenStep(steps, index))}
                  onPrevious={index > 0 ? () => move(index - 1) : undefined}
                />
                {!rest && (() => {
                  const upcoming = steps.slice(index + 1).find((s) => s.exerciseIndex !== step.exerciseIndex);
                  return upcoming && (
                    <Text style={[styles.next, { color: t.muted }]}>Next: {upcoming.exercise.exerciseName}</Text>
                  );
                })()}
              </>
            ) : (
              <FinishView
                steps={steps}
                notes={workout.notes}
                onNotes={async (text) => { await setWorkoutNotes(db, date, text); await reload(); }}
                onSkipped={first === -1 ? undefined : () => move(first)}
                onFinish={() => router.back()}
              />
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoider>
  );
}

function StepView({
  step, exerciseCount, units, last, rest, onDone, onSkip, onPrevious,
}: {
  step: Step; exerciseCount: number; units: Units; last: { sets: WorkoutSet[] } | null;
  /** While resting, the rest takes the place of the set; the set's entry keeps what's typed. */
  rest: { endsAt: number; newExercise: boolean; onAdjust: (seconds: number) => void; onEnd: () => void } | null;
  onDone: (patch: SetPatch) => void; onSkip: () => void; onPrevious?: () => void;
}) {
  const t = useTheme();
  const { exercise, set, setIndex } = step;
  const isStrength = exercise.categoryKind === 'strength';
  const subject = isStrength ? `set ${set.setNumber}` : exercise.exerciseName;
  const [tips, setTips] = useState(false);
  const formTips = formTipsFor({ name: exercise.exerciseName, isCustom: exercise.isCustom });

  // The entry starts from the suggestion; this view is keyed by set, so it resets each set.
  const [initial] = useState(() => suggestEntry(exercise, setIndex, last, units));
  const [weightUnit, setWeightUnit] = useState(initial.weightUnit);
  const [weight, setWeight] = useState(show(toDisplayWeight(initial.weight, initial.weightUnit)));
  const [reps, setReps] = useState(show(initial.reps));
  const [durationMin, setDurationMin] = useState(initial.durationMin);
  const [distanceUnit, setDistanceUnit] = useState(initial.distanceUnit);
  const [distance, setDistance] = useState(show(toDisplayDistance(initial.distance, initial.distanceUnit)));

  const stepWeight = (dir: 1 | -1) =>
    setWeight(show(Math.max(0, (parseNumber(weight) ?? 0) + dir * WEIGHT_STEP[weightUnit])));
  const stepReps = (dir: 1 | -1) =>
    setReps(show(Math.min(MAX_REPS, Math.max(0, Math.round(parseNumber(reps) ?? 0) + dir))));

  /** "Up next: Set 2 of 3 · 135 lb × 10", naming the exercise when it's a new one. */
  const upNext = (newExercise: boolean) => {
    const w = parseNumber(weight);
    const r = parseNumber(reps);
    const what = isStrength
      ? [`Set ${set.setNumber} of ${exercise.sets.length}`, w !== null && r !== null ? `${show(w)} ${weightUnit} × ${r}` : r !== null ? `${r} reps` : null]
      : [durationMin !== null ? formatDuration(durationMin) : null];
    const parts = [newExercise || !isStrength ? exercise.exerciseName : null, ...what].filter(Boolean);
    return `Up next: ${parts.join(' · ')}`;
  };

  const done = () => {
    // A unit is only stored when it differs from the setting (or already was), as in the day view.
    const keep = <U,>(unit: U, setting: U, stored: U | null) => (unit !== setting || stored !== null ? unit : undefined);
    if (isStrength) {
      const r = parseNumber(reps);
      onDone({
        weight: fromDisplayWeight(parseNumber(weight), weightUnit),
        reps: r === null ? null : Math.round(r),
        weightUnit: keep(weightUnit, units.weight, set.weightUnit),
      });
    } else {
      onDone({
        durationMin,
        ...(exercise.categoryKind === 'cardio' && {
          distance: fromDisplayDistance(parseNumber(distance), distanceUnit),
          distanceUnit: keep(distanceUnit, units.distance, set.distanceUnit),
        }),
      });
    }
  };

  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 2 }}>
        <Text style={[styles.eyebrow, { color: t.muted }]}>Exercise {step.exerciseIndex + 1} of {exerciseCount}</Text>
        <Text style={[styles.title, { color: t.text }]}>{exercise.exerciseName}</Text>
        <Text style={{ color: t.muted }}>
          {exercise.categoryName}
          {exercise.subcategory ? ` · ${exercise.subcategory}` : ''}
        </Text>
      </View>

      <ExerciseMedia name={exercise.exerciseName} isCustom={exercise.isCustom} />

      {formTips && (
        <View style={[styles.tips, { backgroundColor: t.card, borderColor: t.border }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Form tips"
            accessibilityState={{ expanded: tips }}
            onPress={() => setTips(!tips)}
            style={styles.tipsHead}
          >
            <Icon name={sym('lightbulb', 'lightbulb')} size={14} color={t.primary} fallback="💡" />
            <Text style={{ color: t.primary, fontWeight: '700', flex: 1 }}>Form tips</Text>
            <Icon name={tips ? sym('chevron.up', 'expand_less') : sym('chevron.down', 'expand_more')} size={12} color={t.muted} fallback={tips ? '▴' : '▾'} />
          </Pressable>
          {tips && formTips.map((tip) => (
            <View key={tip} style={styles.tip}>
              <Text style={{ color: t.primary }}>•</Text>
              <Text style={{ color: t.text, flex: 1 }}>{tip}</Text>
            </View>
          ))}
        </View>
      )}

      {rest ? (
        <RestTimer
          endsAt={rest.endsAt}
          next={upNext(rest.newExercise)}
          onAdjust={rest.onAdjust}
          onSkip={rest.onEnd}
          onFinish={rest.onEnd}
        />
      ) : (
      <>
      <View style={[styles.entry, { backgroundColor: t.card, borderColor: t.border }]}>
        <View style={styles.entryHead}>
          {isStrength && (
            <Text style={[styles.setLabel, { color: t.text }]}>Set {set.setNumber} of {exercise.sets.length}</Text>
          )}
          {set.completed && (
            <Text style={{ color: t.success, fontWeight: '700' }}>Done</Text>
          )}
        </View>
        {last && last.sets.length > 0 && (
          <Text style={{ color: t.muted, fontSize: 13 }}>Last time: {formatSets(last.sets, exercise.categoryKind, units)}</Text>
        )}
        {isStrength ? (
          <>
            <Stepper
              label="Weight"
              value={weight}
              onChangeText={setWeight}
              less="Less weight"
              more="More weight"
              onStep={stepWeight}
              unit={
                <UnitPill
                  label="Weight unit"
                  unit={weightUnit}
                  // The number stays as typed and now means the other unit, as in the day view.
                  onPress={() => setWeightUnit(otherWeightUnit(weightUnit))}
                />
              }
            />
            <Stepper label="Reps" value={reps} onChangeText={setReps} less="Fewer reps" more="More reps" onStep={stepReps} integer />
          </>
        ) : (
          <>
            <View style={[styles.field, { backgroundColor: t.surface }]}>
              <DurationButton
                label="Duration"
                title={exercise.exerciseName}
                value={durationMin}
                target={exercise.targetDurationMin}
                onChange={setDurationMin}
                style={styles.duration}
              />
            </View>
            {exercise.categoryKind === 'cardio' && (
              <View style={[styles.field, { backgroundColor: t.surface }]}>
                <TextInput
                  accessibilityLabel="Distance"
                  value={distance}
                  onChangeText={setDistance}
                  keyboardType="decimal-pad"
                  placeholder="Distance"
                  placeholderTextColor={t.muted}
                  style={[styles.input, { color: t.text }]}
                />
                <UnitPill label="Distance unit" unit={distanceUnit} onPress={() => setDistanceUnit(otherDistanceUnit(distanceUnit))} />
              </View>
            )}
          </>
        )}
      </View>

      <Button
        title={set.completed ? 'Save' : 'Done'}
        label={`${set.completed ? 'Save' : 'Done with'} ${subject}`}
        onPress={done}
        style={styles.done}
      />
      <View style={styles.row}>
        <Button
          title="‹ Previous"
          label={isStrength ? 'Previous set' : 'Previous'}
          variant="secondary"
          disabled={!onPrevious}
          onPress={() => onPrevious?.()}
          style={{ flex: 1 }}
        />
        <Button title={isStrength ? 'Skip set' : 'Skip'} label={`Skip ${subject}`} variant="secondary" onPress={onSkip} style={{ flex: 1 }} />
      </View>
      </>
      )}
    </View>
  );
}

/** A big number field with − and + on either side, sized for sweaty thumbs. */
function Stepper({
  label, value, onChangeText, less, more, onStep, unit, integer,
}: {
  label: string; value: string; onChangeText: (s: string) => void; less: string; more: string;
  onStep: (dir: 1 | -1) => void; unit?: React.ReactNode; integer?: boolean;
}) {
  const t = useTheme();
  const button = (a11y: string, text: string, dir: 1 | -1) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={() => onStep(dir)}
      style={({ pressed }) => [styles.stepBtn, { backgroundColor: t.card, borderColor: t.border, opacity: pressed ? 0.6 : 1 }]}
    >
      <Text style={[styles.stepText, { color: t.primary }]}>{text}</Text>
    </Pressable>
  );
  return (
    <View style={{ gap: 4 }}>
      <Text style={[styles.fieldLabel, { color: t.muted }]}>{label}</Text>
      <View style={[styles.stepper, { backgroundColor: t.surface }]}>
        {button(less, '−', -1)}
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          keyboardType={integer ? 'number-pad' : 'decimal-pad'}
          selectTextOnFocus
          placeholder="–"
          placeholderTextColor={t.muted}
          style={[styles.bigInput, { color: t.text }]}
        />
        {unit}
        {button(more, '+', 1)}
      </View>
    </View>
  );
}

function FinishView({
  steps, notes, onNotes, onSkipped, onFinish,
}: {
  steps: Step[]; notes: string | null; onNotes: (text: string) => void; onSkipped?: () => void; onFinish: () => void;
}) {
  const t = useTheme();
  const open = steps.filter((s) => !s.set.completed).length;
  const exercises = [...new Map(steps.map((s) => [s.exercise.id, s.exercise])).values()];
  return (
    <View style={{ gap: 14 }}>
      <View style={styles.empty}>
        <Icon
          name={open ? sym('flag.checkered', 'sports_score') : sym('trophy.fill', 'emoji_events')}
          size={36}
          color={open ? t.muted : t.success}
          fallback={open ? '⚑' : '🏆'}
        />
        <Text style={[styles.title, { color: t.text }]}>
          {open ? `${open} ${open === 1 ? 'set' : 'sets'} not done` : 'Workout complete'}
        </Text>
      </View>
      <View style={[styles.entry, { backgroundColor: t.card, borderColor: t.border }]}>
        {exercises.map((e) => {
          const d = e.sets.filter((s) => s.completed).length;
          return (
            <View key={e.id} style={styles.summaryRow}>
              <Text style={{ color: t.text, fontWeight: '600', flex: 1 }}>{e.exerciseName}</Text>
              <Text style={{ color: d === e.sets.length ? t.success : t.muted, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                {d}/{e.sets.length}
              </Text>
            </View>
          );
        })}
      </View>
      {onSkipped && <Button title="Go to skipped sets" variant="secondary" onPress={onSkipped} />}
      <View style={[styles.entry, { backgroundColor: t.card, borderColor: t.border }]}>
        <Text style={[styles.fieldLabel, { color: t.muted }]}>Notes</Text>
        <TextInput
          accessibilityLabel="Workout notes"
          defaultValue={notes ?? ''}
          placeholder="How did it feel?"
          placeholderTextColor={t.muted}
          multiline
          onEndEditing={(e) => onNotes(e.nativeEvent.text)}
          style={[styles.notes, { color: t.text }]}
        />
      </View>
      <Button title="Finish" label="Finish workout" onPress={onFinish} style={styles.done} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 14, paddingBottom: 40 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 24 },
  eyebrow: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  title: { fontSize: 26, fontWeight: '800' },
  next: { textAlign: 'center', fontWeight: '600' },
  tips: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 8 },
  tipsHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tip: { flexDirection: 'row', gap: 8 },
  entry: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 12 },
  entryHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  setLabel: { fontSize: 18, fontWeight: '800' },
  fieldLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, padding: 6, paddingRight: 6 },
  stepBtn: { width: 52, height: 52, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 26, fontWeight: '700' },
  bigInput: { flex: 1, minWidth: 0, textAlign: 'center', fontSize: 32, fontWeight: '800', fontVariant: ['tabular-nums'], paddingVertical: 6 },
  field: { minHeight: 52, flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingRight: 10 },
  duration: { flex: 1, minWidth: 0, backgroundColor: 'transparent' },
  input: { flex: 1, minWidth: 0, paddingHorizontal: 12, paddingVertical: 12, fontSize: 18, fontWeight: '600', textAlign: 'center' },
  done: { paddingVertical: 16, borderRadius: 14 },
  row: { flexDirection: 'row', gap: 8 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notes: { minHeight: 48, fontSize: 15, textAlignVertical: 'top', padding: 0 },
});
