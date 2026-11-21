import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useContext, useState, type ReactNode } from 'react';
import { Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaInsetsContext, type EdgeInsets } from 'react-native-safe-area-context';

import { DurationButton } from '@/components/DurationButton';
import { ExerciseMedia } from '@/components/ExerciseMedia';
import { categoryIcon, Icon, sym, type SymbolName } from '@/components/Icon';
import { KeyboardAvoider } from '@/components/KeyboardAvoider';
import { ExerciseMotionFor } from '@/components/motion/ExerciseMotion';
import { RestTimer } from '@/components/RestTimer';
import { UnitPill } from '@/components/UnitPill';
import { Segmented } from '@/components/ui';
import { findSimilarExercises } from '@/data/exercises';
import { getRestSeconds, type Units } from '@/data/settings';
import type { WorkoutExercise, WorkoutSet } from '@/data/types';
import {
  loadDay, reorderWorkoutExercises, replaceWorkoutExercise, setWorkoutNotes, shownExercises, updateSet, type SetPatch,
} from '@/data/workouts';
import { useDb } from '@/db/DbContext';
import { useLoad } from '@/hooks/useLoad';
import { formatDuration } from '@/lib/duration';
import { parseNumber } from '@/lib/numbers';
import { moveItem } from '@/lib/reorder';
import {
  fromDisplayDistance, fromDisplayWeight, otherDistanceUnit, otherWeightUnit, toDisplayDistance, toDisplayWeight,
} from '@/lib/units';
import { MAX_REPS } from '@/lib/wheel';
import {
  firstOpenStep, formatSets, groupThousands, nextOpenStep, suggestEntry, workoutSteps, workoutVolume, type Step,
} from '@/lib/workoutMode';
import { accentGradient, tint, useTheme } from '@/theme';

const NO_INSETS: EdgeInsets = { top: 0, bottom: 0, left: 0, right: 0 };

/**
 * The device's safe-area insets (status bar, notch, home indicator). Read from the app's
 * provider directly: SafeAreaView inside a full-screen modal can miss the top inset and put
 * the top row under the status bar.
 */
const useInsets = () => useContext(SafeAreaInsetsContext) ?? NO_INSETS;

/** Where workout mode is: a set (by id), the finish screen, or null for "the first set not done". */
/** A set's id, the finish screen, the first open set of an exercise (by its id), or null for the first open set. */
type Cursor = number | 'finish' | { exercise: number } | null;

const WEIGHT_STEP = { lb: 5, kg: 2.5 } as const;
/** When a rest that starts now ends. Kept out of the component: it reads the clock. */
const restUntil = (seconds: number) => Date.now() + seconds * 1000;
const show = (n: number | null) => (n === null ? '' : String(Math.round(n * 100) / 100));

