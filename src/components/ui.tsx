import * as Haptics from 'expo-haptics';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View, type TextStyle, type ViewStyle } from 'react-native';

import { accentGradient, tint, useScheme, useTheme } from '@/theme';
import { Icon, sym } from './Icon';

/** A light tap under the thumb. Nothing where the platform has no haptics. */
export function tapFeedback() {
  try {
    Haptics.selectionAsync().catch(() => {});
  } catch {
    // No haptics on this platform.
  }
}

/** A soft drop shadow in light mode; dark mode separates surfaces by color instead. */
export function useRaised(): ViewStyle {
  const scheme = useScheme();
  return scheme === 'light'
    ? { boxShadow: '0px 1px 2px rgba(16, 24, 40, 0.04), 0px 8px 24px rgba(16, 24, 40, 0.06)' }
    : {};
}

export function Button({
  title, onPress, variant = 'primary', disabled, style, label,
}: {
  title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger'; disabled?: boolean;
  style?: ViewStyle; label?: string;
}) {
  const t = useTheme();
  const primary = variant === 'primary';
  const color = primary ? t.onPrimary : variant === 'danger' ? t.danger : t.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      disabled={disabled}
      onPress={() => { if (primary) tapFeedback(); onPress(); }}
      style={({ pressed }) => [
        styles.btn,
        primary
          ? { backgroundColor: t.primary, experimental_backgroundImage: accentGradient(t), boxShadow: `0px 6px 16px ${tint(t.primary, 0.3)}` }
          : { backgroundColor: variant === 'danger' ? tint(t.danger, 0.1) : t.surface },
        { opacity: disabled ? 0.45 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
        style,
      ]}
    >
      <Text style={[styles.btnText, { color }]}>{title}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  const raised = useRaised();
  return <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }, raised, style]}>{children}</View>;
}

/** A small, spaced-out uppercase label above a section or a number. */
export function Eyebrow({ children, color, style }: { children: ReactNode; color?: string; style?: TextStyle }) {
  const t = useTheme();
  return <Text style={[styles.eyebrow, { color: color ?? t.muted }, style]}>{children}</Text>;
}

/** A section's heading with an optional icon in an accent-tinted badge. */
export function SectionTitle({ title, icon, fallback = '•' }: { title: string; icon?: SymbolName; fallback?: string }) {
  const t = useTheme();
  return (
    <View style={styles.section}>
      {icon && (
        <View style={[styles.sectionIcon, { backgroundColor: tint(t.primary, 0.14) }]}>
          <Icon name={icon} size={14} color={t.primary} fallback={fallback} />
        </View>
      )}
      <Text style={[styles.sectionText, { color: t.text }]}>{title}</Text>
    </View>
  );
}

export function Segmented<T extends string>({
  options, value, onChange,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const t = useTheme();
  return (
    <View style={[styles.seg, { backgroundColor: t.surface }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
            onPress={() => { if (!on) tapFeedback(); onChange(o.value); }}
            style={[styles.segItem, on && [styles.segOn, { backgroundColor: t.text }]]}
          >
            <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.segText, { color: on ? t.bg : t.muted }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type SymbolName = Extract<SymbolViewProps['name'], object>;

/** An on/off switch in the theme's accent instead of the system green. */
export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const t = useTheme();
  return (
    <Switch
      accessibilityLabel={label}
      value={value}
      onValueChange={onChange}
      trackColor={{ false: t.surface, true: t.primary }}
      ios_backgroundColor={t.surface}
    />
  );
}

/** A round icon-only button. `fallback` is shown where the platform has no matching symbol. */
export function IconButton({
  icon, fallback, label, onPress, size = 40,
}: { icon: SymbolName; fallback: string; label: string; onPress: () => void; size?: number }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.icon,
        {
          width: size, height: size, borderRadius: size / 2, backgroundColor: t.surface,
          opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.92 : 1 }],
        },
      ]}
    >
      <SymbolView
        name={icon}
        size={size * 0.42}
        tintColor={t.text}
        weight="bold"
        fallback={<Text style={{ color: t.text, fontSize: size * 0.4, fontWeight: '700' }}>{fallback}</Text>}
      />
    </Pressable>
  );
}

/** A dashed "+ title" button; `quiet` shrinks it to a small text link for actions that are rarely needed. */
export function AddButton({ title, label, onPress, compact, quiet }: { title: string; label?: string; onPress: () => void; compact?: boolean; quiet?: boolean }) {
  const t = useTheme();
  const small = compact || quiet;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      onPress={onPress}
      hitSlop={quiet ? 10 : undefined}
      style={({ pressed }) =>
        quiet
          ? [styles.addQuiet, { backgroundColor: 'transparent', opacity: pressed ? 0.5 : 1 }]
          : [
              styles.add,
              compact && styles.addCompact,
              { borderColor: tint(t.primary, 0.45), backgroundColor: tint(t.primary, pressed ? 0.14 : 0.06) },
            ]
      }
    >
      <Icon name={sym('plus', 'add')} size={quiet ? 12 : small ? 13 : 15} color={t.primary} fallback="+" />
      <Text style={{ color: t.primary, fontWeight: '800', fontSize: quiet ? 13 : small ? 14 : 15 }}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { paddingVertical: 13, paddingHorizontal: 18, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  card: { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  eyebrow: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.4 },
  section: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionText: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  seg: { flexDirection: 'row', borderRadius: 999, padding: 4 },
  segItem: { flex: 1, paddingVertical: 9, paddingHorizontal: 6, alignItems: 'center', borderRadius: 999 },
  segOn: { boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.12)' },
  segText: { fontSize: 14, fontWeight: '800', letterSpacing: -0.1 },
  add: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed' },
  addCompact: { paddingVertical: 9, borderRadius: 12, borderWidth: 1 },
  addQuiet: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingVertical: 4, paddingHorizontal: 2 },
  icon: { alignItems: 'center', justifyContent: 'center' },
});
