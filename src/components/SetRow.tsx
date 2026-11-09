import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { WeightUnit } from '@/data/settings';
import type { CategoryKind, WorkoutSet } from '@/data/types';
import type { SetPatch } from '@/data/workouts';
import { parseNumber } from '@/lib/numbers';
import { fromDisplayWeight, toDisplayWeight } from '@/lib/units';
import { MAX_REPS, wheelOptions } from '@/lib/wheel';
import { tint, useTheme } from '@/theme';
import { DurationButton } from './DurationButton';
import { Icon, sym } from './Icon';
import { WheelButton } from './WheelSheet';

type Props = {
  kind: CategoryKind;
  set: WorkoutSet;
  /** Sets don't store a duration target; it comes from the workout exercise. */
  targetDurationMin?: number | null;
  unit: WeightUnit;
  onChange: (patch: SetPatch) => void;
  onRemove: () => void;
};

const show = (n: number | null) => (n === null ? '' : String(n));

function NumField({
  label, value, suffix, onCommit,
}: { label: string; value: number | null; suffix: string; onCommit: (n: number | null) => void }) {
  const t = useTheme();
  // `draft` holds in-progress typing; null means "show the stored value".
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? show(value);
  const commit = () => {
    if (draft === null) return;
    const parsed = parseNumber(draft);
    setDraft(null);
    if (parsed !== value) onCommit(parsed);
  };
  return (
    <View style={[styles.field, { backgroundColor: t.surface }]}>
      <TextInput
        accessibilityLabel={label}
        value={text}
        onChangeText={setDraft}
        onBlur={commit}
        onSubmitEditing={commit}
        keyboardType="decimal-pad"
        placeholder="–"
        placeholderTextColor={t.muted}
        style={[styles.input, { color: t.text }]}
      />
      <Text style={[styles.suffix, { color: t.muted }]}>{suffix}</Text>
    </View>
  );
}

/** Reps open on the logged value, or the target so a planned set takes one tap to log. */
function RepsField({ set, onCommit }: { set: WorkoutSet; onCommit: (reps: number | null) => void }) {
  const t = useTheme();
  const { reps, targetReps } = set;
  const start = reps ?? targetReps;
  const unlogged = targetReps === null ? 'Not logged' : `Not logged, target ${targetReps}`;
  return (
    <View style={[styles.field, { backgroundColor: t.surface }]}>
      <WheelButton
        label={`Reps for set ${set.setNumber}`}
        valueText={reps === null ? unlogged : String(reps)}
        text={show(start)}
        muted={reps === null}
        title={`Set ${set.setNumber}`}
        columns={[{ label: 'Reps', options: wheelOptions(0, MAX_REPS, start), value: start }]}
        onDone={([next]) => {
          if (next !== reps) onCommit(next);
        }}
        style={styles.wheelButton}
      />
      <Text style={[styles.suffix, { color: t.muted }]}>reps</Text>
    </View>
  );
}

/** Column headings that line up with the fields of the SetRows below them. */
export function SetHeader({ kind }: { kind: CategoryKind }) {
  const t = useTheme();
  const [a, b] = kind === 'strength' ? ['Weight', 'Reps'] : ['Time', 'Distance'];
  const head = [styles.headText, { color: t.muted }];
  return (
    <View style={styles.header} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Text style={[head, styles.num]}>Set</Text>
      <Text style={[head, styles.headCol]}>{a}</Text>
      <Text style={[head, styles.headCol]}>{b}</Text>
      <View style={styles.headActions} />
    </View>
  );
}

export function SetRow({ kind, set, targetDurationMin = null, unit, onChange, onRemove }: Props) {
  const t = useTheme();
  const n = set.setNumber;
  const done = set.completed;
  return (
    <View style={[styles.row, done && { backgroundColor: tint(t.success, 0.1) }]}>
      <View style={[styles.num, styles.badge, { backgroundColor: done ? t.success : t.surface }]}>
        <Text style={[styles.numText, { color: done ? t.bg : t.muted }]}>{n}</Text>
      </View>
      {kind === 'strength' ? (
        <>
          <NumField label={`Weight for set ${n}`} value={toDisplayWeight(set.weight, unit)} suffix={unit}
            onCommit={(weight) => onChange({ weight: fromDisplayWeight(weight, unit) })} />
          <RepsField set={set} onCommit={(reps) => onChange({ reps })} />
        </>
      ) : (
        <>
          <View style={[styles.field, styles.fieldBare, { backgroundColor: t.surface }]}>
            <DurationButton
              label={`Duration for set ${n}`}
              title={`Set ${n}`}
              value={set.durationMin}
              target={targetDurationMin}
              onChange={(durationMin) => onChange({ durationMin })}
              style={styles.wheelButton}
            />
          </View>
          <NumField label={`Distance for set ${n}`} value={set.distance} suffix="dist" onCommit={(distance) => onChange({ distance })} />
        </>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Mark set ${n} ${set.completed ? 'not done' : 'done'}`}
        onPress={() => onChange({ completed: !set.completed })}
        style={({ pressed }) => [
          styles.check,
          { borderColor: done ? t.success : t.border, backgroundColor: done ? t.success : 'transparent', opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Icon name={sym('checkmark', 'check')} size={15} color={done ? t.bg : t.muted} fallback="✓" />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Remove set ${n}`} onPress={onRemove} hitSlop={10} style={styles.remove}>
        <Icon name={sym('xmark', 'close')} size={11} color={t.muted} fallback="×" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, paddingHorizontal: 6, marginHorizontal: -6, borderRadius: 12 },
  num: { width: 26 },
  badge: { height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  numText: { fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  field: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingRight: 10 },
  fieldBare: { paddingRight: 0 },
  input: { flex: 1, minWidth: 0, paddingHorizontal: 8, paddingVertical: 10, textAlign: 'center', fontSize: 17, fontWeight: '600', fontVariant: ['tabular-nums'] },
  wheelButton: { flex: 1, minWidth: 0, backgroundColor: 'transparent' },
  suffix: { fontSize: 12, fontWeight: '600' },
  check: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  remove: { width: 18, alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 4 },
  headText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, textAlign: 'center' },
  headCol: { flex: 1 },
  // Matches the check button, the remove button and the gap between them.
  headActions: { width: 36 + 8 + 18 },
});
