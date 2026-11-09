import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ExerciseMotion } from '../ExerciseMotion';
import { MOTIONS } from '../motions';

describe('ExerciseMotion', () => {
  it('draws both sides of the figure solid, with no see-through limbs', async () => {
    await render(<ExerciseMotion motion={MOTIONS.Lunge} testID="figure" />);
    const figure = screen.getByTestId('figure', { includeHiddenElements: true });
    const opacities = figure.children
      .filter((c) => typeof c !== 'string')
      .map((c) => StyleSheet.flatten(c.props.style)?.opacity ?? 1);
    expect(opacities.length).toBeGreaterThan(0);
    expect(opacities.every((o) => o === 1)).toBe(true);
  });
});
