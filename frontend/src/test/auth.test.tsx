import { act, fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import App from '../App';
import { scan } from './fixtures';

test('login accepts messages only from the backend and the opened popup', async () => {
  const storage = { setItem: vi.fn(), getItem: vi.fn() };
  vi.stubGlobal('localStorage', storage);
  const popup = { close: vi.fn() };
  vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
  vi.stubGlobal('fetch', fetcher);
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }));

  function send(origin: string, source: unknown) {
    const event = new MessageEvent('message', { origin, data: { type: 'cost-detective-auth', access_token: 'test-token' } });
    Object.defineProperty(event, 'source', { value: source });
    window.dispatchEvent(event);
  }

  await act(async () => { send('https://attacker.example', popup); });
  await act(async () => { send('http://localhost:8000', {}); });
  expect(fetcher).not.toHaveBeenCalled();
  await act(async () => { send('http://localhost:8000', popup); });
  expect(screen.getByRole('button', { name: 'Create AWS connection' })).toBeInTheDocument();
  expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token');
  expect(storage.setItem).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeInTheDocument();
});

test('blocked popups produce actionable sign-in feedback', () => {
  vi.spyOn(window, 'open').mockReturnValue(null);
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Allow popups');
});

test('weekly report links open the requested scan after normal sign-in', async () => {
  const original = window.location.pathname + window.location.search;
  window.history.replaceState({}, '', '/?scan=10');
  const popup = { close: vi.fn() };
  vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.endsWith('/accounts')) return { ok: true, json: async () => [] };
    if (url.endsWith('/scans/10')) return { ok: true, json: async () => scan };
    return { ok: false, status: 404, json: async () => ({ detail: 'No cached report' }) };
  }));
  try {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }));
    const event = new MessageEvent('message', { origin: 'http://localhost:8000', data: { type: 'cost-detective-auth', access_token: 'test-token' } });
    Object.defineProperty(event, 'source', { value: popup });
    await act(async () => { window.dispatchEvent(event); });
    expect(screen.getByRole('heading', { name: 'Scan report' })).toBeInTheDocument();
    expect(screen.getByText('Scan #10')).toBeInTheDocument();
  } finally { window.history.replaceState({}, '', original); }
});

test('explicit development mode can skip Google without opening a popup', async () => {
  vi.stubEnv('VITE_DEV_AUTH_ENABLED', 'true');
  const open = vi.spyOn(window, 'open');
  const fetcher = vi.fn(async (url: string) => ({ ok: true, json: async () => url.endsWith('/auth/dev/login') ? { access_token: 'dev-token' } : [] }));
  vi.stubGlobal('fetch', fetcher);
  try {
    render(<App />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Continue with local development' })); });
    expect(screen.getByRole('button', { name: 'Create AWS connection' })).toBeInTheDocument();
    expect(open).not.toHaveBeenCalled();
    expect(fetcher.mock.calls[0][0]).toContain('/auth/dev/login');
  } finally { vi.unstubAllEnvs(); }
});
