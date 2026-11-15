import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card } from '@/components/ui';
import { DISCLAIMER } from '@/disclaimer';
import { useTheme } from '@/theme';

/**
 * Shown on first launch, and again whenever the disclaimer's version is bumped. The root stack hides every
 * other screen until it's accepted. There is deliberately no Decline: iOS apps may not quit themselves.
 */
export function DisclaimerScreen({ onAccept }: { onAccept: () => void }) {
  const t = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
    {/* Insets come from the SafeAreaView: scroll insets would push the full-height content, and the buttons, past the bottom. */}
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text accessibilityRole="header" style={[styles.title, { color: t.text }]}>Before you start</Text>
      <Card style={{ gap: 12 }}>
        {DISCLAIMER.map((p) => (
          <Text key={p} style={[styles.body, { color: t.text }]}>{p}</Text>
        ))}
      </Card>
      <View style={styles.actions}>
        <Button title="I understand" onPress={onAccept} />
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, gap: 16, flexGrow: 1 },
  title: { fontSize: 32, fontWeight: '900' },
  body: { fontSize: 15, lineHeight: 21 },
  actions: { marginTop: 'auto' },
});
