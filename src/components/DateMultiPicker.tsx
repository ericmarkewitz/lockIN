import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { periodLabel, shiftAnchor } from '@/lib/calendar';
import { monthGrid, parseDateKey, todayKey, type DateKey } from '@/lib/dates';
import { useTheme } from '@/theme';
import { Button } from './ui';

/** Month calendar where any number of days can be toggled on and off. Selections persist across months. */
export function DateMultiPicker({
  selected, onChange, initialDate = todayKey(),
}: { selected: DateKey[]; onChange: (dates: DateKey[]) => void; initialDate?: DateKey }) {
  const t = useTheme();
  const [anchor, setAnchor] = useState(initialDate);
  const chosen = new Set(selected);
  const d = parseDateKey(anchor);

  const toggle = (date: DateKey) => {
    const next = new Set(chosen);
    if (next.has(date)) next.delete(date);
    else next.add(date);
    onChange([...next].sort());
  };

  return (
    <View style={{ gap: 8 }}>
      <View style={styles.navRow}>
        <Button title="‹" variant="secondary" label="Previous month" onPress={() => setAnchor(shiftAnchor(anchor, 'month', -1))} style={styles.small} />
        <Text style={[styles.title, { color: t.text }]}>{periodLabel(anchor, 'month')}</Text>
        <Button title="›" variant="secondary" label="Next month" onPress={() => setAnchor(shiftAnchor(anchor, 'month', 1))} style={styles.small} />
      </View>
      <View style={styles.row}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((l, i) => (
          <Text key={i} style={[styles.cell, { color: t.muted, textAlign: 'center' }]}>{l}</Text>
        ))}
      </View>
      <View style={styles.grid}>
        {monthGrid(d.getFullYear(), d.getMonth()).map((date, i) => {
          if (!date) return <View key={i} style={styles.cell} />;
          const on = chosen.has(date);
          return (
            <Pressable
              key={date}
              accessibilityRole="button"
              accessibilityLabel={date}
              accessibilityState={{ selected: on }}
              onPress={() => toggle(date)}
              style={[styles.cell, styles.day, { backgroundColor: on ? t.primary : 'transparent' }]}
            >
              <Text style={{ color: on ? t.onPrimary : t.text, fontWeight: on ? '700' : '400' }}>{parseDateKey(date).getDate()}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={{ color: t.muted }}>{selected.length} day{selected.length === 1 ? '' : 's'} selected</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '700' },
  small: { paddingVertical: 6, paddingHorizontal: 12 },
  row: { flexDirection: 'row' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1 },
  day: { alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
});
