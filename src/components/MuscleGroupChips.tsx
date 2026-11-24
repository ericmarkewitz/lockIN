import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CategoryKind } from '@/data/types';
import type { Theme } from '@/theme';

/** What a kind's subcategories are called: a lift's are muscle groups, yoga and mobility are types. */
export const subcategoryNoun = (kind: CategoryKind) => (kind === 'strength' ? 'Muscle group' : 'Type');

export type Chip = { value: string; label: string; a11y: string };

/** A row of toggles that wraps; the picked ones are filled in. */
export function Chips({ options, picked, onToggle, t }: {
  options: readonly Chip[]; picked: readonly string[]; onToggle: (value: string) => void; t: Theme;
}) {
  return (
    <View style={styles.chips}>
      {options.map((c) => {
        const on = picked.includes(c.value);
        return (
          <Pressable
            key={c.value}
            accessibilityRole="button"
            accessibilityLabel={c.a11y}
            accessibilityState={{ selected: on }}
            onPress={() => onToggle(c.value)}
            hitSlop={4}
            style={[styles.chip, on
              ? { backgroundColor: t.primary, borderColor: t.primary }
              : { backgroundColor: t.card, borderColor: t.border }]}
          >
            <Text style={[styles.chipLabel, { color: on ? t.onPrimary : t.text }]}>{c.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Toggles for the subcategories an exercise goes under (a lift's muscle groups, or yoga and
 * mobility); the first one picked is its main one.
 */
export function MuscleGroupChips({ options, picked, onToggle, kind, t }: {
  options: readonly string[]; picked: string[]; onToggle: (s: string) => void; kind: CategoryKind; t: Theme;
}) {
  const chips = options.map((s) => ({ value: s, label: s, a11y: `${subcategoryNoun(kind)} ${s}` }));
  return <Chips options={chips} picked={picked} onToggle={onToggle} t={t} />;
}

/** `picked` with `s` added at the end, or taken out if it was already there. */
export const toggled = (picked: string[], s: string) =>
  picked.includes(s) ? picked.filter((g) => g !== s) : [...picked, s];

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  chipLabel: { fontSize: 13, fontWeight: '600' },
});
