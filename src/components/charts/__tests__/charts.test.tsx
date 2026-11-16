import { fireEvent, render, screen } from '@testing-library/react-native';

import { BarChart } from '../BarChart';
import { TrendChart } from '../TrendChart';

const layout = { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 160 } } };

describe('TrendChart', () => {
  it('draws a point per value once it knows its width', async () => {
    await render(<TrendChart label="Trend" points={[{ key: 'a', value: 100 }, { key: 'b', value: 120 }, { key: 'c', value: 110 }]} />);
    expect(screen.queryAllByTestId(/^trend-point-/)).toHaveLength(0);
    await fireEvent(screen.getByLabelText('Trend'), 'layout', layout);
    expect(screen.getAllByTestId(/^trend-point-/)).toHaveLength(3);
    expect(screen.getAllByTestId(/^trend-segment-/)).toHaveLength(2);
  });

  it('keeps the line clear of the value labels on the right', async () => {
    await render(<TrendChart label="Up" points={[{ key: 'a', value: 100 }, { key: 'b', value: 120 }]} />);
    await fireEvent(screen.getByLabelText('Up'), 'layout', layout);
    const last = screen.getByTestId('trend-point-b').props.style.find((s: { left?: number }) => s?.left !== undefined);
    expect(last.left + last.width).toBeLessThanOrEqual(300 - 40);
  });

  it('draws a flat line when every value is the same', async () => {
    await render(<TrendChart label="Flat" points={[{ key: 'a', value: 100 }, { key: 'b', value: 100 }]} />);
    await fireEvent(screen.getByLabelText('Flat'), 'layout', layout);
    const centers = screen.getAllByTestId(/^trend-point-/).map((p) => {
      const { top, height } = p.props.style.find((s: { top?: number }) => s?.top !== undefined);
      return top + height / 2;
    });
    expect(centers[0]).toBe(centers[1]);
    expect(Number.isFinite(centers[0])).toBe(true);
  });
});

describe('BarChart', () => {
  it('labels each bar for screen readers and scales to the tallest', async () => {
    await render(<BarChart bars={[{ key: 'a', label: 'Nov 2', value: 50, valueLabel: '50 lb' }, { key: 'b', label: 'Nov 9', value: 100, valueLabel: '100 lb' }]} />);
    expect(screen.getByLabelText('Nov 2: 50 lb').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ height: '50%' })]));
    expect(screen.getByLabelText('Nov 9: 100 lb').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ height: '100%' })]));
  });

  it('draws nothing tall when every bar is zero', async () => {
    await render(<BarChart bars={[{ key: 'a', label: 'Nov 2', value: 0, valueLabel: '0 lb' }]} />);
    expect(screen.getByLabelText('Nov 2: 0 lb').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ height: '0%' })]));
  });

  it('labels every other bar once there are more than seven, counting back from the last', async () => {
    const bars = Array.from({ length: 9 }, (_, i) => ({ key: `k${i}`, label: `L${i}`, value: i, valueLabel: `${i}` }));
    await render(<BarChart bars={bars} />);
    expect(['L8', 'L6', 'L4', 'L2', 'L0'].every((l) => screen.queryByText(l))).toBe(true);
    expect(['L7', 'L5', 'L3', 'L1'].some((l) => screen.queryByText(l))).toBe(false);
    // Every bar still names its period for screen readers.
    expect(screen.getByLabelText('L7: 7')).toBeTruthy();
  });
});
