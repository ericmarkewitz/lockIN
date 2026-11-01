import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { CategoryKind, WorkoutSet } from '@/data/types';
import type { SetPatch } from '@/data/workouts';
import { parseNumber } from '@/lib/numbers';
import { useTheme } from '@/theme';

type Props = {
  kind: CategoryKind;
  set: WorkoutSet;
  unit: string;
  onChange: (patch: SetPatch) => void;
  onRemove: () => void;
};

const show = (n: number | null) => (n === null ? '' : String(n));

function NumField({
  label, value, placeholder, suffix, onCommit,
}: { label: string; value: number | null; placeholder?: string; suffix: string; onCommit: (n: number | null) => void }) {
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
        placeholder={placeholder}
        placeholderTextColor={t.muted}
        style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.bg }]}
      />
      <Text style={[styles.suffix, { color: t.muted }]}>{suffix}</Text>
    </View>
  );
}

export function SetRow({ kind, set, unit, onChange, onRemove }: Props) {
  const t = useTheme();
  const n = set.setNumber;
  return (
    <View style={styles.row}>
      <Text style={[styles.num, { color: t.muted }]}>{n}</Text>
      {kind === 'strength' ? (
        <>
          <NumField label={`Weight for set ${n}`} value={set.weight} suffix={unit} onCommit={(weight) => onChange({ weight })} />
          <NumField
            label={`Reps for set ${n}`}
            value={set.reps}
            placeholder={set.targetReps !== null ? String(set.targetReps) : undefined}
            suffix="reps"
            onCommit={(reps) => onChange({ reps: reps === null ? null : Math.round(reps) })}
          />
        </>
      ) : (
        <>
          <NumField label={`Duration for set ${n}`} value={set.durationMin} suffix="min" onCommit={(durationMin) => onChange({ durationMin })} />
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
  suffix: { fontSize: 12, width: 30 },
  check: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
