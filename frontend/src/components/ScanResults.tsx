import { money, type Scan } from '../api';
import { FindingsTable } from './FindingsTable';

export function ScanResults({ scan }: { scan: Scan }) {
  return <div className="space-y-6">
    <section className="panel" aria-live="polite">
      <h2>Scan #{scan.scan_id}</h2>
      <p className="capitalize my-3">{scan.status} · {scan.progress}%</p>
      <progress aria-label="Scan progress" value={scan.progress} max={100} className="w-full" />
      {scan.error_message && <p role="alert" className="error mt-3">{scan.error_message}</p>}
      <div className="flex flex-wrap gap-10 mt-5">
        <div><p className="text-slate-400">Findings</p><strong className="text-3xl">{scan.totals.findings_count}</strong></div>
        <div><p className="text-slate-400">Estimated monthly savings (USD)</p><strong className="text-3xl text-emerald-300">{money(scan.totals.savings_monthly)}</strong></div>
      </div>
      <p className="text-sm text-slate-400 mt-4">Estimates use configured prices, not a live billing quote. Zero may mean an unknown price. Recommendations only; nothing is deleted.</p>
    </section>
    {scan.skipped_checks.length > 0 && <section className="panel border-amber-600">
      <h2>Skipped checks ({scan.skipped_checks.length})</h2>
      <p className="text-amber-200 mb-3">This scan has incomplete coverage. Skipped checks are not evidence that resources are healthy.</p>
      <ul className="space-y-2">{scan.skipped_checks.map((skip, i) => <li key={i}>
        <strong>{skip.rule_id}</strong> · {skip.region} {skip.resource_id} — {skip.detail}
      </li>)}</ul>
    </section>}
    <FindingsTable findings={scan.findings} />
  </div>;
}
