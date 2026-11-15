import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { tint, useTheme } from '@/theme';
import { Button } from './ui';

/** "1:30". Partial seconds round up, so the timer reads 0:00 only once it's done. */
export function formatRest(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Counts down to `endsAt` (a wall-clock time, so it stays right while the app is in the
 * background) and buzzes when the rest is over.
 */
export function RestTimer({
  endsAt, next, onAdjust, onSkip, onFinish,
}: {
  endsAt: number; /** What comes after the rest, e.g. "Up next: Set 2 of 3". */ next?: string;
  onAdjust: (seconds: number) => void; onSkip: () => void; onFinish: () => void;
}) {
  const t = useTheme();
  const [now, setNow] = useState(Date.now);
  const finish = useRef(onFinish);
  useEffect(() => { finish.current = onFinish; });

  useEffect(() => {
    const id = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n < endsAt) return;
      clearInterval(id);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } catch {
        // No haptics on this platform.
      }
      finish.current();
    }, 250);
    return () => clearInterval(id);
  }, [endsAt]);

  const left = formatRest(endsAt - now);
  const chip = (label: string, text: string, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.chip, { backgroundColor: t.card, borderColor: t.border, opacity: pressed ? 0.6 : 1 }]}
    >
      <Text style={[styles.chipText, { color: t.primary }]}>{text}</Text>
    </Pressable>
  );

  return (
    <View style={[styles.wrap, { backgroundColor: tint(t.primary, 0.1) }]}>
      <View accessible accessibilityLabel={`Rest, ${left} left`} accessibilityLiveRegion="polite" style={styles.clock}>
        <Text style={[styles.label, { color: t.primary }]}>Rest</Text>
        <Text style={[styles.time, { color: t.text }]}>{left}</Text>
      </View>
      <View style={styles.chips}>
        {chip('Take away 15 seconds', '−15s', () => onAdjust(-15))}
        {chip('Add 15 seconds', '+15s', () => onAdjust(15))}
      </View>
      <Button title="Skip rest" onPress={onSkip} style={styles.skip} />
      {next && <Text style={[styles.next, { color: t.muted }]}>{next}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 16, paddingVertical: 28, paddingHorizontal: 16, borderRadius: 20 },
  clock: { alignItems: 'center' },
  label: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  time: { fontSize: 72, fontWeight: '800', fontVariant: ['tabular-nums'] },
  chips: { flexDirection: 'row', gap: 12 },
  chip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  chipText: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  skip: { alignSelf: 'stretch', paddingVertical: 14, borderRadius: 14 },
  next: { textAlign: 'center', fontWeight: '600' },
});
