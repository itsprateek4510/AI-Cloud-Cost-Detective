import { useCallback, useEffect, useRef, useState } from 'react';
import { api, API_BASE_URL, type Account } from './api';
import { Accounts } from './pages/Accounts';
import { Scans } from './pages/Scans';
import { Report } from './pages/Report';
import { Overview } from './pages/Overview';
import { Brand, Icon, WEBSITE_URL } from './components/Brand';
import { ScanResults } from './components/ScanResults';
import { sampleScan } from './sample';

type Page = 'Overview' | 'Accounts' | 'Scans' | 'Report';
const destinations: { page: Page; label: string; icon: 'grid' | 'cloud' | 'scan' | 'report'; hash: string }[] = [
  { page: 'Overview', label: 'Overview', icon: 'grid', hash: 'overview' },
  { page: 'Accounts', label: 'Integrations', icon: 'cloud', hash: 'integrations' },
  { page: 'Scans', label: 'Findings & scans', icon: 'scan', hash: 'scans' },
  { page: 'Report', label: 'Reports', icon: 'report', hash: 'reports' },
];

export default function App() {
  const requestedScan = Number(new URLSearchParams(window.location.search).get('scan'));
  const initialScan = Number.isSafeInteger(requestedScan) && requestedScan > 0 ? requestedScan : null;
  const [token, setToken] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsVersion, setAccountsVersion] = useState(0);
  const [page, setPage] = useState<Page>(initialScan ? 'Report' : new URLSearchParams(window.location.search).get('demo') === '1' ? 'Overview' : 'Accounts');
  const [demo, setDemo] = useState(new URLSearchParams(window.location.search).get('demo') === '1');
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [scanId, setScanId] = useState<number | null>(initialScan);
  const [error, setError] = useState('');
  const [devLoggingIn, setDevLoggingIn] = useState(false);
  const popup = useRef<Window | null>(null);

  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.origin !== new URL(API_BASE_URL).origin || event.source !== popup.current
          || !popup.current || event.data?.type !== 'cost-detective-auth' || typeof event.data.access_token !== 'string') return;
      setToken(event.data.access_token);
      setDemo(false);
      setError('');
      popup.current.close(); popup.current = null;
    }
    window.addEventListener('message', receive);
    return () => { window.removeEventListener('message', receive); popup.current?.close(); };
  }, []);

  const refresh = useCallback(async () => { setAccountsVersion(version => version + 1); }, []);

  useEffect(() => {
    const sync = () => {
      const destination = destinations.find(item => `#${item.hash}` === window.location.hash);
      if (destination) setPage(destination.page);
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  function navigate(next: Page) {
    setPage(next);
    window.location.hash = destinations.find(item => item.page === next)!.hash;
  }

  function signOut() {
    setToken(''); setDemo(false); setAccounts([]); setScanId(null); setPage('Accounts'); setError('');
    window.history.replaceState({}, '', window.location.pathname);
  }

  useEffect(() => {
    if (!token) return;
    setLoadingAccounts(true);
    const controller = new AbortController();
    api<Account[]>('/accounts', token, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setAccounts(data);
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoadingAccounts(false); });
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
      setDemo(false);
    } catch (error) { setError(error instanceof Error ? error.message : 'Development login failed'); }
    finally { setDevLoggingIn(false); }
  }

  if (!token && !demo) return <div className="login-page">
    <header className="login-header"><Brand /><a href={WEBSITE_URL}>Back to website <Icon name="arrow" size={15} /></a></header>
    <main className="login-grid">
      <section className="login-story"><span className="badge neutral">YOUR CLOUD BILL, EXPLAINED</span><h1>Less cloud waste.<br /><span>More clarity.</span></h1><p>Your costs, the resources behind them, and a clear next step. All in one read-only workspace.</p>
        <div className="login-illustration" aria-hidden="true"><div className="illustration-cloud"><Icon name="cloud" size={48} /></div><div className="illustration-line" /><div className="illustration-nodes"><span>EC2</span><span>RDS</span><span>S3</span></div><div className="illustration-status"><Icon name="shield" size={15} /> Read-only access · no agents</div></div>
        <div className="login-proof"><span><Icon name="check" size={15} /> No stored AWS keys</span><span><Icon name="check" size={15} /> No automatic changes</span></div>
      </section>
      <section className="login-card"><span className="eyebrow">WELCOME TO CLOUDLEDGER</span><h2>Your workspace starts here.</h2><p>Sign in to connect your first AWS account.</p>
        {error && <p role="alert" className="error">{error}</p>}
        <button className="google-button" onClick={login}><span aria-hidden="true" className="google-g">G</span>Sign in with Google <Icon name="arrow" /></button>
        <div className="login-divider"><span>Want a look around first?</span></div>
        <button className="secondary" onClick={() => { setDemo(true); setError(''); navigate('Overview'); }}>Explore sample workspace <Icon name="arrow" /></button>
        <small>Fictional data. No sign-in or cloud access required.</small>
        {import.meta.env.VITE_DEV_AUTH_ENABLED === 'true' && <div className="dev-login"><button className="secondary" disabled={devLoggingIn} onClick={devLogin}>Continue with local development</button><small>Local development only. This token does not expire; disable DEV_AUTH_ENABLED to revoke development access.</small></div>}
        <p className="session-note"><Icon name="shield" size={16} /> Your session stays in memory. Refreshing requires signing in again.</p>
      </section>
    </main><footer className="login-footer">CloudLedger · See it. Explain it. Fix it.<a href={`${WEBSITE_URL}/trust`}>Our approach to trust <Icon name="arrow" size={14} /></a></footer>
  </div>;

  return <div className="workspace">
    <a className="skip-link" href="#workspace-main">Skip to content</a>
    <aside className="sidebar"><Brand /><div className="workspace-switch"><span className="workspace-avatar">{demo ? 'N' : 'C'}</span><div><strong>{demo ? 'Northwind Labs' : 'My workspace'}</strong><small>{demo ? 'Sample workspace' : 'AWS cloud costs'}</small></div><span className="workspace-indicator">⌄</span></div>
      <p className="nav-label">WORKSPACE</p><nav aria-label="Main navigation">{destinations.map(item => <button key={item.page} className={`nav-item ${page === item.page ? 'active' : ''}`} aria-label={item.label} aria-current={page === item.page ? 'page' : undefined} onClick={() => navigate(item.page)}><Icon name={item.icon} />{item.label}{item.page === 'Accounts' && <span className="nav-count">{accounts.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><a className="nav-item" href={`${WEBSITE_URL}/docs`}><Icon name="book" />Documentation <Icon name="arrow" size={14} /></a><div className="sidebar-note"><Icon name="shield" /><strong>Built to observe.</strong><p>Your cloud stays in your control.</p></div><button className="nav-item" onClick={signOut}><Icon name="logout" />{demo ? 'Exit sample workspace' : 'Sign out'}</button></div>
    </aside>
    <div className="workspace-body"><header className="workspace-header"><div className="breadcrumb">Workspace <span>/</span><strong>{destinations.find(item => item.page === page)?.label}</strong></div><div className="header-right"><span className="read-only"><i /> Read-only</span><span className="user-avatar">{demo ? 'NL' : 'CL'}</span></div></header>
      {demo && <div className="demo-banner"><span><strong>Sample workspace · fictional data.</strong> Explore the product without connecting AWS.</span><button className="text-button" onClick={signOut}>Connect your own account <Icon name="arrow" size={15} /></button></div>}
      <main id="workspace-main" className="workspace-main">
        {error && <div className="error" role="alert">{error}<button className="secondary" onClick={() => { setError(''); void refresh(); }}>Retry loading accounts</button></div>}
        {loadingAccounts && <p role="status" className="loading-state">Loading your connections…</p>}
        {page === 'Overview' && <Overview token={token} accounts={accounts} scanId={scanId} demo={demo} onConnect={() => navigate('Accounts')} onScan={() => navigate('Scans')} onFindings={() => navigate('Scans')} />}
        {page === 'Accounts' && <Accounts token={token} accounts={accounts} onRefresh={refresh} onScan={() => navigate('Scans')} demo={demo} onSignIn={signOut} />}
        {page === 'Scans' && (demo ? <div className="page-stack"><div className="page-heading"><div><p className="eyebrow">FROM EVIDENCE TO ACTION</p><h1>Review your cloud waste.</h1><p>Fictional findings with transparent, illustrative savings.</p></div></div><ScanResults scan={sampleScan} /></div> : <Scans token={token} accounts={accounts} scanId={scanId} onScan={setScanId} onConnect={() => navigate('Accounts')} onReport={() => navigate('Report')} />)}
        {page === 'Report' && (demo ? <div className="page-stack"><div className="page-heading"><div><p className="eyebrow">SAMPLE REPORT</p><h1>Scan report</h1><p>Fictional data. An example of the evidence behind each recommendation.</p></div></div><section className="panel"><h2>A small cleanup, a clearer bill.</h2><p className="mt-3">Three sample findings suggest $93.99 in potential monthly savings. Review volume ownership, instance dependencies, and IP allowlists before making changes. These are estimates, not realized savings.</p></section><ScanResults scan={sampleScan} /></div> : <Report token={token} scanId={scanId} onScan={() => navigate('Scans')} />)}
      </main><footer className="workspace-footer"><span>CloudLedger</span><span>Read-only by design. Every finding, backed by evidence.</span></footer>
    </div>
  </div>;
}