/** A light tap to confirm a logged set. Nothing where the platform has no haptics. */
function tap() {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  } catch {
    // No haptics on this platform.
  }
}

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
  const insets = useInsets();
  const [cursor, setCursor] = useState<Cursor>(null);
  /** A running rest, and the exercise it followed (to say when the next set is a new lift). */
  const [rest, setRest] = useState<{ endsAt: number; afterExerciseId: number } | null>(null);
  const [switching, setSwitching] = useState(false);

  if (!data) return <View style={[styles.screen, { backgroundColor: t.bg }]} />;

  const { workout, units, last, restSeconds } = data;
  const steps = workoutSteps(shownExercises(workout));
  const first = firstOpenStep(steps);
  const found = typeof cursor === 'number' ? steps.findIndex((s) => s.set.id === cursor)
    : cursor && typeof cursor === 'object' ? steps.findIndex((s) => s.exercise.id === cursor.exercise && !s.set.completed)
    : -1;
  // A set that's gone (removed elsewhere) falls back to the first open one.
  const index = cursor === 'finish' ? -1 : found !== -1 ? found : first;
  const step = index === -1 ? null : steps[index];

  const goTo = (i: number) => setCursor(i === -1 ? 'finish' : steps[i].set.id);
  const finishStep = async (patch: SetPatch) => {
    tap();
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

  const exercises = [...new Map(steps.map((s) => [s.exercise.id, s.exercise])).values()];
  const upcoming = step && steps.slice(index + 1).find((s) => s.exerciseIndex !== step.exerciseIndex)?.exercise;
  /** What could be done instead of the current exercise, e.g. when its machine is taken. */
  const alternatives = step ? exercises.filter((e) => e.id !== step.exercise.id && e.sets.some((x) => !x.completed)) : [];

  // Read through `current` with a guard, never `step!`: the React Compiler evaluates a
  // handler's dependencies on every render, and `step` is null on the finish screen.
  const current = step?.exercise ?? null;

  /**
   * Does `picked` now: a later exercise moves into the current one's slot, pushing it back one;
   * an earlier one is already ahead, so it's only jumped to. A running rest keeps going.
   */
  const switchTo = async (picked: WorkoutExercise) => {
    setSwitching(false);
    if (!current) return;
    const ids = workout.exercises.map((e) => e.id);
    const from = ids.indexOf(picked.id);
    const to = ids.indexOf(current.id);
    if (from > to) {
      await reorderWorkoutExercises(db, workout.id, moveItem(ids, from, to));
      await reload();
    }
    setCursor(picked.sets.find((x) => !x.completed)!.id);
  };

  /** Does `exerciseId` instead of the current exercise for its sets not done yet, e.g. when that lift can't be done today. */
  const swapIn = async (exerciseId: number) => {
    setSwitching(false);
    if (!current) return;
    const { id } = await replaceWorkoutExercise(db, current.id, exerciseId);
    await reload();
    setCursor({ exercise: id });
  };

  // The screen has no header: a set is one card from End and the progress at the top to Done at
  // the bottom, and nothing scrolls but the finish screen's summary.
  const top = (
    <TopBar
      steps={steps}
      exercises={exercises}
      current={step?.exercise.id ?? null}
      onEnd={() => router.back()}
    />
  );
  return (
    <KeyboardAvoider scrolls={false}>
      <View style={[styles.screen, { backgroundColor: t.bg }]}>
      {/* The tinted screen is the card, running under the status bar and out to the edges. */}
      <View
        testID="workout-screen"
        style={[
          styles.screen,
          {
            backgroundColor: tint(t.primary, 0.07),
            paddingTop: insets.top + 8,
            paddingBottom: insets.bottom + 8,
            paddingLeft: insets.left + 16,
            paddingRight: insets.right + 16,
          },
        ]}
      >
        {steps.length === 0 ? (
          <View style={[styles.empty, styles.page, { justifyContent: 'center' }]}>
            <Badge icon={sym('calendar.badge.plus', 'event')} fallback="+" color={t.muted} />
            <Text style={[styles.title, { color: t.text }]}>Nothing planned</Text>
            <Text style={{ color: t.muted, textAlign: 'center' }}>Add exercises to this day, then start workout mode.</Text>
            <CTA title="Back to the day" variant="secondary" onPress={() => router.back()} />
          </View>
        ) : (
          <View style={styles.page}>
            {step ? (
              <StepView
                key={step.set.id}
                top={top}
                step={step}
                exerciseCount={exercises.length}
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
                upcoming={upcoming ?? undefined}
                onSwitch={() => setSwitching(true)}
              />
            ) : (
              <>
                {top}
                <FinishView
                  steps={steps}
                  exercises={exercises}
                  units={units}
                  notes={workout.notes}
                  onNotes={async (text) => { await setWorkoutNotes(db, date, text); await reload(); }}
                  onSkipped={first === -1 ? undefined : () => move(first)}
                  onFinish={() => router.back()}
                />
              </>
            )}
          </View>
        )}
      </View>
      </View>
      {switching && step && (
        <SwitchSheet
          current={step.exercise}
          planned={alternatives}
          inDay={workout.exercises.map((e) => e.exerciseId)}
          onPick={switchTo}
          onSwap={swapIn}
          onClose={() => setSwitching(false)}
        />
      )}
    </KeyboardAvoider>
  );
}

type SwitchMode = 'order' | 'swap';

/**
 * Two ways out of the current exercise: do another one still planned now and come back to this
 * one (Change order), or do a different exercise for the same muscles instead (Swap exercise).
 */
