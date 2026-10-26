import { useState } from 'react';
import { api, type Account } from '../api';
import { Icon } from '../components/Brand';
import template from '../assets/customer-role.yaml?raw';

interface CreatedAccount { id: number; external_id: string; role_arn: string | null; guidance: string; template_path: string }

export function Accounts({ token, accounts, onRefresh, onScan, demo = false, onSignIn }: {
  token: string; accounts: Account[]; onRefresh: () => Promise<void>;
  onScan?: () => void; demo?: boolean; onSignIn?: () => void;
}) {
  const [selected, setSelected] = useState<Account | CreatedAccount | null>(null);
  const [roleArn, setRoleArn] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const principal = import.meta.env.VITE_AWS_TRUSTED_PRINCIPAL_ARN;

  async function create() {
    if (demo) { onSignIn?.(); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      const data = await api<CreatedAccount>('/accounts', token, { method: 'POST', body: '{}' });
      setSelected(data); setRoleArn(''); setCopied(false);
      await onRefresh();
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to create connection'); }
    finally { setBusy(false); }
  }

  async function verify() {
    if (!selected || demo) return;
    if (!/^arn:aws(?:-us-gov|-cn)?:iam::\d{12}:role\/[\w+=,.@\/-]+$/.test(roleArn.trim())) {
      setError('Enter a valid IAM role ARN, such as arn:aws:iam::123456789012:role/ReadOnly.');
      return;
    }
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await api<{ verified: boolean }>('/accounts/verify', token, { method: 'POST', body: JSON.stringify({
        account_id: selected.id, role_arn: roleArn.trim(), external_id: selected.external_id,
      }) });
      if (!result.verified) throw new Error('AWS access could not be verified. Check the role and try again.');
      setMessage('Account verified. You can now start a scan.');
      await onRefresh();
    } catch (error) { setError(error instanceof Error ? error.message : 'Verification failed'); }
    finally { setBusy(false); }
  }

  async function copyExternalId() {
    if (!selected) return;
    try { await navigator.clipboard.writeText(selected.external_id); setCopied(true); }
    catch { setError('Clipboard access is unavailable. Select and copy the ExternalId below.'); }
  }

  return <div className="page-stack">
    <div className="page-heading"><div><p className="eyebrow">YOUR CLOUD, CONNECTED</p><h1>Connect an integration.</h1><p>Bring your cloud costs into focus. Start with read-only AWS access.</p></div><span className="badge verified"><Icon name="shield" size={14} /> Read-only by design</span></div>
    <div className="integration-grid">
      <article className="panel integration-card"><div className="panel-heading"><span className="provider-logo aws">aws<span>⌣</span></span><span className="badge verified">Available now</span></div><h2>Amazon Web Services</h2><p>Cost history, resource-level findings, and savings estimates. Connected through a dedicated IAM role.</p><div className="provider-tags"><span>Cost Explorer</span><span>8 waste checks</span></div><button onClick={create} disabled={busy || !!selected}>{demo ? 'Sign in to connect AWS' : busy ? 'Creating connection…' : 'Create AWS connection'}<Icon name="arrow" /></button></article>
      {['Microsoft Azure', 'Google Cloud'].map((provider, index) => <article className="panel integration-card upcoming" key={provider}><div className="panel-heading"><span className={`provider-logo ${index ? 'gcp' : 'azure'}`}>{index ? 'G' : 'A'}</span><span className="badge neutral">On the roadmap</span></div><h2>{provider}</h2><p>{index ? 'A unified view of your projects, services, and Google Cloud spend.' : 'Bring subscriptions and Azure resource costs into your workspace.'}</p><div className="provider-tags"><span>Multi-cloud visibility</span></div><button className="secondary" disabled>Coming soon</button></article>)}
    </div>
    {error && <p role="alert" className="error">{error}</p>}
    {selected && <section className="panel connection-setup" aria-labelledby="connection-heading">
      <div className="panel-heading"><div><p className="eyebrow">AWS CONNECTION · #{selected.id}</p><h2 id="connection-heading">A secure connection in three steps.</h2></div><button className="secondary" disabled={busy} onClick={() => { setSelected(null); setMessage(''); setError(''); }}>Close setup</button></div>
      <ol className="connection-steps">
        <li><span className="step-number">1</span><div><h3>Deploy the read-only role</h3><p>Download the CloudFormation template and upload it when creating a stack in your AWS account. Review the listed permissions before deployment.</p><a className="button secondary" download="cloudledger-readonly.yaml" href={`data:text/yaml;charset=utf-8,${encodeURIComponent(template)}`}>Download IAM template <Icon name="arrow" /></a><p className="field-hint">In CloudFormation, choose Create stack → Upload a template file.</p></div></li>
        <li><span className="step-number">2</span><div><h3>Use your connection parameters</h3><p>Set <code>ExternalId</code> to this exact server-generated value.</p><div className="copy-field"><code>{selected.external_id}</code><button className="secondary" onClick={copyExternalId}>{copied ? 'Copied' : 'Copy ExternalId'}</button></div><p>Set <code>TrustedPrincipalArn</code> to {principal ? <code className="principal">{principal}</code> : 'the CloudLedger operator’s AWS execution-role ARN. Ask your operator for this value before deploying the stack.'}</p></div></li>
        <li><span className="step-number">3</span><div><h3>Verify the connection</h3><p>Copy the <code>RoleArn</code> from your stack’s Outputs tab. We will verify access using AWS STS.</p><form onSubmit={event => { event.preventDefault(); void verify(); }}><label>Customer role ARN<input value={roleArn} onChange={e => { setRoleArn(e.target.value); setMessage(''); }} placeholder="arn:aws:iam::123456789012:role/ReadOnly" disabled={busy} autoComplete="off" spellCheck={false} /></label><button disabled={busy || !roleArn.trim()} type="submit">{busy ? 'Verifying access…' : 'Verify account'}<Icon name="shield" /></button></form></div></li>
      </ol>
      {message && <div className="success"><p role="status">{message}</p>{onScan && <button onClick={onScan}>Continue to scans <Icon name="arrow" /></button>}</div>}
    </section>}
    <section className="panel"><div className="panel-heading"><div><h2>Your connections</h2><p>{accounts.length ? `${accounts.length} AWS connection${accounts.length === 1 ? '' : 's'} in this workspace` : 'Connections appear here after you begin AWS setup.'}</p></div><span className="badge neutral">{accounts.filter(a => a.verified_at).length} verified</span></div>
      {accounts.length ? <ul className="connection-list">{accounts.map(account => <li key={account.id}><span className="connection-icon"><Icon name="cloud" /></span><div><strong>AWS account #{account.id}</strong><p>{account.role_arn || 'Finish configuring your read-only role'}</p></div><span className={`badge ${account.verified_at ? 'verified' : 'neutral'}`}>{account.verified_at ? 'Verified' : 'Setup needed'}</span><button className="secondary" disabled={busy} onClick={() => { setSelected(account); setRoleArn(account.role_arn || ''); setMessage(''); setError(''); setCopied(false); }}>Configure #{account.id}</button></li>)}</ul> : <div className="empty-inline"><Icon name="link" size={24} /><p>No cloud accounts connected yet.<br /><small>{demo ? 'Sign in to connect your own account. Sample data never creates a connection.' : 'Choose AWS above to get started. Your infrastructure stays in your control.'}</small></p></div>}
    </section>
    <div className="security-note"><Icon name="shield" /><p>We use a dedicated role and a unique ExternalId. No access keys are stored, and CloudLedger cannot change your cloud resources.</p></div>
  </div>;
}
