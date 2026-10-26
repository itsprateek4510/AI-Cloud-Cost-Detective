import { useState } from 'react';
import { api, type Account } from '../api';
import { ScanResults } from '../components/ScanResults';
import { useScan } from '../hooks/useScan';
import { Icon } from '../components/Brand';

interface Props { token: string; accounts: Account[]; scanId: number | null; onScan: (id: number) => void; onConnect?: () => void; onReport?: () => void }

export function Scans({ token, accounts, scanId, onScan, onConnect, onReport }: Props) {
  const verified = accounts.filter(a => a.verified_at && a.role_arn);
  const [selected, setSelected] = useState('');
  const accountId = verified.some(a => String(a.id) === selected) ? selected : String(verified[0]?.id || '');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const { scan, error: pollError } = useScan(token, scanId);
  const active = scanId !== null && (!scan || scan.status === 'pending' || scan.status === 'running');

  async function start() {
    setStarting(true);
    setError('');
    try {
      const result = await api<{ scan_id: number }>('/scans', token, { method: 'POST', body: JSON.stringify({ account_id: Number(accountId) }) });
      onScan(result.scan_id);
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to start scan'); }
    finally { setStarting(false); }
  }

  return <div className="page-stack">
    <div className="page-heading"><div><p className="eyebrow">FROM EVIDENCE TO ACTION</p><h1>Review your cloud waste.</h1><p>Find idle resources. Understand the cost. Decide what happens next.</p></div>{scan?.status === 'completed' && onReport && <button className="secondary" onClick={onReport}>Open report <Icon name="arrow" /></button>}</div>
    <section className="panel">
      <h2>Scan your AWS account</h2>
      <p className="text-slate-400 my-3">Eight read-only checks across enabled regions. Start explicitly; page loads never trigger a scan.</p>
      <div className="flex flex-wrap items-end gap-4">
        <label className="account-select">AWS account<select value={accountId} onChange={e => setSelected(e.target.value)} disabled={starting || active}>
          {!verified.length && <option value="">No verified accounts</option>}
          {verified.map(a => <option key={a.id} value={a.id}>#{a.id} · {a.role_arn}</option>)}
        </select></label>
        <button onClick={start} disabled={!accountId || starting || active}>{starting ? 'Queuing…' : 'Start Scan'}</button>
      </div>
      {!verified.length && <p className="mt-3">Connect and verify an account on the Accounts page first.</p>}
      {!verified.length && onConnect && <button className="text-button mt-3" onClick={onConnect}>Connect an integration <Icon name="arrow" /></button>}
    </section>
    {scanId === null && <section className="panel empty-state"><span className="empty-symbol"><Icon name="scan" size={30} /></span><h2>Good decisions start with evidence.</h2><p>Start a scan to check EBS volumes, EC2 instances, Elastic IPs, NAT gateways, log retention, load balancers, snapshots, and development RDS.</p><small>Scans only read metadata and metrics. They never change your resources.</small></section>}
    {(error || pollError) && <p role="alert" className="error">{error || pollError}</p>}
    {scanId !== null && !scan && !pollError && <p role="status">Loading scan…</p>}
    {scan && <ScanResults scan={scan} />}
  </div>;
}