function SwitchSheet({
  current, planned, inDay, onPick, onSwap, onClose,
}: {
  current: WorkoutExercise;
  /** The day's other exercises with sets left. */
  planned: WorkoutExercise[];
  /** Every exercise in the day, left out of the swap list. */
  inDay: number[];
  onPick: (e: WorkoutExercise) => void;
  onSwap: (exerciseId: number) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const db = useDb();
  const insets = useInsets();
  const [mode, setMode] = useState<SwitchMode>(planned.length ? 'order' : 'swap');
  const { data: similar } = useLoad(() => findSimilarExercises(db, current.exerciseId, inDay), [db, current.exerciseId]);
  const intro = mode === 'order'
    ? 'Do another now and come back to this one later.'
    : `Replace ${current.exerciseName} with another today.`;
  const row = (key: number, label: string, name: string, isCustom: boolean, detail: string | null, onPress: () => void) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.sheetRow, { backgroundColor: t.surface, opacity: pressed ? 0.6 : 1 }]}
    >
      <Thumb exercise={{ exerciseName: name, isCustom }} size={40} />
      <Text style={{ color: t.text, fontWeight: '700', fontSize: 16, flex: 1 }} numberOfLines={1}>{name}</Text>
      {!!detail && <Text style={{ color: t.muted, fontWeight: '600', fontSize: 13 }}>{detail}</Text>}
    </Pressable>
  );
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetRoot}>
        <Pressable testID="switch-backdrop" accessible={false} onPress={onClose} style={styles.sheetBackdrop} />
        <View style={[styles.sheet, { backgroundColor: t.card, paddingBottom: insets.bottom + 16 }]}>
          <Text style={[styles.sheetTitle, { color: t.text }]}>Switch exercise</Text>
          {planned.length > 0 && (
            <Segmented<SwitchMode>
              options={[{ value: 'order', label: 'Change order' }, { value: 'swap', label: 'Swap exercise' }]}
              value={mode}
              onChange={setMode}
            />
          )}
          <Text style={{ color: t.muted }}>{intro}</Text>
          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
            {mode === 'order'
              ? planned.map((e) => {
                const n = e.sets.filter((x) => !x.completed).length;
                const detail = e.categoryKind === 'strength'
                  ? `${n} ${n === 1 ? 'set' : 'sets'} left`
                  : formatDuration(e.targetDurationMin) || e.categoryName;
                return row(e.id, `Switch to ${e.exerciseName}`, e.exerciseName, e.isCustom, detail, () => onPick(e));
              })
              : similar?.map((e) => row(e.id, `Swap in ${e.name}`, e.name, e.isCustom, e.subcategory, () => onSwap(e.id)))}
            {mode === 'swap' && similar?.length === 0 && (
              <Text style={{ color: t.muted, textAlign: 'center', paddingVertical: 12 }}>No other exercises for these muscles yet.</Text>
            )}
          </ScrollView>
          <CTA title="Keep current exercise" variant="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

/**
 * End, then one capsule per exercise filling as its sets are done (the current one tinted),
 * then the count of sets done.
 */
