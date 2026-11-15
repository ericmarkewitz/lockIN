import { StyleSheet, Text, View } from 'react-native';

import { tint, useTheme } from '@/theme';
import { ExerciseMotionFor } from './motion/ExerciseMotion';

/**
 * The large picture of an exercise in workout mode. Built-ins show their stick figure; a
 * custom exercise shows its initial.
 *
 * This is the one place form videos will plug in: once there are clips, look one up by
 * exercise name here and play it (looping, muted), falling back to the figure.
 */
export function ExerciseMedia({ name, isCustom, size = 160 }: { name: string; isCustom: boolean; size?: number }) {
  const t = useTheme();
  return (
    <View style={[styles.frame, { backgroundColor: tint(t.primary, 0.07) }]}>
      {isCustom ? (
        <Text style={[styles.initial, { color: t.primary, fontSize: size * 0.4 }]}>{name.trim().charAt(0).toUpperCase()}</Text>
      ) : (
        <ExerciseMotionFor name={name} isCustom={isCustom} size={size} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignItems: 'center', justifyContent: 'center', borderRadius: 20, paddingVertical: 16 },
  initial: { fontWeight: '800' },
});
