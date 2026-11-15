import * as Haptics from 'expo-haptics';
import { Stack, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { DurationButton } from '@/components/DurationButton';
import { ExerciseMedia } from '@/components/ExerciseMedia';
import { categoryIcon, Icon, sym, type SymbolName } from '@/components/Icon';
import { KeyboardAvoider, keyboardScrollProps } from '@/components/KeyboardAvoider';
import { ExerciseMotionFor } from '@/components/motion/ExerciseMotion';
import { RestTimer } from '@/components/RestTimer';
import { UnitPill } from '@/components/UnitPill';
import { formTipsFor } from '@/data/formTips';
import { getRestSeconds, type Units } from '@/data/settings';
import type { WorkoutExercise, WorkoutSet } from '@/data/types';
import { loadDay, setWorkoutNotes, shownExercises, updateSet, type SetPatch } from '@/data/workouts';
import { useDb } from '@/db/DbContext';
import { useLoad } from '@/hooks/useLoad';
import { formatDuration } from '@/lib/duration';
import { parseNumber } from '@/lib/numbers';
import {
  fromDisplayDistance, fromDisplayWeight, otherDistanceUnit, otherWeightUnit, toDisplayDistance, toDisplayWeight,
} from '@/lib/units';
import { MAX_REPS } from '@/lib/wheel';
import {
  firstOpenStep, formatSets, groupThousands, nextOpenStep, suggestEntry, workoutSteps, workoutVolume, type Step,
} from '@/lib/workoutMode';
import { tint, useTheme } from '@/theme';

/** Where workout mode is: a set (by id), the finish screen, or null for "the first set not done". */
type Cursor = number | 'finish' | null;

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
            <Badge icon={sym('calendar.badge.plus', 'event')} fallback="+" color={t.muted} />
            <Text style={[styles.title, { color: t.text }]}>Nothing planned</Text>
            <Text style={{ color: t.muted, textAlign: 'center' }}>Add exercises to this day, then start workout mode.</Text>
            <CTA title="Back to the day" variant="secondary" onPress={() => router.back()} />
          </View>
        ) : (
          <>
            <Progress steps={steps} exercises={exercises} current={step?.exercise.id ?? null} />
            {step ? (
              <>
                <StepView
                  key={step.set.id}
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
                />
                {!rest && upcoming && <UpNext exercise={upcoming} />}
              </>
            ) : (
              <FinishView
                steps={steps}
                exercises={exercises}
                units={units}
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

/** One capsule per exercise, filling as its sets are done; the current one is ringed. */
function Progress({ steps, exercises, current }: { steps: Step[]; exercises: WorkoutExercise[]; current: number | null }) {
  const t = useTheme();
  const done = steps.filter((s) => s.set.completed).length;
  return (
    <View style={{ gap: 8 }}>
      <View accessible accessibilityLabel={`${done} of ${steps.length} sets done`} style={styles.capsules}>
        {exercises.map((e) => {
          const share = e.sets.filter((s) => s.completed).length / e.sets.length;
          const on = e.id === current;
          return (
            <View key={e.id} style={[styles.capsule, { backgroundColor: on ? tint(t.primary, 0.18) : t.surface }]}>
              <View style={[styles.capsuleFill, { width: `${share * 100}%`, backgroundColor: share === 1 ? t.success : t.primary }]} />
            </View>
          );
        })}
      </View>
    </View>
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
    <Animated.View entering={FadeIn.duration(240)} style={{ gap: 16 }}>
      <View style={[styles.hero, { backgroundColor: tint(t.primary, 0.07), borderColor: tint(t.primary, 0.12) }]}>
        <View style={styles.heroTop}>
          <View style={[styles.chip, { backgroundColor: t.card }]}>
            <Icon name={categoryIcon({ name: exercise.categoryName, kind: exercise.categoryKind })} size={12} color={t.primary} fallback="•" />
            <Text style={[styles.chipText, { color: t.text }]}>
              {exercise.categoryName}
              {exercise.subcategory ? ` · ${exercise.subcategory}` : ''}
            </Text>
          </View>
          <Text style={[styles.eyebrow, { color: t.primary }]}>Exercise {step.exerciseIndex + 1} of {exerciseCount}</Text>
        </View>
        <ExerciseMedia name={exercise.exerciseName} isCustom={exercise.isCustom} size={176} />
      </View>

      <View style={{ gap: 10 }}>
        <Text style={[styles.title, { color: t.text }]}>{exercise.exerciseName}</Text>
        {formTips && (
          <View style={{ gap: 10 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Form tips"
              accessibilityState={{ expanded: tips }}
              onPress={() => setTips(!tips)}
              style={({ pressed }) => [
                styles.tipsToggle,
                { backgroundColor: tips ? tint(t.primary, 0.14) : t.card, borderColor: tips ? 'transparent' : t.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Icon name={sym('lightbulb.fill', 'lightbulb')} size={13} color={t.primary} fallback="💡" />
              <Text style={{ color: t.primary, fontWeight: '700', fontSize: 14 }}>Form tips</Text>
              <Icon name={tips ? sym('chevron.up', 'expand_less') : sym('chevron.down', 'expand_more')} size={11} color={t.primary} fallback={tips ? '▴' : '▾'} />
            </Pressable>
            {tips && (
              <Animated.View entering={FadeInDown.duration(200)} style={[styles.card, { backgroundColor: t.card, borderColor: t.border, gap: 12 }]}>
                {formTips.map((tip, i) => (
                  <View key={tip} style={styles.tip}>
                    <View style={[styles.tipNum, { backgroundColor: tint(t.primary, 0.14) }]}>
                      <Text style={[styles.tipNumText, { color: t.primary }]}>{i + 1}</Text>
                    </View>
                    <Text style={[styles.tipText, { color: t.text }]}>{tip}</Text>
                  </View>
                ))}
              </Animated.View>
            )}
          </View>
        )}
      </View>

      {rest ? (
        <RestTimer
          endsAt={rest.endsAt}
          next={upNext(rest.newExercise)}
          onAdjust={rest.onAdjust}
          onSkip={rest.onEnd}
          onFinish={rest.onEnd}
        />
      ) : (
        <Animated.View entering={FadeInDown.duration(260)} style={{ gap: 14 }}>
          <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border, gap: 16 }]}>
            <View style={styles.entryHead}>
              {isStrength ? (
                <>
                  <Text style={[styles.setLabel, { color: t.text }]}>Set {set.setNumber} of {exercise.sets.length}</Text>
                  <SetDots sets={exercise.sets} current={setIndex} />
                </>
              ) : (
                <Text style={[styles.setLabel, { color: t.text }]}>{exercise.categoryKind === 'cardio' ? 'Log your session' : 'Log your practice'}</Text>
              )}
            </View>
            {(set.completed || (last && last.sets.length > 0)) && (
              <View style={styles.metaRow}>
                {set.completed && <Pill icon={sym('checkmark.circle.fill', 'check_circle')} fallback="✓" text="Done" color={t.success} />}
                {last && last.sets.length > 0 && (
                  <Pill icon={sym('clock.arrow.circlepath', 'history')} fallback="↺" text={`Last time: ${formatSets(last.sets, exercise.categoryKind, units)}`} color={t.muted} />
                )}
              </View>
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
                <View style={[styles.divider, { backgroundColor: t.border }]} />
                <Stepper label="Reps" value={reps} onChangeText={setReps} less="Fewer reps" more="More reps" onStep={stepReps} integer />
              </>
            ) : (
              <>
                <View style={{ gap: 6 }}>
                  <Text style={[styles.fieldLabel, { color: t.muted }]}>Time</Text>
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
                </View>
                {exercise.categoryKind === 'cardio' && (
                  <View style={{ gap: 6 }}>
                    <Text style={[styles.fieldLabel, { color: t.muted }]}>Distance</Text>
                    <View style={[styles.field, { backgroundColor: t.surface }]}>
                      <TextInput
                        accessibilityLabel="Distance"
                        value={distance}
                        onChangeText={setDistance}
                        keyboardType="decimal-pad"
                        selectTextOnFocus
                        placeholder="–"
                        placeholderTextColor={t.muted}
                        style={[styles.input, { color: t.text }]}
                      />
                      <UnitPill label="Distance unit" unit={distanceUnit} onPress={() => setDistanceUnit(otherDistanceUnit(distanceUnit))} />
                    </View>
                  </View>
                )}
              </>
            )}
          </View>

          <CTA
            title={set.completed ? 'Save' : 'Done'}
            label={`${set.completed ? 'Save' : 'Done with'} ${subject}`}
            icon={sym('checkmark', 'check')}
            onPress={done}
          />
          <View style={styles.row}>
            <Ghost
              title="Previous"
              label={isStrength ? 'Previous set' : 'Previous'}
              icon={sym('chevron.left', 'chevron_left')}
              fallback="‹"
              disabled={!onPrevious}
              onPress={() => onPrevious?.()}
            />
            <Ghost
              title={isStrength ? 'Skip set' : 'Skip'}
              label={`Skip ${subject}`}
              icon={sym('chevron.right', 'chevron_right')}
              fallback="›"
              trailing
              onPress={onSkip}
            />
          </View>
        </Animated.View>
      )}
    </Animated.View>
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
            { backgroundColor: i === current ? t.primary : s.completed ? t.success : t.surface },
          ]}
        />
      ))}
    </View>
  );
}

