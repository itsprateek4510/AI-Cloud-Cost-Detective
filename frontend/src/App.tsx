import { useCallback, useEffect, useRef, useState } from 'react';
import { api, API_BASE_URL, type Account } from './api';
import { Accounts } from './pages/Accounts';
import { Scans } from './pages/Scans';
import { Report } from './pages/Report';

export default function App() {
  const requestedScan = Number(new URLSearchParams(window.location.search).get('scan'));
  const initialScan = Number.isSafeInteger(requestedScan) && requestedScan > 0 ? requestedScan : null;
  const [token, setToken] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsVersion, setAccountsVersion] = useState(0);
  const [page, setPage] = useState<'Accounts' | 'Scans' | 'Report'>(initialScan ? 'Report' : 'Accounts');
  const [scanId, setScanId] = useState<number | null>(initialScan);
  const [error, setError] = useState('');
  const [devLoggingIn, setDevLoggingIn] = useState(false);
  const popup = useRef<Window | null>(null);

  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.origin !== new URL(API_BASE_URL).origin || event.source !== popup.current
          || !popup.current || event.data?.type !== 'cost-detective-auth' || typeof event.data.access_token !== 'string') return;
      setToken(event.data.access_token);
      setError('');
      popup.current.close(); popup.current = null;
    }
    window.addEventListener('message', receive);
    return () => { window.removeEventListener('message', receive); popup.current?.close(); };
  }, []);

  const refresh = useCallback(async () => { setAccountsVersion(version => version + 1); }, []);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    api<Account[]>('/accounts', token, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setAccounts(data);
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [token, accountsVersion]);

  function login() {
    popup.current?.close();
    popup.current = window.open(`${API_BASE_URL}/auth/google/login?popup=1`, 'cost-detective-login', 'width=520,height=680');
    if (!popup.current) setError('Allow popups for Google sign-in, then try again.');
  }

  async function devLogin() {
    setDevLoggingIn(true); setError('');
    try {
      const result = await api<{ access_token: string }>('/auth/dev/login', '', { method: 'POST' });
      setToken(result.access_token);
    } catch (error) { setError(error instanceof Error ? error.message : 'Development login failed'); }
    finally { setDevLoggingIn(false); }
  }

  return <div className="max-w-7xl mx-auto p-5 md:p-10">
    <header className="flex flex-wrap items-center gap-5 mb-10">
      <strong className="text-xl mr-auto">AWS Cost Detective</strong>
      {token && <><nav className="flex gap-2" aria-label="Main navigation">{(['Accounts', 'Scans', 'Report'] as const).map(name =>
        <button key={name} className={page === name ? '' : 'secondary'} onClick={() => setPage(name)}>{name}</button>)}</nav>
        <button className="secondary" onClick={() => { setToken(''); setAccounts([]); setScanId(null); setPage('Accounts'); setError(''); }}>Sign out</button></>}
    </header>
    {error && <p role="alert" className="error mb-5">{error}</p>}
    {!token ? <main className="panel max-w-xl mx-auto mt-20">
      <h1>Find cloud waste. Keep control.</h1>
      <p className="my-5 text-slate-400">Read-only AWS checks, deterministic savings estimates, and no automatic deletions.</p>
      <button onClick={login}>Sign in with Google</button>
      {import.meta.env.VITE_DEV_AUTH_ENABLED === 'true' && <div className="mt-5 space-y-2">
        <button className="secondary" disabled={devLoggingIn} onClick={devLogin}>Continue with local development</button>
        <p className="text-sm text-amber-200">Local development only. This token does not expire; disable DEV_AUTH_ENABLED to revoke development access.</p>
      </div>}
      <p className="mt-4 text-sm text-slate-400">Your session stays in memory. Refreshing this page requires signing in again.</p>
    </main> : <main>
      {page === 'Accounts' && <Accounts token={token} accounts={accounts} onRefresh={refresh} />}
      {page === 'Scans' && <Scans token={token} accounts={accounts} scanId={scanId} onScan={setScanId} />}
      {page === 'Report' && <Report token={token} scanId={scanId} />}
    </main>}
  </div>;
}
