import { HeaderHeightContext } from 'expo-router/react-navigation';
import { use, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, type ViewStyle } from 'react-native';

/**
 * Spread onto a screen's ScrollView. On iOS the scroll view insets itself for the keyboard and
 * scrolls the focused input into view; taps on buttons still land while the keyboard is up.
 */
export const keyboardScrollProps = {
  automaticallyAdjustKeyboardInsets: true,
  keyboardShouldPersistTaps: 'handled',
  keyboardDismissMode: Platform.OS === 'ios' ? 'interactive' : 'on-drag',
} as const;

/**
 * How a KeyboardAvoidingView should behave. Android edge-to-edge windows don't resize for the
 * keyboard, so always pad there; KeyboardAvoidingView measures itself relative to the screen,
 * below the header, so offset by the header height. On iOS a scroll view using
 * `keyboardScrollProps` already insets itself, and padding as well would lift inputs twice.
 */
export function keyboardAvoidance({ os, headerHeight, scrolls }: { os: string; headerHeight: number; scrolls: boolean }) {
  if (os === 'android') return { behavior: 'padding', keyboardVerticalOffset: headerHeight } as const;
  return { behavior: scrolls ? undefined : 'padding', keyboardVerticalOffset: 0 } as const;
}

type Props = { children: ReactNode; scrolls?: boolean; testID?: string; style?: ViewStyle };

/** Wrap a screen whose ScrollView uses `keyboardScrollProps` (or pass `scrolls={false}`). */
export function KeyboardAvoider({ children, scrolls = true, testID = 'keyboard-avoider', style }: Props) {
  const headerHeight = use(HeaderHeightContext) ?? 0;
  return (
    <KeyboardAvoidingView
      testID={testID}
      {...keyboardAvoidance({ os: Platform.OS, headerHeight, scrolls })}
      style={[{ flex: 1 }, style]}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