/** A big number with round − and + either side, sized for sweaty thumbs. */
function Stepper({
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
        styles.round,
        { backgroundColor: pressed ? tint(t.primary, 0.2) : t.surface, transform: [{ scale: pressed ? 0.92 : 1 }] },
      ]}
    >
      <Icon name={icon} size={20} color={t.text} fallback={fallback} />
    </Pressable>
  );
  return (
    <View style={{ gap: 4 }}>
      <View style={styles.stepperHead}>
        <Text style={[styles.fieldLabel, { color: t.muted }]}>{label}</Text>
        {unit}
      </View>
      <View style={styles.stepper}>
        {button(less, sym('minus', 'remove'), '−', -1)}
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          keyboardType={integer ? 'number-pad' : 'decimal-pad'}
          selectTextOnFocus
          placeholder="0"
          placeholderTextColor={tint(t.muted, 0.5)}
          style={[styles.bigInput, { color: t.text }]}
        />
        {button(more, sym('plus', 'add'), '+', 1)}
      </View>
    </View>
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
          ? [styles.ctaRaised, { backgroundColor: t.primary, shadowColor: t.primary }]
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

/** A quiet text action with a chevron. */
function Ghost({
  title, label, icon, fallback, onPress, disabled, trailing,
}: { title: string; label: string; icon: SymbolName; fallback: string; onPress: () => void; disabled?: boolean; trailing?: boolean }) {
  const t = useTheme();
  const chevron = <Icon name={icon} size={13} color={t.muted} fallback={fallback} />;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.ghost, { opacity: disabled ? 0.35 : pressed ? 0.6 : 1 }]}
    >
      {!trailing && chevron}
      <Text style={{ color: t.muted, fontWeight: '700', fontSize: 15 }}>{title}</Text>
      {trailing && chevron}
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

