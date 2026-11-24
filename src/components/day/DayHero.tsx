import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, sym } from '@/components/Icon';
import { parseDateKey, todayKey } from '@/lib/dates';
import { mix, tint, useTheme } from '@/theme';

type Props = {
  date: string;
  isRest: boolean;
  /** Exercises done (every set ticked) of those shown. */
  done: number;
  total: number;
  /** Sets ticked off of every set shown. */
  setsDone: number;
  setsTotal: number;
  /** What a rest day says: whether logged sets are still showing. */
  restMessage: string;
  /** Start or Resume, when there's anything left to do. */
  start?: { label: string; onPress: () => void };
};

/**
 * The top of a day: its date, how far through the workout you are, and the button into workout
 * mode, on the theme's accent. It turns to the success color once everything is done, and to the
 * rest color on a rest day.
 */
export function DayHero({ date, isRest, done, total, setsDone, setsTotal, restMessage, start }: Props) {
  const t = useTheme();
  const on = t.onPrimary;
  const complete = total > 0 && done === total;
  const base = isRest ? t.rest : complete ? t.success : t.primary;
  const d = parseDateKey(date);
  const when = `${d.toLocaleString('en-US', { weekday: 'long' })} · ${d.toLocaleString('en-US', { month: 'short', day: 'numeric' })}`;
  return (
    <View
      style={[
        styles.hero,
        { backgroundColor: base, experimental_backgroundImage: `linear-gradient(135deg, ${base} 0%, ${mix(base, '#000000', 0.25)} 100%)`, shadowColor: base },
      ]}
    >
      <View style={styles.top}>
        <Text style={[styles.eyebrow, { color: tint(on, 0.8) }]}>{when}</Text>
        {date === todayKey() && (
          <View style={[styles.tag, { backgroundColor: tint(on, 0.2) }]}>
            <Text style={[styles.tagText, { color: on }]}>Today</Text>
          </View>
        )}
      </View>

      {isRest ? (
        <View style={styles.restBody}>
          <Icon name={sym('moon.stars.fill', 'nights_stay')} size={44} color={on} fallback="☾" />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.restTitle, { color: on }]}>Rest day</Text>
            <Text style={{ color: tint(on, 0.85) }}>{restMessage}</Text>
          </View>
        </View>
      ) : (
        <View accessible accessibilityLabel={`${done} of ${total} exercises done`} style={{ gap: 10 }}>
          <View style={styles.countRow}>
            <Text style={[styles.big, { color: on }]}>
              {done}<Text style={{ color: tint(on, 0.55) }}>/{total}</Text>
            </Text>
            <Text style={[styles.countLabel, { color: on }]}>
              {complete ? 'Workout complete' : total ? 'exercises done' : 'No exercises yet'}
            </Text>
            {complete && <Icon name={sym('trophy.fill', 'emoji_events')} size={26} color={on} fallback="🏆" />}
          </View>
          <View style={[styles.track, { backgroundColor: tint(on, 0.2) }]}>
            <View style={[styles.fill, { backgroundColor: on, width: `${total ? (done / total) * 100 : 0}%` }]} />
          </View>
          {setsTotal > 0 && (
            <Text style={[styles.sets, { color: tint(on, 0.85) }]}>
              {setsDone} of {setsTotal} {setsTotal === 1 ? 'set' : 'sets'} logged
            </Text>
          )}
        </View>
      )}

      {start && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={start.label}
          onPress={start.onPress}
          style={({ pressed }) => [styles.cta, { backgroundColor: on, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
        >
          <Icon name={sym('play.fill', 'play_arrow')} size={16} color={base} fallback="▶" />
          <Text style={[styles.ctaText, { color: base }]}>{start.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: 28, padding: 18, gap: 14,
    shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyebrow: { flex: 1, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2 },
  tag: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  tagText: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
  countRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
  big: { fontSize: 56, fontWeight: '900', fontStyle: 'italic', letterSpacing: -2.5, fontVariant: ['tabular-nums'] },
  countLabel: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  sets: { fontSize: 13, fontWeight: '700' },
  restBody: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 4 },
  restTitle: { fontSize: 28, fontWeight: '900', fontStyle: 'italic', letterSpacing: -0.8 },
  cta: { height: 54, borderRadius: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ctaText: { fontSize: 17, fontWeight: '900', letterSpacing: -0.2 },
});
