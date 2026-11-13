import { Pressable, StyleSheet, Text, View } from 'react-native';

import { THEME_IDS, type ThemeId } from '@/data/settings';
import { THEMES, tint, useScheme, useTheme } from '@/theme';
import { Icon, sym } from './Icon';

/** The status colors a theme is judged by, shown as dots next to its accent. */
const DOTS = ['success', 'warn', 'danger', 'rest'] as const;

/** One row per theme, each previewed in the light or dark scheme currently in effect. */
export function ThemePicker({ value, onChange }: { value: ThemeId; onChange: (id: ThemeId) => void }) {
  const t = useTheme();
  const scheme = useScheme();
  return (
    <View style={styles.list}>
      {THEME_IDS.map((id) => {
        const def = THEMES[id];
        const c = def[scheme];
        const on = id === value;
        return (
          <Pressable
            key={id}
            accessibilityRole="button"
            accessibilityLabel={`${def.name} theme`}
            accessibilityState={{ selected: on }}
            onPress={() => onChange(id)}
            style={({ pressed }) => [
              styles.row,
              { borderColor: on ? t.primary : t.border, backgroundColor: on ? tint(t.primary, 0.08) : 'transparent', opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <View style={[styles.preview, { backgroundColor: c.bg, borderColor: c.border }]}>
              <View style={[styles.previewCard, { backgroundColor: c.card, borderColor: c.border }]}>
                <View style={[styles.previewBar, { backgroundColor: c.primary }]} />
                <View style={[styles.previewLine, { backgroundColor: c.muted }]} />
              </View>
            </View>
            <View style={styles.body}>
              <Text style={{ color: t.text, fontWeight: '700' }}>{def.name}</Text>
              <Text style={{ color: t.muted, fontSize: 12 }}>{def.tag}</Text>
            </View>
            <View style={styles.dots}>
              {DOTS.map((k) => <View key={k} style={[styles.dot, { backgroundColor: c[k] }]} />)}
            </View>
            <View style={styles.check}>
              {on && <Icon name={sym('checkmark', 'check')} size={15} color={t.primary} fallback="✓" />}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderRadius: 12, borderWidth: 1 },
  preview: { width: 44, height: 36, borderRadius: 8, borderWidth: 1, padding: 5, justifyContent: 'center' },
  previewCard: { flex: 1, borderRadius: 4, borderWidth: StyleSheet.hairlineWidth, padding: 3, gap: 3, justifyContent: 'center' },
  previewBar: { height: 4, width: '70%', borderRadius: 2 },
  previewLine: { height: 2, width: '45%', borderRadius: 1, opacity: 0.6 },
  body: { flex: 1, minWidth: 0 },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  check: { width: 18, alignItems: 'center' },
});
