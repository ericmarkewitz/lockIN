import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { WeightUnit } from '@/data/settings';
import type { CategoryKind, WorkoutSet } from '@/data/types';
import type { SetPatch } from '@/data/workouts';
import { parseNumber } from '@/lib/numbers';
import { fromDisplayWeight, toDisplayWeight } from '@/lib/units';
import { MAX_REPS, durationOptions, wheelOptions } from '@/lib/wheel';
import { useTheme } from '@/theme';
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
    <View style={styles.field}>
      <TextInput
        accessibilityLabel={label}
        value={text}
        onChangeText={setDraft}
        onBlur={commit}
        onSubmitEditing={commit}
        keyboardType="decimal-pad"
        style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.bg }]}
      />
      <Text style={[styles.suffix, { color: t.muted }]}>{suffix}</Text>
    </View>
  );
}

/** Opens on the logged value, or the target so a planned set takes one tap to log. */
function WheelField({
  label, wheelLabel, title, suffix, value, target, optionsFor, onCommit,
}: {
  label: string; wheelLabel: string; title: string; suffix: string; value: number | null; target: number | null;
  optionsFor: (start: number | null) => (number | null)[]; onCommit: (n: number | null) => void;
}) {
  const t = useTheme();
  const start = value ?? target;
  const unlogged = target === null ? 'Not logged' : `Not logged, target ${target}`;
  return (
    <View style={styles.field}>
      <WheelButton
        label={label}
        valueText={value === null ? unlogged : String(value)}
        text={show(start)}
        muted={value === null}
        title={title}
        columns={[{ label: wheelLabel, options: optionsFor(start), value: start }]}
        onDone={([next]) => {
          if (next !== value) onCommit(next);
        }}
        style={styles.wheelButton}
      />
      <Text style={[styles.suffix, { color: t.muted }]}>{suffix}</Text>
    </View>
  );
}

const repOptions = (start: number | null) => wheelOptions(0, MAX_REPS, start);

export function SetRow({ kind, set, targetDurationMin = null, unit, onChange, onRemove }: Props) {
  const t = useTheme();
  const n = set.setNumber;
  return (
    <View style={styles.row}>
      <Text style={[styles.num, { color: t.muted }]}>{n}</Text>
      {kind === 'strength' ? (
        <>
          <NumField label={`Weight for set ${n}`} value={toDisplayWeight(set.weight, unit)} suffix={unit}
            onCommit={(weight) => onChange({ weight: fromDisplayWeight(weight, unit) })} />
          <WheelField
            label={`Reps for set ${n}`} wheelLabel="Reps" title={`Set ${n}`} suffix="reps"
            value={set.reps} target={set.targetReps} optionsFor={repOptions}
            onCommit={(reps) => onChange({ reps })}
          />
        </>
      ) : (
        <>
          <WheelField
            label={`Duration for set ${n}`} wheelLabel="Minutes" title={`Set ${n}`} suffix="min"
            value={set.durationMin} target={targetDurationMin} optionsFor={durationOptions}
            onCommit={(durationMin) => onChange({ durationMin })}
          />
          <NumField label={`Distance for set ${n}`} value={set.distance} suffix="dist" onCommit={(distance) => onChange({ distance })} />
        </>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Mark set ${n} ${set.completed ? 'not done' : 'done'}`}
        onPress={() => onChange({ completed: !set.completed })}
        style={[styles.check, { borderColor: set.completed ? t.success : t.border, backgroundColor: set.completed ? t.success : 'transparent' }]}
      >
        <Text style={{ color: set.completed ? '#fff' : t.muted }}>✓</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Remove set ${n}`} onPress={onRemove} hitSlop={8}>
        <Text style={{ color: t.muted, fontSize: 18 }}>×</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  num: { width: 18, textAlign: 'center', fontWeight: '600' },
  field: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  input: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 8, textAlign: 'center', fontSize: 16 },
  wheelButton: { flex: 1, minWidth: 0 },
  suffix: { fontSize: 12, width: 30 },
  check: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