function TopBar({
  steps, exercises, current, onEnd,
}: { steps: Step[]; exercises: WorkoutExercise[]; current: number | null; onEnd: () => void }) {
  const t = useTheme();
  const done = steps.filter((s) => s.set.completed).length;
  return (
    <View style={styles.topBar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="End workout"
        onPress={onEnd}
        hitSlop={8}
        style={({ pressed }) => [styles.end, { backgroundColor: tint(t.card, 0.55), borderColor: tint(t.text, 0.06), opacity: pressed ? 0.6 : 1 }]}
      >
        <Icon name={sym('xmark', 'close')} size={13} color={t.text} fallback="✕" />
      </Pressable>
      <View accessible accessibilityLabel={`${done} of ${steps.length} sets done`} style={styles.capsules}>
        {exercises.map((e) => {
          const share = e.sets.filter((s) => s.completed).length / e.sets.length;
          const on = e.id === current;
          return (
            <View key={e.id} style={[styles.capsule, { backgroundColor: on ? tint(t.primary, 0.25) : tint(t.text, 0.1) }]}>
              <View style={[styles.capsuleFill, { width: `${share * 100}%`, backgroundColor: share === 1 ? t.success : t.primary }]} />
            </View>
          );
        })}
      </View>
      <Text style={[styles.topCount, { color: t.muted }]} importantForAccessibility="no" accessibilityElementsHidden>
        {done}/{steps.length}
      </Text>
    </View>
  );
}

function StepView({
  step, top, exerciseCount, units, last, rest, onDone, onSkip, onPrevious, upcoming, onSwitch,
}: {
  step: Step;
  /** End and progress, drawn as the top row of the card. */
  top: ReactNode; exerciseCount: number; units: Units; last: { sets: WorkoutSet[] } | null;
  /** While resting, the rest takes the place of the set; the set's entry keeps what's typed. */
  rest: { endsAt: number; newExercise: boolean; onAdjust: (seconds: number) => void; onEnd: () => void } | null;
  onDone: (patch: SetPatch) => void; onSkip: () => void; onPrevious?: () => void;
  /** The next exercise after this one, shown along the bottom of the picture. */
  upcoming?: WorkoutExercise;
  /** Opens the list of other exercises to do now; absent when there are none left. */
  onSwitch?: () => void;
}) {
  const t = useTheme();
  const { exercise, set, setIndex } = step;
  const isStrength = exercise.categoryKind === 'strength';
  const subject = isStrength ? `set ${set.setNumber}` : exercise.exerciseName;

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
    <Animated.View entering={FadeIn.duration(240)} style={styles.fill}>
      {rest ? (
        <View style={styles.hero}>
          {top}
          <View testID="exercise-header" style={styles.compactHead}>
            <Thumb exercise={exercise} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.eyebrow, { color: t.primary }]}>Exercise {step.exerciseIndex + 1} of {exerciseCount}</Text>
              <Text style={[styles.compactTitle, { color: t.text }]} numberOfLines={1}>{exercise.exerciseName}</Text>
            </View>
          </View>
          <View testID="rest-area" style={styles.fill}>
            <RestTimer
              endsAt={rest.endsAt}
              next={upNext(rest.newExercise)}
              onAdjust={rest.onAdjust}
              onSkip={rest.onEnd}
              onFinish={rest.onEnd}
            />
            {onSwitch && <SwitchButton onPress={onSwitch} />}
          </View>
        </View>
      ) : (
        <>
          <Hero
            top={top}
            exercise={exercise}
            label={`Exercise ${step.exerciseIndex + 1} of ${exerciseCount}`}
            upcoming={upcoming}
            onSwitch={onSwitch}
          >
            <View style={styles.entryHead}>
              <Text style={[styles.setLabel, { color: t.text }]}>
                {isStrength ? `Set ${set.setNumber} of ${exercise.sets.length}` : exercise.categoryKind === 'cardio' ? 'Log your session' : 'Log your practice'}
              </Text>
              {set.completed && <Pill icon={sym('checkmark.circle.fill', 'check_circle')} fallback="✓" text="Done" color={t.success} />}
              <View style={{ flex: 1 }} />
              {isStrength && <SetDots sets={exercise.sets} current={setIndex} />}
            </View>
            {last && last.sets.length > 0 && (
              <View style={styles.lastRow}>
                <Icon name={sym('clock.arrow.circlepath', 'history')} size={11} color={t.muted} fallback="↺" />
                <Text style={{ color: t.muted, fontSize: 12, fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>
                  Last time: {formatSets(last.sets, exercise.categoryKind, units)}
                </Text>
              </View>
            )}
            <View style={styles.tiles}>
              {isStrength ? (
                <>
                  <NumberTile
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
                  <NumberTile label="Reps" value={reps} onChangeText={setReps} less="Fewer reps" more="More reps" onStep={stepReps} integer />
                </>
              ) : (
                <>
                  <Tile label="Time">
                    <DurationButton
                      label="Duration"
                      title={exercise.exerciseName}
                      value={durationMin}
                      target={exercise.targetDurationMin}
                      onChange={setDurationMin}
                      style={styles.duration}
                      textStyle={styles.durationText}
                    />
                  </Tile>
                  {exercise.categoryKind === 'cardio' && (
                    <Tile
                      label="Distance"
                      unit={<UnitPill label="Distance unit" unit={distanceUnit} onPress={() => setDistanceUnit(otherDistanceUnit(distanceUnit))} />}
                    >
                      <TextInput
                        accessibilityLabel="Distance"
                        value={distance}
                        onChangeText={setDistance}
                        keyboardType="decimal-pad"
                        selectTextOnFocus
                        placeholder="–"
                        placeholderTextColor={t.muted}
                        style={[styles.tileInput, { color: t.text }]}
                      />
                    </Tile>
                  )}
                </>
              )}
            </View>
            <View style={styles.actions}>
              <RoundAction
                label={isStrength ? 'Previous set' : 'Previous'}
                disabled={!onPrevious}
                onPress={() => onPrevious?.()}
              >
                <Icon name={sym('chevron.left', 'chevron_left')} size={18} color={t.text} fallback="‹" />
              </RoundAction>
              <CTA
                title={set.completed ? 'Save' : 'Done'}
                label={`${set.completed ? 'Save' : 'Done with'} ${subject}`}
                icon={sym('checkmark', 'check')}
                onPress={done}
                style={{ flex: 1 }}
              />
              <RoundAction label={`Skip ${subject}`} onPress={onSkip}>
                <Text style={{ color: t.text, fontWeight: '700', fontSize: 14 }}>Skip</Text>
              </RoundAction>
            </View>
          </Hero>

        </>
      )}
    </Animated.View>
  );
}

