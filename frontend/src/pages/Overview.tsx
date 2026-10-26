import { money, type Account, type Scan } from '../api';
import { Icon } from '../components/Brand';
import { SpendHistory } from '../components/SpendHistory';
import { useScan } from '../hooks/useScan';
import { sampleScan, sampleSpend } from '../sample';

export function Overview({ token, accounts, scanId, demo, onConnect, onScan, onFindings }: {
  token: string; accounts: Account[]; scanId: number | null; demo: boolean;
  onConnect: () => void; onScan: () => void; onFindings: () => void;
}) {
  const { scan: liveScan, error } = useScan(token, demo ? null : scanId);
  const scan: Scan | null = demo ? sampleScan : liveScan;
  const verified = accounts.filter(account => account.verified_at && account.role_arn);
  return <div className="page-stack">
    <div className="page-heading"><div><p className="eyebrow">CLOUD COST INTELLIGENCE</p><h1>Your cloud, accounted for.</h1><p>A clear view of your spend. A practical place to start saving.</p></div>
      <button onClick={demo ? onFindings : verified.length ? onScan : onConnect}><Icon name={verified.length ? 'scan' : 'link'} />{demo ? 'Explore findings' : verified.length ? 'Start a scan' : 'Connect an integration'}</button>
    </div>
    {error && <p role="alert" className="error">{error}</p>}
    <div className="metric-grid">
      <article className="metric-card"><span className="metric-label">{demo ? 'September spend · sample' : 'Verified AWS connections'}</span><strong>{demo ? '$584.00' : verified.length}</strong><span className="metric-note">{demo ? 'Fictional billing data' : 'Read-only IAM roles'}</span><Icon name="cloud" /></article>
      <article className="metric-card"><span className="metric-label">Estimated monthly savings</span><strong>{scan ? money(scan.totals.savings_monthly) : '—'}</strong><span className="metric-note">{scan ? 'Potential savings · not realized' : 'Available after your first scan'}</span><Icon name="report" /></article>
      <article className="metric-card"><span className="metric-label">Findings to review</span><strong>{scan ? scan.totals.findings_count : '—'}</strong><span className="metric-note">{scan ? `Latest scan · ${scan.status}` : 'Eight deterministic AWS checks'}</span><Icon name="scan" /></article>
    </div>
    <div className="overview-grid">
      {demo ? <section className="panel spend-chart"><div className="panel-heading"><div><h2>Cloud spend</h2><p>Monthly total · USD · fictional sample</p></div><span className="badge neutral">Apr – Sep 2026</span></div>
        <div className="chart-total">$584<span> / September</span></div>
        <div className="bar-chart" role="img" aria-label={sampleSpend.map(point => `${point.month}: $${point.amount}`).join(', ')}>
          {sampleSpend.map(point => <div className="chart-column" key={point.month}><span>{money(String(point.amount))}</span><i style={{ height: `${point.amount / 8}px` }} /><small>{point.month}</small></div>)}
        </div><div className="chart-legend"><i /> Amazon Web Services <span>Historical spend ≠ estimated savings</span></div>
      </section> : verified.length ? <SpendHistory key={verified[0].id} token={token} accountId={verified[0].id} /> : <section className="panel empty-state"><span className="empty-symbol"><Icon name="cloud" size={32} /></span><h2>Your first connection starts here.</h2><p>Connect an AWS account to bring cost history and waste findings into one place.</p><button onClick={onConnect}>Connect AWS <Icon name="arrow" /></button><small>No access keys. No agents.</small></section>}
      <section className="insight-card"><span className="insight-icon"><Icon name="shield" size={24} /></span><p className="eyebrow">CONTROL STAYS WITH YOU</p><h2>Find the waste.<br />Keep the control.</h2><p>Every finding comes from a deterministic check. Review the evidence before you make a change.</p><ul><li><Icon name="check" /> Read-only AWS access</li><li><Icon name="check" /> Code-calculated savings</li><li><Icon name="check" /> No automatic deletions</li></ul><button className="light-button" onClick={onConnect}>View integrations <Icon name="arrow" /></button></section>
    </div>
    <section className="panel"><div className="panel-heading"><div><h2>Your next best actions</h2><p>{scan ? 'Ordered by estimated monthly savings.' : 'Three steps from a cloud account to a clear finding.'}</p></div>{scan && <button className="text-button" onClick={onFindings}>View findings <Icon name="arrow" /></button>}</div>
      {scan ? scan.findings.slice().sort((a, b) => Number(b.savings_monthly) - Number(a.savings_monthly)).slice(0, 3).map(finding => <div className="action-row" key={finding.id}><span className={`status-dot ${finding.severity}`} /><div><strong>{finding.title}</strong><p>{finding.resource_id} · {finding.region}</p></div><strong className="action-amount">{money(finding.savings_monthly)}<small> / month</small></strong></div>) : <div className="getting-started">{[
        { title: 'Connect your account', text: 'Create a dedicated read-only AWS role.', action: onConnect },
        { title: 'Run your first scan', text: 'Check resources across enabled regions.', action: onScan },
        { title: 'Review the evidence', text: 'Prioritize findings by estimated savings.', action: onFindings },
      ].map((step, index) => <button className="setup-card" key={step.title} onClick={step.action}><span>0{index + 1}</span><strong>{step.title}</strong><p>{step.text}</p><Icon name="arrow" /></button>)}</div>}
      {scan && !scan.findings.length && <p className="empty-inline">No findings in this scan. Review scan coverage before drawing conclusions.</p>}
    </section>
  </div>;
}
