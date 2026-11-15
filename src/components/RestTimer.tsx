import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { tint, useTheme } from '@/theme';
import { Icon, sym } from './Icon';

/** "1:30". Partial seconds round up, so the timer reads 0:00 only once it's done. */
export function formatRest(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const TICKS = 60;
const DIAL = 248;

/** A ring of ticks, lit clockwise from the top for the share of the rest still to go. */
function Dial({ share, children }: { share: number; children: React.ReactNode }) {
  const t = useTheme();
  const lit = Math.ceil(Math.min(1, Math.max(0, share)) * TICKS);
  return (
    <View style={styles.dial}>
      <View style={styles.ring} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View style={[styles.glow, { backgroundColor: tint(t.primary, 0.08) }]} />
        {Array.from({ length: TICKS }, (_, i) => {
          // Every fifth tick is longer, like a watch face. Each is centered on the dial before
          // it's turned and pushed out, so short and long ticks share one circle.
          const h = i % 5 === 0 ? 16 : 11;
          return (
            <View
              key={i}
              style={[
                styles.tick,
                {
                  backgroundColor: i < lit ? t.primary : tint(t.muted, 0.25),
                  height: h,
                  top: DIAL / 2 - h / 2,
                  transform: [{ rotate: `${(i * 360) / TICKS}deg` }, { translateY: -(DIAL / 2 - 12) }],
                },
              ]}
            />
          );
        })}
      </View>
      <View style={styles.center}>{children}</View>
    </View>
  );
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
  // The dial's full circle is the whole rest, so adding time grows it rather than refilling it.
  const [startedAt] = useState(Date.now);
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
  const share = (endsAt - now) / Math.max(1, endsAt - startedAt);
  const adjust = (label: string, text: string, seconds: number) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => onAdjust(seconds)}
      hitSlop={6}
      style={({ pressed }) => [
        styles.adjust,
        { backgroundColor: t.card, borderColor: t.border, transform: [{ scale: pressed ? 0.94 : 1 }] },
      ]}
    >
      <Text style={[styles.adjustText, { color: t.text }]}>{text}</Text>
    </Pressable>
  );

  return (
    <Animated.View entering={FadeIn.duration(220)} style={[styles.wrap, { backgroundColor: t.card, borderColor: t.border }]}>
      <Dial share={share}>
        <View accessible accessibilityLabel={`Rest, ${left} left`} accessibilityLiveRegion="polite" style={styles.clock}>
          <Text style={[styles.label, { color: t.primary }]}>Rest</Text>
          <Text style={[styles.time, { color: t.text }]}>{left}</Text>
        </View>
      </Dial>
      <View style={styles.controls}>
        {adjust('Take away 15 seconds', '−15', -15)}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip rest"
          onPress={onSkip}
          style={({ pressed }) => [
            styles.skip,
            { backgroundColor: t.primary, shadowColor: t.primary, transform: [{ scale: pressed ? 0.97 : 1 }] },
          ]}
        >
          <Text style={[styles.skipText, { color: t.onPrimary }]}>Skip rest</Text>
          <Icon name={sym('forward.end.fill', 'skip_next')} size={14} color={t.onPrimary} fallback="⏭" />
        </Pressable>
        {adjust('Add 15 seconds', '+15', 15)}
      </View>
      {next && (
        <View style={[styles.next, { backgroundColor: t.surface }]}>
          <Text style={[styles.nextText, { color: t.muted }]} numberOfLines={2}>{next}</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 22, paddingTop: 28, paddingBottom: 20, paddingHorizontal: 16, borderRadius: 28, borderWidth: StyleSheet.hairlineWidth },
  dial: { width: DIAL, height: DIAL, alignItems: 'center', justifyContent: 'center' },
  ring: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: DIAL - 56, height: DIAL - 56, borderRadius: DIAL },
  tick: { position: 'absolute', left: DIAL / 2 - 1.5, width: 3, borderRadius: 1.5 },
  center: { alignItems: 'center' },
  clock: { alignItems: 'center' },
  label: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2 },
  time: { fontSize: 64, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -2 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch' },
  adjust: { width: 60, height: 52, borderRadius: 26, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  adjustText: { fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  skip: {
    flex: 1, height: 52, borderRadius: 26, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  skipText: { fontSize: 16, fontWeight: '800' },
  next: { alignSelf: 'stretch', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14 },
  nextText: { textAlign: 'center', fontWeight: '600' },
});
