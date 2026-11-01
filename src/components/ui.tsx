import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

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
    <View style={[styles.seg, { borderColor: t.border, backgroundColor: t.card }]}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          accessibilityRole="button"
          accessibilityState={{ selected: o.value === value }}
          accessibilityLabel={o.label}
          onPress={() => onChange(o.value)}
          style={[styles.segItem, o.value === value && { backgroundColor: t.primary }]}
        >
          <Text style={{ color: o.value === value ? t.onPrimary : t.text, fontWeight: '600' }}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  card: { borderRadius: 14, borderWidth: 1, padding: 14 },
  seg: { flexDirection: 'row', borderRadius: 10, borderWidth: 1, overflow: 'hidden' },
  segItem: { flex: 1, paddingVertical: 8, alignItems: 'center' },
});
