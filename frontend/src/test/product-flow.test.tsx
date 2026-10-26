import { act, fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import App from '../App';
import { Accounts } from '../pages/Accounts';
import { FindingsTable } from '../components/FindingsTable';
import { accounts, scan } from './fixtures';

const respond = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data });

test('sample workspace is explicit and never calls the live API', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Explore sample workspace' }));
  expect(screen.getByText(/Sample workspace · fictional data/)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Your cloud, accounted for.' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Findings & scans' }));
  expect(screen.getByRole('heading', { name: 'Findings' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Integrations' }));
  expect(screen.getByRole('button', { name: 'Sign in to connect AWS' })).toBeInTheDocument();
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Sign in to connect AWS' }));
  expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeInTheDocument();
});

test('provider roadmap cannot pretend to connect unsupported clouds', () => {
  render(<Accounts token="token" accounts={[]} onRefresh={vi.fn()} />);
  expect(screen.getAllByRole('button', { name: 'Coming soon' })).toHaveLength(2);
  for (const button of screen.getAllByRole('button', { name: 'Coming soon' })) expect(button).toBeDisabled();
});

test('invalid role ARN is rejected before verification reaches AWS', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  render(<Accounts token="token" accounts={accounts} onRefresh={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Configure #1' }));
  fireEvent.change(screen.getByLabelText('Customer role ARN'), { target: { value: 'not-an-arn' } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Verify account' })); });
  expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid IAM role ARN');
  expect(fetcher).not.toHaveBeenCalled();
});

test('failed verification keeps setup available and does not claim success', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond({ detail: 'Role trust policy does not match.' }, 400)));
  render(<Accounts token="token" accounts={accounts} onRefresh={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Configure #1' }));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Verify account' })); });
  expect(screen.getByRole('alert')).toHaveTextContent('Role trust policy does not match.');
  expect(screen.queryByText('Account verified. You can now start a scan.')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Verify account' })).toBeEnabled();
});

test('successful verification offers the next step only after API confirmation', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond({ account_id: 1, verified: true })));
  const onScan = vi.fn();
  render(<Accounts token="token" accounts={accounts} onRefresh={vi.fn()} onScan={onScan} />);
  fireEvent.click(screen.getByRole('button', { name: 'Configure #1' }));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Verify account' })); });
  expect(screen.getByRole('status')).toHaveTextContent('Account verified.');
  fireEvent.click(screen.getByRole('button', { name: 'Continue to scans' }));
  expect(onScan).toHaveBeenCalledOnce();
});

test('findings search combines with existing filters and resets cleanly', () => {
  render(<FindingsTable findings={scan.findings} />);
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search findings' }), { target: { value: 'vol-expensive' } });
  expect(screen.queryByText('eip-cheap')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Severity'), { target: { value: 'low' } });
  expect(screen.getByText('No findings match these filters.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(screen.getByText('vol-expensive')).toBeInTheDocument();
  expect(screen.getByText('eip-cheap')).toBeInTheDocument();
});