/**
 * The exercise card: its name and picture, filling whatever height the screen has left.
 * The figure is sized to the space measured, so a small phone still fits the whole set.
 */
function Hero({
  top, exercise, label, upcoming, onSwitch, children,
}: {
  top?: ReactNode; exercise: WorkoutExercise; label: string; upcoming?: WorkoutExercise; onSwitch?: () => void; children?: ReactNode;
}) {
  const t = useTheme();
  // The figure gets whatever room the name and the set leave; its glow is 1.15× the figure.
  const [room, setRoom] = useState<{ width: number; height: number } | null>(null);
  const size = room ? Math.min(220, room.width / 1.15, room.height / 1.15) : 160;
  const kind = [exercise.categoryName, exercise.subcategory].filter(Boolean).join(' · ');
  return (
    <Animated.View
      entering={FadeInDown.duration(260)}
      style={styles.hero}
    >
      {top}
      <View testID="exercise-header" style={styles.heroTop}>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.heroMeta}>
            <Text style={[styles.eyebrow, { color: t.primary }]}>{label}</Text>
            <Icon name={categoryIcon({ kind: exercise.categoryKind, subcategory: exercise.subcategory })} size={11} color={t.muted} fallback="•" />
            <Text style={[styles.eyebrow, { color: t.muted, flexShrink: 1 }]} numberOfLines={1}>{kind}</Text>
          </View>
          <Text style={[styles.title, { color: t.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {exercise.exerciseName}
          </Text>
        </View>
      </View>
      {/* Tapping the picture puts the number keyboard away; there's nothing else to tap off. */}
      <View testID="exercise-media" style={styles.fill}>
        <Pressable
          testID="exercise-picture"
          accessible={false}
          onPress={Keyboard.dismiss}
          style={styles.heroMedia}
          onLayout={(e) => setRoom(e.nativeEvent.layout)}
        >
          {size >= 48 && <ExerciseMedia name={exercise.exerciseName} isCustom={exercise.isCustom} size={size} />}
        </Pressable>
        {onSwitch && <SwitchButton onPress={onSwitch} />}
      </View>
      {upcoming && <UpNext exercise={upcoming} />}
      {children}
    </Animated.View>
  );
}

/**
 * Floats in the top-right corner of the picture (or the rest timer), in space the figure leaves
 * empty: do another exercise now, e.g. when this one's machine is taken.
 */
function SwitchButton({ onPress }: { onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Switch exercise"
      accessibilityHint="Do another exercise now and come back to this one"
      onPress={onPress}
      // 36 tall to sit lightly on the picture; the slop makes it a full 44 to hit.
      hitSlop={4}
      style={({ pressed }) => [
        styles.switch,
        { backgroundColor: tint(t.card, 0.8), borderColor: tint(t.primary, 0.3), transform: [{ scale: pressed ? 0.95 : 1 }] },
      ]}
    >
      <Icon name={sym('arrow.up.arrow.down', 'swap_vert')} size={14} color={t.primary} fallback="⇅" />
      <Text style={[styles.switchText, { color: t.primary }]}>Switch</Text>
    </Pressable>
  );
}

function Thumb({ exercise, size }: { exercise: Pick<WorkoutExercise, 'exerciseName' | 'isCustom'>; size: number }) {
  const t = useTheme();
  return (
    <View style={[styles.thumb, { width: size, height: size, borderRadius: size * 0.3, backgroundColor: tint(t.primary, 0.1) }]}>
      {exercise.isCustom ? (
        <Text style={{ color: t.primary, fontWeight: '800', fontSize: size * 0.4 }}>{exercise.exerciseName.trim().charAt(0).toUpperCase()}</Text>
      ) : (
        <ExerciseMotionFor name={exercise.exerciseName} isCustom={exercise.isCustom} size={size * 0.78} />
      )}
    </View>
  );
}

/** A round side button beside Done. */
function RoundAction({
  label, onPress, disabled, children,
}: { label: string; onPress: () => void; disabled?: boolean; children: ReactNode }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.roundAction,
        { backgroundColor: tint(t.card, 0.55), borderColor: tint(t.text, 0.06), opacity: disabled ? 0.35 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] },
      ]}
    >
      {children}
    </Pressable>
  );
}

