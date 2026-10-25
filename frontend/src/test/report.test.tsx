import { act, fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { Report } from '../pages/Report';
import { scan } from './fixtures';

const summary = {
  scan_id: 10, ai_summary_unavailable: false,
  report: { executive_summary: 'Review unused storage and addresses.', top_actions: [
    { title: 'Review storage', why: 'Storage is unattached.', fix_hint: 'Confirm ownership before deletion.', finding_ids: [2] },
    { title: 'Review addresses', why: 'An address is unused.', fix_hint: 'Confirm dependencies before release.', finding_ids: [1] },
  ], risks: ['Review workload requirements before changes.'] },
};

function respond(data: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => data } as Response;
}

test('cached summary renders actions, risks and finding links without generating again', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(respond(scan)).mockResolvedValueOnce(respond(summary));
  vi.stubGlobal('fetch', fetcher);
  render(<Report token="token" scanId={10} />);
  await act(async () => {});
  expect(screen.getByText(summary.report.executive_summary)).toBeInTheDocument();
  expect(screen.getByText('Confirm ownership before deletion.')).toBeInTheDocument();
  expect(screen.getByText(summary.report.risks[0])).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /vol-expensive/ })).toHaveAttribute('href', '#finding-2');
  expect(document.getElementById('finding-2')).toBeInTheDocument();
  expect(screen.getByRole('table')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Severity'), { target: { value: 'low' } });
  expect(document.getElementById('finding-2')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: /vol-expensive/ }));
  expect(document.getElementById('finding-2')).toBeInTheDocument();
  expect(fetcher.mock.calls.every(call => call[1]?.method !== 'POST')).toBe(true);
});

test('generating an uncached summary is explicit and keeps findings visible', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(respond(scan))
    .mockResolvedValueOnce(respond({ detail: 'Not generated' }, 404)).mockResolvedValueOnce(respond(summary));
  vi.stubGlobal('fetch', fetcher);
  render(<Report token="token" scanId={10} />);
  await act(async () => {});
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('table')).toBeInTheDocument();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Generate AI summary' })); });
  expect(fetcher.mock.calls[2][0]).toContain('/scans/10/report');
  expect(fetcher.mock.calls[2][1].method).toBe('POST');
  expect(screen.getByText(summary.report.executive_summary)).toBeInTheDocument();
});

test('Gemini disabled or unavailable never hides findings or code-calculated totals', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(respond(scan))
    .mockResolvedValueOnce(respond({}, 404))
    .mockResolvedValueOnce(respond({ scan_id: 10, ai_summary_unavailable: true, report: null }));
  vi.stubGlobal('fetch', fetcher);
  render(<Report token="token" scanId={10} />);
  await act(async () => {});
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Generate AI summary' })); });
  expect(screen.getByText(/AI summary unavailable/)).toBeInTheDocument();
  expect(screen.getByText('$11.65')).toBeInTheDocument();
  expect(screen.getByRole('table')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Retry AI summary' })).toBeInTheDocument();
});

test('pending and failed scans do not request Gemini reports', async () => {
  const fetcher = vi.fn().mockResolvedValue(respond({ ...scan, status: 'failed', error_message: 'Scan failed.' }));
  vi.stubGlobal('fetch', fetcher);
  render(<Report token="token" scanId={10} />);
  await act(async () => {});
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: 'Generate AI summary' })).not.toBeInTheDocument();
});
