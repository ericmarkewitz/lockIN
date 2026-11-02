import { fireEvent, render, screen } from '@testing-library/react-native';

import { DateMultiPicker } from '../DateMultiPicker';

describe('DateMultiPicker', () => {
  it('shows the month of the initial date', async () => {
    await render(<DateMultiPicker selected={[]} onChange={jest.fn()} initialDate="2026-10-15" />);
    expect(screen.getByText('October 2026')).toBeTruthy();
    expect(screen.getByLabelText('2026-10-31')).toBeTruthy();
  });

  it('adds a tapped date to the selection, keeping it sorted', async () => {
    const onChange = jest.fn();
    await render(<DateMultiPicker selected={['2026-10-20']} onChange={onChange} initialDate="2026-10-15" />);
    await fireEvent.press(screen.getByLabelText('2026-10-05'));
    expect(onChange).toHaveBeenCalledWith(['2026-10-05', '2026-10-20']);
  });

  it('removes a tapped date that is already selected', async () => {
    const onChange = jest.fn();
    await render(<DateMultiPicker selected={['2026-10-05', '2026-10-20']} onChange={onChange} initialDate="2026-10-15" />);
    await fireEvent.press(screen.getByLabelText('2026-10-05'));
    expect(onChange).toHaveBeenCalledWith(['2026-10-20']);
  });

  it('marks selected dates as selected for accessibility', async () => {
    await render(<DateMultiPicker selected={['2026-10-05']} onChange={jest.fn()} initialDate="2026-10-15" />);
    expect(screen.getByLabelText('2026-10-05').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByLabelText('2026-10-06').props.accessibilityState).toMatchObject({ selected: false });
  });

  it('keeps selections across months', async () => {
    const onChange = jest.fn();
    await render(<DateMultiPicker selected={['2026-10-20']} onChange={onChange} initialDate="2026-10-15" />);
    await fireEvent.press(screen.getByLabelText('Next month'));
    expect(screen.getByText('November 2026')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('2026-11-03'));
    expect(onChange).toHaveBeenCalledWith(['2026-10-20', '2026-11-03']);
    await fireEvent.press(screen.getByLabelText('Previous month'));
    await fireEvent.press(screen.getByLabelText('Previous month'));
    expect(screen.getByText('September 2026')).toBeTruthy();
  });
});
