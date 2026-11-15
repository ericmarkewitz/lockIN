import * as Haptics from 'expo-haptics';
import { Stack, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DurationButton } from '@/components/DurationButton';
import { ExerciseMedia } from '@/components/ExerciseMedia';
import { categoryIcon, Icon, sym, type SymbolName } from '@/components/Icon';
import { KeyboardAvoider } from '@/components/KeyboardAvoider';
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

  // Everything fits on one screen with Done pinned at the bottom: nothing here scrolls but the
  // finish screen's summary.
  return (
    <KeyboardAvoider scrolls={false}>
      {header}
      <SafeAreaView edges={['bottom']} style={[styles.screen, { backgroundColor: t.bg }]}>
        {steps.length === 0 ? (
          <View style={[styles.empty, styles.page, { justifyContent: 'center' }]}>
            <Badge icon={sym('calendar.badge.plus', 'event')} fallback="+" color={t.muted} />
            <Text style={[styles.title, { color: t.text }]}>Nothing planned</Text>
            <Text style={{ color: t.muted, textAlign: 'center' }}>Add exercises to this day, then start workout mode.</Text>
            <CTA title="Back to the day" variant="secondary" onPress={() => router.back()} />
          </View>
        ) : (
          <View style={styles.page}>
            <Progress steps={steps} exercises={exercises} current={step?.exercise.id ?? null} />
            {step ? (
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
                upcoming={upcoming ?? undefined}
              />
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
          </View>
        )}
      </SafeAreaView>
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
  step, exerciseCount, units, last, rest, onDone, onSkip, onPrevious, upcoming,
}: {
  step: Step; exerciseCount: number; units: Units; last: { sets: WorkoutSet[] } | null;
  /** While resting, the rest takes the place of the set; the set's entry keeps what's typed. */
  rest: { endsAt: number; newExercise: boolean; onAdjust: (seconds: number) => void; onEnd: () => void } | null;
  onDone: (patch: SetPatch) => void; onSkip: () => void; onPrevious?: () => void;
  /** The next exercise after this one, shown along the bottom of the picture. */
  upcoming?: WorkoutExercise;
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

  const tipsButton = formTips && (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Form tips"
      accessibilityState={{ expanded: tips }}
      onPress={() => setTips(true)}
      hitSlop={6}
      style={({ pressed }) => [styles.tipsToggle, { backgroundColor: tint(t.primary, 0.12), opacity: pressed ? 0.7 : 1 }]}
    >
      <Icon name={sym('lightbulb.fill', 'lightbulb')} size={13} color={t.primary} fallback="💡" />
      <Text style={{ color: t.primary, fontWeight: '700', fontSize: 14 }}>Tips</Text>
    </Pressable>
  );

  return (
    <Animated.View entering={FadeIn.duration(240)} style={styles.fill}>
      {rest ? (
        <>
          <View style={styles.compactHead}>
            <Thumb exercise={exercise} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.eyebrow, { color: t.primary }]}>Exercise {step.exerciseIndex + 1} of {exerciseCount}</Text>
              <Text style={[styles.compactTitle, { color: t.text }]} numberOfLines={1}>{exercise.exerciseName}</Text>
            </View>
            {tipsButton}
          </View>
          <RestTimer
            endsAt={rest.endsAt}
            next={upNext(rest.newExercise)}
            onAdjust={rest.onAdjust}
            onSkip={rest.onEnd}
            onFinish={rest.onEnd}
          />
        </>
      ) : (
        <>
          <Hero exercise={exercise} label={`Exercise ${step.exerciseIndex + 1} of ${exerciseCount}`} upcoming={upcoming} />
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: t.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {exercise.exerciseName}
            </Text>
            {tipsButton}
          </View>

          <Animated.View entering={FadeInDown.duration(260)} style={[styles.card, { backgroundColor: t.card, borderColor: t.border, gap: 12 }]}>
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
                <View style={[styles.field, { backgroundColor: t.surface }]}>
                  <Text style={[styles.fieldLabel, styles.inlineLabel, { color: t.muted }]}>Time</Text>
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
                    <Text style={[styles.fieldLabel, styles.inlineLabel, { color: t.muted }]}>Distance</Text>
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
                )}
              </>
            )}
          </Animated.View>

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
        </>
      )}
      {formTips && <FormTipsSheet visible={tips} name={exercise.exerciseName} tips={formTips} onClose={() => setTips(false)} />}
    </Animated.View>
  );
}

/**
 * The exercise's picture, filling whatever height the screen has left. The figure is sized to
 * the space measured, so a small phone still fits the whole set on one screen.
 */
