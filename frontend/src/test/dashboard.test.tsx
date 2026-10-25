import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { vi } from 'vitest';
import { Scans } from '../pages/Scans';
import { Accounts } from '../pages/Accounts';
import { Report } from '../pages/Report';
import { FindingsTable } from '../components/FindingsTable';
import { accounts, scan } from './fixtures';

function respond(data: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => data } as Response;
}

test('findings sort by savings and filter by severity and region', () => {
  render(<FindingsTable findings={scan.findings} />);
  expect(within(screen.getAllByRole('row')[1]).getByText('vol-expensive')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Severity'), { target: { value: 'low' } });
  expect(screen.queryByText('vol-expensive')).not.toBeInTheDocument();
  expect(screen.getByText('eip-cheap')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Region'), { target: { value: 'us-east-1' } });
  expect(screen.queryByText('eip-cheap')).not.toBeInTheDocument();
  expect(screen.getByText('No findings match these filters.')).toBeInTheDocument();
});

test('start scan enqueues immediately, polls until completion, then stops', async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn()
    .mockResolvedValueOnce(respond({ scan_id: 10, status: 'pending' }))
    .mockResolvedValueOnce(respond({ ...scan, status: 'running', progress: 40, findings: [], totals: { findings_count: 0, savings_monthly: '0.00' } }))
    .mockResolvedValueOnce(respond(scan));
  vi.stubGlobal('fetch', fetcher);
  const onScan = vi.fn();
  const view = render(<Scans token="token" accounts={accounts} scanId={null} onScan={onScan} />);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Scan' })); });
  expect(onScan).toHaveBeenCalledWith(10);
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ account_id: 1 });
  view.rerender(<Scans token="token" accounts={accounts} scanId={10} onScan={onScan} />);
  await act(async () => {});
  expect(screen.getByText(/running.*40%/i)).toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
  expect(screen.getByText(/completed.*100%/i)).toBeInTheDocument();
  expect(screen.getByText('$11.65')).toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(fetcher).toHaveBeenCalledTimes(3);
});

test('failed scans show a safe error and stop polling', async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn().mockResolvedValue(respond({ ...scan, status: 'failed', progress: 5, error_message: 'AWS access failed.' }));
  vi.stubGlobal('fetch', fetcher);
  render(<Report token="token" scanId={10} />);
  await act(async () => {});
  expect(screen.getByText('AWS access failed.')).toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test('unmounting cancels polling and in-flight requests', async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn().mockResolvedValue(respond({ ...scan, status: 'pending', progress: 0 }));
  vi.stubGlobal('fetch', fetcher);
  const view = render(<Report token="token" scanId={10} />);
  await act(async () => {});
  const signal = fetcher.mock.calls[0][1].signal as AbortSignal;
  view.unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test('unverified accounts cannot start scans', () => {
  render(<Scans token="token" accounts={accounts.map(a => ({ ...a, verified_at: null }))} scanId={null} onScan={() => {}} />);
  expect(screen.getByRole('button', { name: 'Start Scan' })).toBeDisabled();
});

test('account creation displays ExternalId and verification submits the stored value', async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(respond({ id: 2, external_id: 'server-created-id', role_arn: null, guidance: 'Deploy template', template_path: 'infra/customer-role.yaml' }))
    .mockResolvedValueOnce(respond({ account_id: 2, verified: true }));
  vi.stubGlobal('fetch', fetcher);
  const refresh = vi.fn().mockResolvedValue(undefined);
  render(<Accounts token="token" accounts={[]} onRefresh={refresh} />);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Create AWS connection' })); });
  expect(screen.getByText('server-created-id')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Customer role ARN'), { target: { value: accounts[0].role_arn } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Verify account' })); });
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ account_id: 2, role_arn: accounts[0].role_arn, external_id: 'server-created-id' });
  expect(refresh).toHaveBeenCalledTimes(2);
});

test('API failures are shown instead of pretending a scan started', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond({ detail: 'Scan queue is unavailable' }, 503)));
  const onScan = vi.fn();
  render(<Scans token="token" accounts={accounts} scanId={null} onScan={onScan} />);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Scan' })); });
  expect(screen.getByRole('alert')).toHaveTextContent('Scan queue is unavailable');
  expect(onScan).not.toHaveBeenCalled();
});