/** A dot per set: done sets fill green, the current one stretches into a bar. */
function SetDots({ sets, current }: { sets: WorkoutSet[]; current: number }) {
  const t = useTheme();
  return (
    <View style={styles.dots} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {sets.map((s, i) => (
        <View
          key={s.id}
          style={[
            styles.dot,
            i === current && styles.dotOn,
            { backgroundColor: i === current ? t.primary : s.completed ? t.success : tint(t.text, 0.15) },
          ]}
        />
      ))}
    </View>
  );
}

/** A see-through panel inside the exercise card, so the card's color shows through. */
function Tile({ label, unit, children }: { label: string; unit?: ReactNode; children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: tint(t.card, 0.55), borderColor: tint(t.text, 0.06) }]}>
      <View style={styles.tileHead}>
        <Text style={[styles.fieldLabel, { color: t.muted }]}>{label}</Text>
        {unit}
      </View>
      {children}
    </View>
  );
}

/** A number in a tile with − and + underneath, sized for sweaty thumbs. */
function NumberTile({
  label, value, onChangeText, less, more, onStep, unit, integer,
}: {
  label: string; value: string; onChangeText: (s: string) => void; less: string; more: string;
  onStep: (dir: 1 | -1) => void; unit?: ReactNode; integer?: boolean;
}) {
  const t = useTheme();
  const button = (a11y: string, icon: SymbolName, fallback: string, dir: 1 | -1) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={() => onStep(dir)}
      hitSlop={4}
      style={({ pressed }) => [
        styles.tileButton,
        { backgroundColor: tint(t.primary, pressed ? 0.24 : 0.12), transform: [{ scale: pressed ? 0.94 : 1 }] },
      ]}
    >
      <Icon name={icon} size={16} color={t.primary} fallback={fallback} />
    </Pressable>
  );
  return (
    <Tile label={label} unit={unit}>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        keyboardType={integer ? 'number-pad' : 'decimal-pad'}
        selectTextOnFocus
        placeholder="–"
        placeholderTextColor={tint(t.muted, 0.5)}
        style={[styles.tileInput, { color: t.text }]}
      />
      <View style={styles.tileButtons}>
        {button(less, sym('minus', 'remove'), '−', -1)}
        {button(more, sym('plus', 'add'), '+', 1)}
      </View>
    </Tile>
  );
}

/** The main action: a tall, raised pill. */
function CTA({
  title, label, icon, onPress, variant = 'primary', style,
}: { title: string; label?: string; icon?: SymbolName; onPress: () => void; variant?: 'primary' | 'secondary'; style?: ViewStyle }) {
  const t = useTheme();
  const primary = variant === 'primary';
  const color = primary ? t.onPrimary : t.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.cta,
        primary
          ? [styles.ctaRaised, { backgroundColor: t.primary, experimental_backgroundImage: accentGradient(t), shadowColor: t.primary }]
          : { backgroundColor: tint(t.primary, 0.12) },
        { transform: [{ scale: pressed ? 0.97 : 1 }] },
        style,
      ]}
    >
      {icon && <Icon name={icon} size={18} color={color} fallback="✓" />}
      <Text style={[styles.ctaText, { color }]}>{title}</Text>
    </Pressable>
  );
}

