import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { tint, useTheme } from '@/theme';
import { Icon, sym } from './Icon';

export function Button({
  title, onPress, variant = 'primary', disabled, style, label,
}: {
  title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger'; disabled?: boolean;
  style?: ViewStyle; label?: string;
}) {
  const t = useTheme();
  const bg = variant === 'primary' ? t.primary : 'transparent';
  const color = variant === 'primary' ? t.onPrimary : variant === 'danger' ? t.danger : t.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.btn,
        { backgroundColor: bg, borderColor: variant === 'primary' ? t.primary : t.border, opacity: disabled ? 0.5 : 1 },
        style,
      ]}
    >
      <Text style={{ color, fontWeight: '600' }}>{title}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }, style]}>{children}</View>;
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
            onPress={() => onChange(o.value)}
            style={[styles.segItem, on && [styles.segOn, { backgroundColor: t.card }]]}
          >
            <Text style={{ color: on ? t.text : t.muted, fontWeight: on ? '700' : '600' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type SymbolName = Extract<SymbolViewProps['name'], object>;

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
        { width: size, height: size, borderRadius: size / 2, backgroundColor: t.card, borderColor: t.border, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <SymbolView
        name={icon}
        size={size * 0.45}
        tintColor={t.text}
        weight="semibold"
        fallback={<Text style={{ color: t.text, fontSize: size * 0.4, fontWeight: '700' }}>{fallback}</Text>}
      />
    </Pressable>
  );
}

/** A dashed, accent-tinted button for adding something to the list above it. */
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
      <Text style={{ color: t.primary, fontWeight: '700', fontSize: quiet ? 13 : small ? 14 : 15 }}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  card: { borderRadius: 14, borderWidth: 1, padding: 14 },
  seg: { flexDirection: 'row', borderRadius: 12, padding: 3 },
  segItem: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 9 },
  segOn: { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  add: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed' },
  addCompact: { paddingVertical: 9, borderRadius: 12, borderWidth: 1 },
  addQuiet: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingVertical: 4, paddingHorizontal: 2 },
  icon: { alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
});