/** What comes after this exercise, with its figure. */
function UpNext({ exercise }: { exercise: WorkoutExercise }) {
  const t = useTheme();
  const detail = exercise.categoryKind === 'strength'
    ? `${exercise.sets.length} ${exercise.sets.length === 1 ? 'set' : 'sets'}${exercise.targetReps ? ` × ${exercise.targetReps}` : ''}`
    : formatDuration(exercise.targetDurationMin) || exercise.categoryName;
  return (
    <View accessible accessibilityLabel={`Next: ${exercise.exerciseName}`} style={[styles.card, styles.upNext, { backgroundColor: t.card, borderColor: t.border }]}>
      <View style={[styles.thumb, { backgroundColor: tint(t.primary, 0.08) }]}>
        {exercise.isCustom ? (
          <Text style={{ color: t.primary, fontWeight: '800', fontSize: 18 }}>{exercise.exerciseName.trim().charAt(0).toUpperCase()}</Text>
        ) : (
          <ExerciseMotionFor name={exercise.exerciseName} isCustom={exercise.isCustom} size={36} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.eyebrow, { color: t.muted }]}>Up next</Text>
        <Text style={{ color: t.text, fontWeight: '700', fontSize: 16 }}>{exercise.exerciseName}</Text>
      </View>
      <Text style={{ color: t.muted, fontWeight: '600' }}>{detail}</Text>
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
  const done = steps.filter((s) => s.set.completed).length;
  const open = steps.length - done;
  const lifts = exercises.some((e) => e.categoryKind === 'strength');
  const stats = [
    { label: 'Sets', value: `${done}/${steps.length}` },
    ...(lifts ? [{ label: `Volume (${units.weight})`, value: groupThousands(workoutVolume(steps, units.weight)) }] : []),
    { label: exercises.length === 1 ? 'Exercise' : 'Exercises', value: String(exercises.length) },
  ];
  return (
    <Animated.View entering={FadeInDown.duration(300)} style={{ gap: 16 }}>
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
          <View key={s.label} accessible accessibilityLabel={`${s.label}: ${s.value}`} style={[styles.stat, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text style={[styles.statValue, { color: t.text }]} numberOfLines={1} adjustsFontSizeToFit>{s.value}</Text>
            <Text style={[styles.statLabel, { color: t.muted }]}>{s.label}</Text>
          </View>
        ))}
      </View>
      <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border, paddingVertical: 6 }]}>
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
      {onSkipped && <CTA title="Go to skipped sets" variant="secondary" icon={sym('arrow.uturn.backward', 'undo')} onPress={onSkipped} />}
      <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border, gap: 8 }]}>
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
      <CTA title="Finish" label="Finish workout" icon={sym('checkmark', 'check')} onPress={onFinish} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 16, paddingBottom: 48 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 20 },
  capsules: { flexDirection: 'row', gap: 4 },
  capsule: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  capsuleFill: { height: '100%', borderRadius: 3 },
  hero: { borderRadius: 28, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 14, zIndex: 1 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  chipText: { fontSize: 12, fontWeight: '700' },
  eyebrow: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  tipsToggle: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth,
  },
  tip: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  tipNum: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  tipNumText: { fontSize: 12, fontWeight: '800' },
  tipText: { flex: 1, fontSize: 15, lineHeight: 21 },
  card: { borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  entryHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  setLabel: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOn: { width: 22 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -4 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, maxWidth: '100%' },
  fieldLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2 },
  stepperHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 22 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  round: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  bigInput: {
    flex: 1, minWidth: 0, textAlign: 'center', fontSize: 52, fontWeight: '800', letterSpacing: -1.5,
    fontVariant: ['tabular-nums'], paddingVertical: 2,
  },
  divider: { height: StyleSheet.hairlineWidth },
  field: { minHeight: 56, flexDirection: 'row', alignItems: 'center', borderRadius: 16, paddingRight: 12 },
  duration: { flex: 1, minWidth: 0, backgroundColor: 'transparent' },
  input: { flex: 1, minWidth: 0, paddingHorizontal: 12, paddingVertical: 12, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  cta: { height: 60, borderRadius: 30, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  ctaRaised: { shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  ctaText: { fontSize: 18, fontWeight: '800', letterSpacing: -0.2 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  ghost: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 6 },
  upNext: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  thumb: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  thumbSmall: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  badgeOuter: { alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  badgeInner: { alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 14, paddingHorizontal: 10, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  count: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  notes: { minHeight: 56, fontSize: 15, textAlignVertical: 'top', padding: 0 },
});