function Pill({ icon, fallback, text, color }: { icon: SymbolName; fallback: string; text: string; color: string }) {
  const t = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: t.surface }]}>
      <Icon name={icon} size={12} color={color} fallback={fallback} />
      <Text style={{ color, fontSize: 13, fontWeight: '600', flexShrink: 1 }}>{text}</Text>
    </View>
  );
}

function Badge({ icon, fallback, color, size = 72 }: { icon: SymbolName; fallback: string; color: string; size?: number }) {
  return (
    <View style={[styles.badgeOuter, { width: size * 1.6, height: size * 1.6, borderRadius: size, backgroundColor: tint(color, 0.08) }]}>
      <View style={[styles.badgeInner, { width: size, height: size, borderRadius: size / 2, backgroundColor: tint(color, 0.16) }]}>
        <Icon name={icon} size={size * 0.45} color={color} fallback={fallback} />
      </View>
    </View>
  );
}

/** A line along the bottom of the picture naming what comes after this exercise. */
function UpNext({ exercise }: { exercise: WorkoutExercise }) {
  const t = useTheme();
  const detail = exercise.categoryKind === 'strength'
    ? `${exercise.sets.length} ${exercise.sets.length === 1 ? 'set' : 'sets'}${exercise.targetReps ? ` × ${exercise.targetReps}` : ''}`
    : formatDuration(exercise.targetDurationMin) || exercise.categoryName;
  return (
    <View accessible accessibilityLabel={`Next: ${exercise.exerciseName}`} style={[styles.upNext, { backgroundColor: tint(t.card, 0.55), borderColor: tint(t.text, 0.06) }]}>
      <Thumb exercise={exercise} size={32} />
      <Text style={[styles.eyebrow, { color: t.muted }]}>Next</Text>
      <Text style={{ color: t.text, fontWeight: '700', flex: 1 }} numberOfLines={1}>{exercise.exerciseName}</Text>
      <Text style={{ color: t.muted, fontWeight: '600', fontSize: 13 }}>{detail}</Text>
    </View>
  );
}

