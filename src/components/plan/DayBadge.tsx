import { StyleSheet, Text, View } from 'react-native';

import { KindIcon } from '@/components/calendar/KindIcon';
import { DAY_NAMES } from '@/lib/calendar';
import { accentGradient, tint, useTheme } from '@/theme';

/**
 * The square that leads a day's card: its short name on the accent for a training day, a moon in
 * the rest color for a rest day, and plain for a day with nothing planned yet.
 */
export function DayBadge({ weekday, state }: { weekday: number; state: 'training' | 'rest' | 'empty' }) {
  const t = useTheme();
  const short = DAY_NAMES[weekday].slice(0, 3).toUpperCase();
  if (state === 'rest') {
    return (
      <View style={[styles.badge, { backgroundColor: tint(t.rest, 0.16) }]}>
        <KindIcon kind="rest" size={18} color={t.rest} />
        <Text style={[styles.small, { color: t.rest }]}>{short}</Text>
      </View>
    );
  }
  const training = state === 'training';
  return (
    <View
      style={[
        styles.badge,
        training
          ? { backgroundColor: t.primary, experimental_backgroundImage: accentGradient(t) }
          : { backgroundColor: t.surface },
      ]}
    >
      <Text style={[styles.short, { color: training ? t.onPrimary : t.muted }]}>{short}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 1 },
  short: { fontSize: 15, fontWeight: '900', fontStyle: 'italic', letterSpacing: 0.2 },
  small: { fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
});
