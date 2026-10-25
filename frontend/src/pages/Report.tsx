import { useEffect, useRef, useState } from 'react';
import { api, ApiError, money, type AIReportResponse, type Scan } from '../api';
import { ScanResults } from '../components/ScanResults';
import { useScan } from '../hooks/useScan';
import { SpendHistory } from '../components/SpendHistory';

function ExecutiveReport({ token, scan, onFinding }: { token: string; scan: Scan; onFinding: () => void }) {
  const [response, setResponse] = useState<AIReportResponse | null>(null);
  const [checking, setChecking] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setResponse(null); setChecking(true); setError('');
    api<AIReportResponse>(`/scans/${scan.scan_id}/report`, token, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setResponse(data); })
      .catch(error => {
        if (!controller.signal.aborted && !(error instanceof ApiError && error.status === 404)) setError(error.message);
      }).finally(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => { controller.abort(); generation.current?.abort(); };
  }, [scan.scan_id, token]);

  async function generate() {
    const controller = new AbortController();
    generation.current = controller;
    setGenerating(true); setError('');
    try {
      const data = await api<AIReportResponse>(`/scans/${scan.scan_id}/report`, token, { method: 'POST', signal: controller.signal });
      if (!controller.signal.aborted) setResponse(data);
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Unable to generate summary');
    } finally { if (!controller.signal.aborted) setGenerating(false); }
  }

  const report = response?.report;
  const unavailable = response?.ai_summary_unavailable || !!error;
  return <section className="panel space-y-4" aria-live="polite">
    <h2>Executive summary</h2>
    {checking && <p>Checking saved summary…</p>}
    {unavailable && <p className="text-amber-200">AI summary unavailable. Your findings and code-calculated savings remain available below.</p>}
    {error && <p role="alert" className="error">{error}</p>}
    {!checking && !report && <>
      <p className="text-sm text-slate-400">Generate an optional Gemini explanation from sanitized findings. Figures always come from the scanner.</p>
      <button onClick={generate} disabled={generating}>{generating ? 'Generating…' : unavailable ? 'Retry AI summary' : 'Generate AI summary'}</button>
    </>}
    {report && <>
      <p>{report.executive_summary}</p>
      <h3 className="font-semibold">Prioritized actions</h3>
      <ol className="list-decimal pl-5 space-y-5">{report.top_actions.map((action, index) => <li key={index}>
        <strong>{action.title}</strong><p>{action.why}</p><p className="text-slate-300">{action.fix_hint}</p>
        <ul className="mt-2 space-y-1">{action.finding_ids.map(id => {
          const finding = scan.findings.find(finding => finding.id === id);
          return finding && <li key={id}><a className="text-emerald-300 underline break-all" href={`#finding-${id}`} onClick={onFinding}>
            {finding.resource_id} · {money(finding.savings_monthly)} / month
          </a></li>;
        })}</ul>
      </li>)}</ol>
      {report.risks.length > 0 && <><h3 className="font-semibold">Risks and caveats</h3>
        <ul className="list-disc pl-5">{report.risks.map((risk, index) => <li key={index}>{risk}</li>)}</ul></>}
    </>}
  </section>;
}

export function Report({ token, scanId }: { token: string; scanId: number | null }) {
  const { scan, error } = useScan(token, scanId);
  const [focusVersion, setFocusVersion] = useState(0);
  return <div className="space-y-6">
    <h1>Scan report</h1>
    <p className="text-slate-400">Deterministic findings and savings, with an optional cached Gemini explanation.</p>
    {scanId === null && <p>Start a scan on the Scans page to view its report.</p>}
    {error && <p role="alert" className="error">{error}</p>}
    {scanId !== null && !scan && !error && <p role="status">Loading scan…</p>}
    {scan?.status === 'completed' && <ExecutiveReport key={scan.scan_id} token={token} scan={scan} onFinding={() => setFocusVersion(version => version + 1)} />}
    {scan && <ScanResults key={`${scan.scan_id}:${focusVersion}`} scan={scan} />}
    {scan && <SpendHistory key={scan.account_id} token={token} accountId={scan.account_id} />}
  </div>;
}
