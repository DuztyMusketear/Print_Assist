import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, test, expect } from 'vitest';
import { OrderForm } from './OrderForm';

const artifacts = [{ id: 'figure-pla-blue', name: 'Blue PLA figure' }];

test('submits the requested artifact and quantity with UTC deadlines', async () => {
  const submit = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(<OrderForm artifacts={artifacts} onSubmit={submit} />);
  await user.clear(screen.getByLabelText('Quantity'));
  await user.type(screen.getByLabelText('Quantity'), '3');
  await user.type(screen.getByLabelText('Production due (UTC)'), '2026-11-15T12:00');
  await user.type(screen.getByLabelText('Ship by (UTC)'), '2026-11-16T12:00');
  await user.click(screen.getByRole('button', { name: 'Add order' }));
  expect(submit).toHaveBeenCalledWith({artifact_id:'figure-pla-blue', quantity:3,
    priority:0, production_due:'2026-11-15T12:00:00.000Z', ship_by:'2026-11-16T12:00:00.000Z'});
});

test('preserves entered values and explains a rejected request', async () => {
  const user = userEvent.setup();
  render(<OrderForm artifacts={artifacts} onSubmit={vi.fn().mockRejectedValue(new Error('State changed; try again'))} />);
  await user.type(screen.getByLabelText('Production due (UTC)'), '2026-11-15T12:00');
  await user.type(screen.getByLabelText('Ship by (UTC)'), '2026-11-16T12:00');
  await user.click(screen.getByRole('button', { name:'Add order' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('State changed; try again');
  expect(screen.getByLabelText('Quantity')).toHaveValue(1);
  expect(screen.getByLabelText('Production due (UTC)')).toHaveValue('2026-11-15T12:00');
});

test('does not submit when production deadline follows ship-by', async () => {
  const submit = vi.fn();
  const user = userEvent.setup();
  render(<OrderForm artifacts={artifacts} onSubmit={submit} />);
  await user.type(screen.getByLabelText('Production due (UTC)'), '2026-11-17T12:00');
  await user.type(screen.getByLabelText('Ship by (UTC)'), '2026-11-16T12:00');
  await user.click(screen.getByRole('button', { name:'Add order' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Production must be due by the ship-by time');
  expect(submit).not.toHaveBeenCalled();
});
