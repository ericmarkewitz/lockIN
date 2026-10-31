import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme';

type Props = {
  label: string;
  value: number;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  /** Inline version for set rows: no label or unit underneath. */
  compact?: boolean;
  onChange: (next: number) => void;
};

export function Stepper({ label, value, step = 1, min = 0, max = 999, unit, compact, onChange }: Props) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);

  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const commit = () => {
    const parsed = parseFloat(text);
    const next = Number.isFinite(parsed) ? clamp(parsed) : value;
    setText(String(next));
    if (next !== value) onChange(next);
  };

  return (
    <View style={compact ? s.wrapCompact : s.wrap}>
      {!compact && <Text style={s.label}>{label}</Text>}
      <View style={s.row}>
        <Pressable style={s.btn} onPress={() => onChange(clamp(value - step))} accessibilityLabel={`Decrease ${label}`} hitSlop={6}>
          <Text style={s.btnText}>−</Text>
        </Pressable>
        <TextInput
          style={[s.input, compact && s.inputCompact]}
          value={text}
          onChangeText={setText}
          onEndEditing={commit}
          keyboardType="decimal-pad"
          selectTextOnFocus
          accessibilityLabel={label}
        />
        <Pressable style={s.btn} onPress={() => onChange(clamp(value + step))} accessibilityLabel={`Increase ${label}`} hitSlop={6}>
          <Text style={s.btnText}>+</Text>
        </Pressable>
      </View>
      {!compact && (unit ? <Text style={s.unit}>{unit}</Text> : <View style={{ height: 14 }} />)}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center' },
  wrapCompact: { alignItems: 'center' },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center' },
  btn: { width: 32, height: 36, borderRadius: 8, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 20, fontWeight: '700', color: colors.ink, marginTop: -2 },
  input: { minWidth: 46, textAlign: 'center', fontSize: 22, fontWeight: '800', color: colors.ink, paddingVertical: 2 },
  inputCompact: { minWidth: 42, fontSize: 18 },
  unit: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
