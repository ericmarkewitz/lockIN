import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';

import { previewDays, swapDays, type DayPreview } from '@/data/workouts';
import { useDb } from '@/db/DbContext';
import { useLoad } from '@/hooks/useLoad';
import { addDays, datesInRange, parseDateKey } from '@/lib/dates';
import { tint, useTheme } from '@/theme';
import { Icon, sym } from './Icon';
import { Button } from './ui';

const dayLabel = (date: string) =>
  parseDateKey(date).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

function describe(p: DayPreview): string {
  if (p.logged) return 'Already logged';
  if (p.isRest) return 'Rest day';
  return p.exercises.length ? p.exercises.join(', ') : 'Nothing planned';
}

/**
 * Picks a day up to six before or after `date` to trade workouts with, e.g. when today's legs
 * have to wait for Wednesday. Only those two dates change; the plan stays as it is.
 */
export function SwapDaySheet({ date, onSwapped, onClose }: {
  date: string;
  /** Called once the two days have been swapped; reload to show it. */
  onSwapped: () => void;
  onClose: () => void;
}) {
  const db = useDb();
  const t = useTheme();
  const [error, setError] = useState<string | null>(null);
  const { data } = useLoad(() => previewDays(db, datesInRange(addDays(date, -6), addDays(date, 6))), [db, date]);
  const list = useRef<ScrollViewInstance>(null);
  const listHeight = useRef(0);

  const swap = async (other: string) => {
    try {
      await swapDays(db, date, other);
      onSwapped();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable testID="swap-backdrop" accessible={false} onPress={onClose} style={styles.backdrop} />
        <View style={[styles.sheet, { backgroundColor: t.card }]}>
          <Text accessibilityRole="header" style={[styles.title, { color: t.text }]}>Swap {dayLabel(date)} with…</Text>
          <Text style={{ color: t.muted }}>Only these two days change; your plan stays the same.</Text>
          {error && <Text style={{ color: t.danger }}>{error}</Text>}
          <ScrollView
            ref={list}
            style={styles.list}
            contentContainerStyle={{ gap: 6 }}
            onLayout={(e) => { listHeight.current = e.nativeEvent.layout.height; }}
          >
            {(data ?? []).map((p) => p.date === date ? (
              // The day being swapped, in the middle of the days either side of it, so they read relative to it.
              <View
                key={p.date}
                testID={`swap-row-${p.date}`}
                accessible
                onLayout={(e) => {
                  const { y, height } = e.nativeEvent.layout;
                  list.current?.scrollTo({ y: Math.max(0, y + height / 2 - listHeight.current / 2), animated: false });
                }}
                style={[styles.row, { backgroundColor: tint(t.primary, 0.14), borderColor: t.primary, borderWidth: 1.5 }]}
              >
                <Text style={[styles.day, { color: t.primary }]}>{dayLabel(p.date)}</Text>
                <Text numberOfLines={1} style={{ color: t.text, flex: 1, fontSize: 13 }}>{describe(p)}</Text>
                <Text style={[styles.self, { color: t.primary }]}>This day</Text>
              </View>
            ) : (
              <Pressable
                key={p.date}
                testID={`swap-row-${p.date}`}
                accessibilityRole="button"
                accessibilityLabel={`Swap with ${dayLabel(p.date)}`}
                accessibilityState={{ disabled: p.logged }}
                disabled={p.logged}
                onPress={() => swap(p.date)}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: pressed ? tint(t.primary, 0.12) : t.surface, opacity: p.logged ? 0.45 : 1 },
                ]}
              >
                <Text style={[styles.day, { color: t.text }]}>{dayLabel(p.date)}</Text>
                <Text numberOfLines={1} style={{ color: t.muted, flex: 1, fontSize: 13 }}>{describe(p)}</Text>
                {!p.logged && <Icon name={sym('arrow.left.arrow.right', 'swap_horiz')} size={14} color={t.primary} fallback="⇄" />}
              </Pressable>
            ))}
          </ScrollView>
          <Button title="Cancel" variant="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: 24 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderRadius: 16, padding: 20, gap: 8, width: '100%', maxWidth: 420, maxHeight: '85%', alignSelf: 'center' },
  title: { fontSize: 17, fontWeight: '700' },
  list: { flexGrow: 0, marginVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  day: { width: 92, fontWeight: '700' },
  self: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
});
