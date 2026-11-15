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
const MAX_DIAL = 260;

/** A ring of ticks, lit clockwise from the top for the share of the rest still to go. */
function Dial({ share, size, children }: { share: number; size: number; children: React.ReactNode }) {
  const t = useTheme();
  const lit = Math.ceil(Math.min(1, Math.max(0, share)) * TICKS);
  const long = size * 0.065;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={styles.ring} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View style={[styles.glow, { width: size * 0.78, height: size * 0.78, borderRadius: size, backgroundColor: tint(t.primary, 0.08) }]} />
        {Array.from({ length: TICKS }, (_, i) => {
          // Every fifth tick is longer, like a watch face. Each is centered on the dial before
          // it's turned and pushed out, so short and long ticks share one circle.
          const h = i % 5 === 0 ? long : long * 0.7;
          return (
            <View
              key={i}
              style={[
                styles.tick,
                {
                  backgroundColor: i < lit ? t.primary : tint(t.muted, 0.25),
                  height: h,
                  left: size / 2 - 1.5,
                  top: size / 2 - h / 2,
                  transform: [{ rotate: `${(i * 360) / TICKS}deg` }, { translateY: -(size / 2 - long * 0.75) }],
                },
              ]}
            />
          );
        })}
      </View>
      {children}
    </View>
  );
}

/**
 * Counts down to `endsAt` (a wall-clock time, so it stays right while the app is in the
 * background) and buzzes when the rest is over. Fills the height it's given; the dial grows
 * to fit.
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
  const [dial, setDial] = useState(220);
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
        { backgroundColor: t.surface, transform: [{ scale: pressed ? 0.94 : 1 }] },
      ]}
    >
      <Text style={[styles.adjustText, { color: t.text }]}>{text}</Text>
    </Pressable>
  );

  return (
    <Animated.View entering={FadeIn.duration(220)} style={[styles.wrap, { backgroundColor: tint(t.card, 0.55), borderColor: tint(t.text, 0.06) }]}>
      <View
        style={styles.room}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setDial(Math.max(120, Math.min(MAX_DIAL, width, height)));
        }}
      >
        <Dial share={share} size={dial}>
          <View accessible accessibilityLabel={`Rest, ${left} left`} accessibilityLiveRegion="polite" style={styles.clock}>
            <Text style={[styles.label, { color: t.primary }]}>Rest</Text>
            <Text style={[styles.time, { color: t.text, fontSize: Math.round(dial * 0.25) }]}>{left}</Text>
          </View>
        </Dial>
      </View>
      {next && <Text style={[styles.next, { color: t.muted }]} numberOfLines={1} adjustsFontSizeToFit>{next}</Text>}
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 0, alignItems: 'center', gap: 14, padding: 16, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth },
  room: { flex: 1, minHeight: 0, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  ring: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute' },
  tick: { position: 'absolute', width: 3, borderRadius: 1.5 },
  clock: { alignItems: 'center' },
  label: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2 },
  time: { fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -2 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch' },
  adjust: { width: 64, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  adjustText: { fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  skip: {
    flex: 1, height: 60, borderRadius: 30, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
  skipText: { fontSize: 17, fontWeight: '800' },
  next: { textAlign: 'center', fontWeight: '600', alignSelf: 'stretch' },
});
