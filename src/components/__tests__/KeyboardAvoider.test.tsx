import { render, screen } from '@testing-library/react-native';
import { ScrollView } from 'react-native';

import { keyboardAvoidance, keyboardScrollProps } from '../KeyboardAvoider';

describe('keyboardAvoidance', () => {
  it('leaves iOS screens to their scroll view, which insets itself for the keyboard', () => {
    expect(keyboardAvoidance({ os: 'ios', headerHeight: 88, scrolls: true })).toEqual({ behavior: undefined, keyboardVerticalOffset: 0 });
  });

  it('pads iOS content that is not in a scroll view', () => {
    expect(keyboardAvoidance({ os: 'ios', headerHeight: 0, scrolls: false })).toEqual({ behavior: 'padding', keyboardVerticalOffset: 0 });
  });

  it('pads on Android, where edge-to-edge windows do not resize, offset by the header', () => {
    expect(keyboardAvoidance({ os: 'android', headerHeight: 88, scrolls: true })).toEqual({ behavior: 'padding', keyboardVerticalOffset: 88 });
    expect(keyboardAvoidance({ os: 'android', headerHeight: 0, scrolls: false })).toEqual({ behavior: 'padding', keyboardVerticalOffset: 0 });
  });
});

describe('keyboardScrollProps', () => {
  it('gives scroll views keyboard insets and keeps taps working while typing', async () => {
    await render(<ScrollView testID="s" {...keyboardScrollProps} />);
    expect(screen.getByTestId('s').props).toMatchObject({
      automaticallyAdjustKeyboardInsets: true,
      keyboardShouldPersistTaps: 'handled',
    });
  });
});
