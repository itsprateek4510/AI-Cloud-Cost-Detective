import { act, fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { SpendHistory } from '../components/SpendHistory';

test('cost history loads explicitly and shows service trends by month', async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({
    available: true, cached: true, stale: false, currency: 'USD', estimated: false,
    months: ['2026-07', '2026-08', '2026-09'], total: '6.00', monthly_totals: { '2026-07': '1.00', '2026-08': '2.00', '2026-09': '3.00' },
    services: [{ service: 'Amazon EC2', amounts: { '2026-07': '1.00', '2026-08': '2.00', '2026-09': '3.00' }, total: '6.00' }],
  }) });
  vi.stubGlobal('fetch', fetcher);
  render(<SpendHistory token="token" accountId={1} />);
  expect(fetcher).not.toHaveBeenCalled();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Load spend history' })); });
  expect(fetcher.mock.calls[0][0]).toContain('/accounts/1/cost');
  expect(screen.getByText('Amazon EC2')).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: '2026-09' })).toBeInTheDocument();
  expect(screen.getByText(/Cached data/)).toBeInTheDocument();
});

test('missing Cost Explorer permissions show a skipped cost check, not zero spend', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
    available: false, reason: 'access_denied', months: [], services: [], total: null, currency: 'USD',
  }) }));
  render(<SpendHistory token="token" accountId={1} />);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Load spend history' })); });
  expect(screen.getByText(/Cost Explorer unavailable/)).toBeInTheDocument();
  expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
});
