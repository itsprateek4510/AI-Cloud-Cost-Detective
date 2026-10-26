import { useState } from 'react';
import { type Finding, money } from '../api';

export function FindingsTable({ findings }: { findings: Finding[] }) {
  const [severity, setSeverity] = useState('');
  const [region, setRegion] = useState('');
  const [query, setQuery] = useState('');
  const regions = [...new Set(findings.map(f => f.region))].sort();
  const filtered = findings.filter(f => (!severity || f.severity === severity) && (!region || f.region === region)
    && `${f.resource_id} ${f.title} ${f.rule_id}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => Number(b.savings_monthly) - Number(a.savings_monthly) || a.id - b.id);

  return <section className="panel findings-panel">
    <div className="panel-heading"><div><h2>Findings</h2><p>Review recommendations before changing a resource.</p></div><span className="badge neutral">{filtered.length} of {findings.length}</span></div>
    <div className="flex flex-wrap items-end gap-4 mb-5">
      <label className="findings-search">Search findings<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Resource, finding, or rule…" /></label>
      <label>Severity<select value={severity} onChange={e => setSeverity(e.target.value)}>
        <option value="">All severities</option>
        {['high', 'medium', 'low'].map(s => <option key={s} value={s}>{s}</option>)}
      </select></label>
      {(query || severity || region) && <button className="secondary" onClick={() => { setQuery(''); setSeverity(''); setRegion(''); }}>Clear filters</button>}
      <label>Region<select value={region} onChange={e => setRegion(e.target.value)}>
        <option value="">All regions</option>
        {regions.map(r => <option key={r}>{r}</option>)}
      </select></label>
    </div>
    {filtered.length ? <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Findings table"><table>
      <thead><tr><th>Resource / finding</th><th>Severity</th><th>Region</th><th>Est. monthly savings</th></tr></thead>
      <tbody>{filtered.map(f => <tr key={f.id} id={`finding-${f.id}`} className="target:outline target:outline-2 target:outline-emerald-400">
        <td><strong className="break-all resource-id">{f.resource_id}</strong><p className="finding-title">{f.title}</p><details className="finding-evidence"><summary>View evidence</summary><p className="text-sm text-slate-400">{f.description}</p>
          {typeof f.details.pricing_note === 'string' && <p className="text-xs text-slate-400 mt-1">{f.details.pricing_note}</p>}</details></td>
        <td><span className={`badge ${f.severity}`}>{f.severity}</span></td><td>{f.region}</td><td>{money(f.savings_monthly)}</td>
      </tr>)}</tbody>
    </table></div> : <p>No findings match these filters.</p>}
  </section>;
}
