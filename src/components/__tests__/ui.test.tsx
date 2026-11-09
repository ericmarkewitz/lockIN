import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { AddButton } from '../ui';

const styleOf = (label: string) => StyleSheet.flatten(screen.getByLabelText(label).props.style);

describe('AddButton', () => {
  it('draws a dashed outline by default', async () => {
    await render(<AddButton title="Add exercise" onPress={jest.fn()} />);
    expect(styleOf('Add exercise')).toMatchObject({ borderStyle: 'dashed', borderWidth: 1.5 });
  });

  it('quiet is a borderless, unfilled link that still presses', async () => {
    const onPress = jest.fn();
    await render(<AddButton quiet title="Add set" label="Add set to Squat" onPress={onPress} />);
    const style = styleOf('Add set to Squat');
    expect(style.borderWidth ?? 0).toBe(0);
    expect(style.backgroundColor).toBe('transparent');
    expect(screen.getByText('Add set')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Add set to Squat'));
    expect(onPress).toHaveBeenCalled();
  });
});
