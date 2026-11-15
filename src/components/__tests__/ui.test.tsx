import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { accentGradient, THEMES } from '@/theme';
import { AddButton, Button, Segmented, Toggle } from '../ui';

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

describe('Button', () => {
  it('fills the primary action with the accent gradient as a pill', async () => {
    await render(<Button title="Start workout" onPress={jest.fn()} />);
    expect(styleOf('Start workout')).toMatchObject({
      experimental_backgroundImage: accentGradient(THEMES.cobalt.light),
      borderRadius: 999,
    });
  });

  it('keeps secondary actions flat', async () => {
    await render(<Button variant="secondary" title="Cancel" onPress={jest.fn()} />);
    expect(styleOf('Cancel').experimental_backgroundImage).toBeUndefined();
  });
});

describe('Segmented', () => {
  it('inverts the selected option so it stands out', async () => {
    const t = THEMES.cobalt.light;
    await render(
      <Segmented options={[{ value: 'a', label: 'Day' }, { value: 'b', label: 'Week' }]} value="b" onChange={jest.fn()} />,
    );
    expect(styleOf('Week')).toMatchObject({ backgroundColor: t.text });
    expect(styleOf('Day').backgroundColor).toBeUndefined();
  });
});

describe('Toggle', () => {
  it('is a switch in the accent color', async () => {
    const onChange = jest.fn();
    await render(<Toggle label="Rest day" value={false} onChange={onChange} />);
    const sw = screen.getByLabelText('Rest day');
    expect(sw.props.onTintColor ?? sw.props.trackColor?.true).toBe(THEMES.cobalt.light.primary);
    await fireEvent(sw, 'valueChange', true);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
