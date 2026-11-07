import { fireEvent, render, screen } from '@testing-library/react-native';

import { ConfirmDialog } from '../ConfirmDialog';

const setup = async () => {
  const onConfirm = jest.fn();
  const onCancel = jest.fn();
  await render(<ConfirmDialog title="Remove set 1?" message="Gone for good." confirmLabel="Remove" onConfirm={onConfirm} onCancel={onCancel} />);
  return { onConfirm, onCancel };
};

describe('ConfirmDialog', () => {
  it('shows what is being confirmed', async () => {
    await setup();
    expect(screen.getByText('Remove set 1?')).toBeTruthy();
    expect(screen.getByText('Gone for good.')).toBeTruthy();
  });

  it('confirms only from the confirm button', async () => {
    const { onConfirm, onCancel } = await setup();
    await fireEvent.press(screen.getByLabelText('Remove'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('cancels from the cancel button', async () => {
    const { onConfirm, onCancel } = await setup();
    await fireEvent.press(screen.getByLabelText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('cancels when the backdrop is tapped', async () => {
    const { onConfirm, onCancel } = await setup();
    await fireEvent.press(screen.getByTestId('confirm-backdrop'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