function FinishView({
  steps, exercises, units, notes, onNotes, onSkipped, onFinish,
}: {
  steps: Step[]; exercises: WorkoutExercise[]; units: Units; notes: string | null;
  onNotes: (text: string) => void; onSkipped?: () => void; onFinish: () => void;
}) {
  const t = useTheme();
  const glass = { bg: tint(t.card, 0.55), border: tint(t.text, 0.06) };
  const done = steps.filter((s) => s.set.completed).length;
  const open = steps.length - done;
  const lifts = exercises.some((e) => e.categoryKind === 'strength');
  const stats = [
    { label: 'Sets', value: `${done}/${steps.length}` },
    ...(lifts ? [{ label: `Volume (${units.weight})`, value: groupThousands(workoutVolume(steps, units.weight)) }] : []),
    { label: exercises.length === 1 ? 'Exercise' : 'Exercises', value: String(exercises.length) },
  ];
  return (
    <Animated.View entering={FadeInDown.duration(300)} style={styles.fill}>
      <ScrollView style={styles.fill} contentContainerStyle={{ gap: 16, paddingBottom: 4 }} keyboardShouldPersistTaps="handled">
        <View style={styles.empty}>
          <Badge
            icon={open ? sym('flag.checkered', 'sports_score') : sym('trophy.fill', 'emoji_events')}
            fallback={open ? '⚑' : '🏆'}
            color={open ? t.warn : t.success}
          />
          <Text style={[styles.title, { color: t.text, textAlign: 'center' }]}>
            {open ? `${open} ${open === 1 ? 'set' : 'sets'} not done` : 'Workout complete'}
          </Text>
          <Text style={{ color: t.muted, textAlign: 'center' }}>
            {open ? 'Go back for them now, or finish and log them later.' : 'Every set logged. Nice work.'}
          </Text>
        </View>
        <View style={styles.stats}>
          {stats.map((s) => (
            <View key={s.label} accessible accessibilityLabel={`${s.label}: ${s.value}`} style={[styles.stat, { backgroundColor: glass.bg, borderColor: glass.border }]}>
              <Text style={[styles.statValue, { color: t.text }]} numberOfLines={1} adjustsFontSizeToFit>{s.value}</Text>
              <Text style={[styles.statLabel, { color: t.muted }]}>{s.label}</Text>
            </View>
          ))}
        </View>
        <View style={[styles.card, { backgroundColor: glass.bg, borderColor: glass.border, paddingVertical: 6 }]}>
          {exercises.map((e, i) => {
            const d = e.sets.filter((s) => s.completed).length;
            const all = d === e.sets.length;
            return (
              <View key={e.id} style={[styles.summaryRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: t.border }]}>
                <View style={[styles.thumbSmall, { backgroundColor: tint(t.primary, 0.08) }]}>
                  {e.isCustom ? (
                    <Text style={{ color: t.primary, fontWeight: '800' }}>{e.exerciseName.trim().charAt(0).toUpperCase()}</Text>
                  ) : (
                    <ExerciseMotionFor name={e.exerciseName} isCustom={e.isCustom} size={28} />
                  )}
                </View>
                <Text style={{ color: t.text, fontWeight: '600', flex: 1 }}>{e.exerciseName}</Text>
                <View style={[styles.count, { backgroundColor: all ? tint(t.success, 0.15) : t.surface }]}>
                  <Text style={{ color: all ? t.success : t.muted, fontWeight: '800', fontSize: 12, fontVariant: ['tabular-nums'] }}>
                    {d}/{e.sets.length}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
        <View style={[styles.card, { backgroundColor: glass.bg, borderColor: glass.border, gap: 8 }]}>
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
      </ScrollView>
      <View style={{ gap: 10 }}>
        {onSkipped && <CTA title="Go to skipped sets" variant="secondary" icon={sym('arrow.uturn.backward', 'undo')} onPress={onSkipped} />}
        <CTA title="Finish" label="Finish workout" icon={sym('checkmark', 'check')} onPress={onFinish} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { flex: 1, gap: 12 },
  fill: { flex: 1, minHeight: 0, gap: 12 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 20 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 6, maxHeight: '80%' },
  sheetTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.3 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 16, minHeight: 56 },
  end: { width: 32, height: 32, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  capsules: { flex: 1, flexDirection: 'row', gap: 4 },
  topCount: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'], minWidth: 30, textAlign: 'right' },
  capsule: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  capsuleFill: { height: '100%', borderRadius: 3 },
  hero: { flex: 1, minHeight: 0, gap: 10 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  switch: {
    position: 'absolute', top: 6, right: 6, flexDirection: 'row', alignItems: 'center', gap: 5,
    minHeight: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth,
  },
  switchText: { fontSize: 14, fontWeight: '800' },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroMedia: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center' },
  compactHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  compactTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  eyebrow: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2 },
  title: { fontSize: 30, fontWeight: '900', fontStyle: 'italic', letterSpacing: -1 },
  card: { borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  entryHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  setLabel: { fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOn: { width: 22 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, maxWidth: '100%' },
  fieldLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2 },
  duration: { minHeight: 44, backgroundColor: 'transparent' },
  // Matches the big numbers in the other tiles.
  durationText: { fontSize: 34, fontWeight: '900', letterSpacing: -1.5 },
  lastRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: -4, paddingHorizontal: 4 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, minWidth: 0, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 10, gap: 4 },
  tileHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 20 },
  tileInput: {
    textAlign: 'center', fontSize: 38, fontWeight: '900', letterSpacing: -1.5, fontVariant: ['tabular-nums'], paddingVertical: 0, minHeight: 44,
  },
  tileButtons: { flexDirection: 'row', gap: 6 },
  tileButton: { flex: 1, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cta: { height: 60, borderRadius: 30, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  ctaRaised: { shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  ctaText: { fontSize: 19, fontWeight: '900', letterSpacing: -0.2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  roundAction: { width: 60, height: 60, borderRadius: 30, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  upNext: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 6, paddingHorizontal: 8 },
  thumb: { alignItems: 'center', justifyContent: 'center' },
  thumbSmall: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  badgeOuter: { alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  badgeInner: { alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 14, paddingHorizontal: 10, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 28, fontWeight: '900', fontStyle: 'italic', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  count: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  notes: { minHeight: 56, fontSize: 15, textAlignVertical: 'top', padding: 0 },
});