function Hero({ exercise, label, upcoming }: { exercise: WorkoutExercise; label: string; upcoming?: WorkoutExercise }) {
  const t = useTheme();
  const [height, setHeight] = useState(0);
  // Leaves room for the chip row and the up-next line; the glow is 1.15× the figure.
  const size = height ? Math.min(220, (height - (upcoming ? 96 : 52)) / 1.15) : 160;
  return (
    <View
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
      style={[styles.hero, { backgroundColor: tint(t.primary, 0.07), borderColor: tint(t.primary, 0.12) }]}
    >
      <View style={styles.heroTop}>
        <View style={[styles.chip, { backgroundColor: t.card }]}>
          <Icon name={categoryIcon({ name: exercise.categoryName, kind: exercise.categoryKind })} size={12} color={t.primary} fallback="•" />
          <Text style={[styles.chipText, { color: t.text }]} numberOfLines={1}>
            {exercise.categoryName}
            {exercise.subcategory ? ` · ${exercise.subcategory}` : ''}
          </Text>
        </View>
        <Text style={[styles.eyebrow, { color: t.primary }]}>{label}</Text>
      </View>
      <View style={styles.heroMedia}>
        {size >= 48 && <ExerciseMedia name={exercise.exerciseName} isCustom={exercise.isCustom} size={size} />}
      </View>
      {upcoming && <UpNext exercise={upcoming} />}
    </View>
  );
}

function Thumb({ exercise, size }: { exercise: WorkoutExercise; size: number }) {
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
        { backgroundColor: t.card, borderColor: t.border, opacity: disabled ? 0.35 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] },
      ]}
    >
      {children}
    </Pressable>
  );
}

/** Form tips in a sheet over the screen, so opening them never pushes Done off it. */
function FormTipsSheet({
  visible, name, tips, onClose,
}: { visible: boolean; name: string; tips: readonly string[]; onClose: () => void }) {
  const t = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetRoot}>
        <Pressable testID="tips-backdrop" accessible={false} onPress={onClose} style={styles.backdrop} />
        <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: t.card }]}>
          <View style={[styles.grabber, { backgroundColor: t.border }]} />
          <View style={{ gap: 2 }}>
            <Text style={[styles.eyebrow, { color: t.primary }]}>Form tips</Text>
            <Text style={[styles.compactTitle, { color: t.text }]}>{name}</Text>
          </View>
          <View style={{ gap: 14 }}>
            {tips.map((tip, i) => (
              <View key={tip} style={styles.tip}>
                <View style={[styles.tipNum, { backgroundColor: tint(t.primary, 0.14) }]}>
                  <Text style={[styles.tipNumText, { color: t.primary }]}>{i + 1}</Text>
                </View>
                <Text style={[styles.tipText, { color: t.text }]}>{tip}</Text>
              </View>
            ))}
          </View>
          <CTA title="Got it" label="Close form tips" variant="secondary" onPress={onClose} />
        </SafeAreaView>
      </View>
    </Modal>
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
    <View accessible accessibilityLabel={`Next: ${exercise.exerciseName}`} style={[styles.upNext, { backgroundColor: t.card }]}>
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
  page: { flex: 1, padding: 16, paddingBottom: 8, gap: 12 },
  fill: { flex: 1, minHeight: 0, gap: 12 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 20 },
  capsules: { flexDirection: 'row', gap: 4 },
  capsule: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  capsuleFill: { height: '100%', borderRadius: 3 },
  hero: { flex: 1, minHeight: 0, borderRadius: 28, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', padding: 12, gap: 8 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  heroMedia: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  compactHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  compactTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  chipText: { fontSize: 12, fontWeight: '700' },
  eyebrow: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2 },
  title: { flex: 1, fontSize: 28, fontWeight: '800', letterSpacing: -0.6 },
  tipsToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingTop: 10, gap: 18 },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center' },
  tip: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  tipNum: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  tipNumText: { fontSize: 12, fontWeight: '800' },
  tipText: { flex: 1, fontSize: 15, lineHeight: 21 },
  card: { borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  entryHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  setLabel: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOn: { width: 22 },
  metaRow: { flexDirection: 'row', gap: 8, marginTop: -4, overflow: 'hidden' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, maxWidth: '100%' },
  fieldLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2 },
  stepperHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 20 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  round: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  bigInput: {
    flex: 1, minWidth: 0, textAlign: 'center', fontSize: 44, fontWeight: '800', letterSpacing: -1.5,
    fontVariant: ['tabular-nums'], paddingVertical: 0,
  },
  divider: { height: StyleSheet.hairlineWidth },
  field: { minHeight: 56, flexDirection: 'row', alignItems: 'center', borderRadius: 16, paddingRight: 12 },
  inlineLabel: { paddingLeft: 14, width: 86 },
  duration: { flex: 1, minWidth: 0, backgroundColor: 'transparent' },
  input: { flex: 1, minWidth: 0, paddingHorizontal: 12, paddingVertical: 12, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  cta: { height: 60, borderRadius: 30, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  ctaRaised: { shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  ctaText: { fontSize: 18, fontWeight: '800', letterSpacing: -0.2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  roundAction: { width: 60, height: 60, borderRadius: 30, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  upNext: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 8 },
  thumb: { alignItems: 'center', justifyContent: 'center' },
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
