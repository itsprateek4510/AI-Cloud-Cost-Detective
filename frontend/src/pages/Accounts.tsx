import { useState } from 'react';
import { api, type Account } from '../api';

interface CreatedAccount { id: number; external_id: string; role_arn: string | null; guidance: string; template_path: string }

export function Accounts({ token, accounts, onRefresh }: { token: string; accounts: Account[]; onRefresh: () => Promise<void> }) {
  const [selected, setSelected] = useState<Account | CreatedAccount | null>(null);
  const [roleArn, setRoleArn] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function create() {
    setBusy(true); setError(''); setMessage('');
    try {
      const data = await api<CreatedAccount>('/accounts', token, { method: 'POST', body: '{}' });
      setSelected(data); setRoleArn('');
      await onRefresh();
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to create connection'); }
    finally { setBusy(false); }
  }

  async function verify() {
    if (!selected) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await api('/accounts/verify', token, { method: 'POST', body: JSON.stringify({
        account_id: selected.id, role_arn: roleArn.trim(), external_id: selected.external_id,
      }) });
      setMessage('Account verified. You can now start a scan.');
      await onRefresh();
    } catch (error) { setError(error instanceof Error ? error.message : 'Verification failed'); }
    finally { setBusy(false); }
  }

  return <div className="space-y-6">
    <section className="panel">
      <h1>AWS accounts</h1>
      <p className="text-slate-400 my-3">Connect with a read-only role and ExternalId. Never enter AWS access keys.</p>
      <button onClick={create} disabled={busy}>Create AWS connection</button>
      <ul className="mt-5 space-y-3">{accounts.map(account => <li key={account.id} className="flex flex-wrap gap-3 items-center">
        <span className="break-all">#{account.id} · {account.role_arn || 'Role not configured'} · {account.verified_at ? 'Verified' : 'Unverified'}</span>
        <button className="secondary" disabled={busy} onClick={() => { setSelected(account); setRoleArn(account.role_arn || ''); setMessage(''); setError(''); }}>Configure #{account.id}</button>
      </li>)}</ul>
    </section>
    {selected && <section className="panel space-y-4">
      <h2>Connect account #{selected.id}</h2>
      <p>Deploy <code>infra/customer-role.yaml</code> in your AWS account. Set <code>TrustedPrincipalArn</code> to the app operator's AWS execution-role ARN, and <code>ExternalId</code> to:</p>
      <code className="block break-all bg-slate-950 p-3 rounded">{selected.external_id}</code>
      <p>Use the stack's RoleArn output below. The app's execution identity also needs sts:AssumeRole permission. See README.md for deployment details.</p>
      <label>Customer role ARN<input value={roleArn} onChange={e => setRoleArn(e.target.value)} placeholder="arn:aws:iam::123456789012:role/ReadOnly" /></label>
      <button disabled={busy || !roleArn.trim()} onClick={verify}>Verify account</button>
    </section>}
    {error && <p role="alert" className="error">{error}</p>}
    {message && <p role="status" className="text-emerald-300">{message}</p>}
  </div>;
}
