import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { tint, useTheme } from '@/theme';

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
  endsAt, onAdjust, onSkip, onFinish,
}: { endsAt: number; onAdjust: (seconds: number) => void; onSkip: () => void; onFinish: () => void }) {
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
      style={({ pressed }) => [styles.chip, { backgroundColor: t.card, opacity: pressed ? 0.6 : 1 }]}
    >
      <Text style={[styles.chipText, { color: t.primary }]}>{text}</Text>
    </Pressable>
  );

  return (
    <View style={[styles.wrap, { backgroundColor: tint(t.primary, 0.1) }]}>
      <View accessible accessibilityLabel={`Rest, ${left} left`} accessibilityLiveRegion="polite" style={{ flex: 1 }}>
        <Text style={[styles.label, { color: t.primary }]}>Rest</Text>
        <Text style={[styles.time, { color: t.text }]}>{left}</Text>
      </View>
      {chip('Take away 15 seconds', '−15s', () => onAdjust(-15))}
      {chip('Add 15 seconds', '+15s', () => onAdjust(15))}
      {chip('Skip rest', 'Skip', onSkip)}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 16 },
  label: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  time: { fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  chipText: { fontWeight: '700', fontVariant: ['tabular-nums'] },
});
