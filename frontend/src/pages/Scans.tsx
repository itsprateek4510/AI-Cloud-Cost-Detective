import { useState } from 'react';
import { api, type Account } from '../api';
import { ScanResults } from '../components/ScanResults';
import { useScan } from '../hooks/useScan';

interface Props { token: string; accounts: Account[]; scanId: number | null; onScan: (id: number) => void }

export function Scans({ token, accounts, scanId, onScan }: Props) {
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

  return <div className="space-y-6">
    <section className="panel">
      <h1>Scan your AWS account</h1>
      <p className="text-slate-400 my-3">Eight read-only checks across enabled regions. Start explicitly; page loads never trigger a scan.</p>
      <div className="flex flex-wrap items-end gap-4">
        <label>AWS account<select value={accountId} onChange={e => setSelected(e.target.value)} disabled={starting || active}>
          {!verified.length && <option value="">No verified accounts</option>}
          {verified.map(a => <option key={a.id} value={a.id}>#{a.id} · {a.role_arn}</option>)}
        </select></label>
        <button onClick={start} disabled={!accountId || starting || active}>{starting ? 'Queuing…' : 'Start Scan'}</button>
      </div>
      {!verified.length && <p className="mt-3">Connect and verify an account on the Accounts page first.</p>}
    </section>
    {(error || pollError) && <p role="alert" className="error">{error || pollError}</p>}
    {scanId !== null && !scan && !pollError && <p role="status">Loading scan…</p>}
    {scan && <ScanResults scan={scan} />}
  </div>;
}
