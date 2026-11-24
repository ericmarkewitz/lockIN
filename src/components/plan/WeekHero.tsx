import { StyleSheet, Text, View } from 'react-native';

import { KindIcon } from '@/components/calendar/KindIcon';
import type { CategoryKind } from '@/data/types';
import { DAY_NAMES } from '@/lib/calendar';
import { accentGradient, tint, useTheme } from '@/theme';

export type WeekDay = { weekday: number; isRest: boolean; kinds: CategoryKind[] };

const KIND_NAMES: Record<CategoryKind, string> = { strength: 'Lifts', cardio: 'Cardio', mindbody: 'Mind & Body' };
const KIND_ORDER: CategoryKind[] = ['strength', 'cardio', 'mindbody'];
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * The week at a glance, as the page's hero: how many days you train, the mix of training, and a
 * tile per day lit with what that day holds. Today's tile is ringed.
 */
export function WeekHero({ days, today }: { days: WeekDay[]; today: number }) {
  const t = useTheme();
  const on = t.onPrimary;
  const training = days.filter((d) => !d.isRest && d.kinds.length > 0).length;
  const rest = days.filter((d) => d.isRest).length;
  const mix = KIND_ORDER.map((kind) => ({ kind, days: days.filter((d) => !d.isRest && d.kinds.includes(kind)).length }))
    .filter((m) => m.days > 0);
  return (
    <View
      accessible
      accessibilityLabel={`Week: ${plural(training, 'training day')}, ${plural(rest, 'rest day')}`}
      style={[styles.hero, { backgroundColor: t.primary, experimental_backgroundImage: accentGradient(t), shadowColor: t.primary }]}
    >
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: tint(on, 0.75) }]}>Your week</Text>
          <View style={styles.countRow}>
            <Text style={[styles.count, { color: on }]}>{training}</Text>
            <Text style={[styles.countLabel, { color: on }]}>{training === 1 ? 'training\nday' : 'training\ndays'}</Text>
          </View>
        </View>
        <View style={[styles.restBubble, { backgroundColor: tint(on, 0.16) }]}>
          <KindIcon kind="rest" size={14} color={on} />
          <Text style={[styles.restText, { color: on }]}>{rest} rest</Text>
        </View>
      </View>
      {mix.length > 0 && (
        <View style={styles.mix}>
          {mix.map((m) => (
            <View key={m.kind} style={[styles.mixChip, { backgroundColor: tint(on, 0.16) }]}>
              <KindIcon kind={m.kind} size={13} color={on} />
              <Text style={[styles.mixText, { color: on }]}>{KIND_NAMES[m.kind]} × {m.days}</Text>
            </View>
          ))}
        </View>
      )}
      <View style={styles.strip}>
        {days.map((d) => {
          const lit = !d.isRest && d.kinds.length > 0;
          const isToday = d.weekday === today;
          return (
            <View key={d.weekday} style={styles.dayCol}>
              <Text style={[styles.dayLetter, { color: isToday ? on : tint(on, 0.7) }]}>{DAY_NAMES[d.weekday].charAt(0)}</Text>
              <View
                style={[
                  styles.tile,
                  { backgroundColor: lit ? tint(on, 0.26) : d.isRest ? tint(t.rest, 0.45) : tint(on, 0.08) },
                  isToday && { borderWidth: 2, borderColor: on },
                ]}
              >
                {lit ? <KindIcon kind={d.kinds[0]} size={15} color={on} />
                  : d.isRest ? <KindIcon kind="rest" size={13} color={on} />
                  : <View style={[styles.dot, { backgroundColor: tint(on, 0.4) }]} />}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: 28, padding: 18, gap: 14,
    shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  eyebrow: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.4 },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  count: { fontSize: 64, fontWeight: '900', fontStyle: 'italic', letterSpacing: -3, lineHeight: 68, fontVariant: ['tabular-nums'] },
  countLabel: { fontSize: 16, fontWeight: '800', lineHeight: 19, letterSpacing: -0.2 },
  restBubble: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  restText: { fontSize: 13, fontWeight: '800' },
  mix: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  mixChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  mixText: { fontSize: 13, fontWeight: '700' },
  strip: { flexDirection: 'row', gap: 6 },
  dayCol: { flex: 1, alignItems: 'center', gap: 5 },
  dayLetter: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  tile: { width: '100%', aspectRatio: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3 },
});
