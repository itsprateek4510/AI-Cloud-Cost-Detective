import { useEffect, useRef, useState } from 'react';
import { api } from '../api';

interface Costs {
  available: boolean;
  stale?: boolean;
  reason?: string;
  cached: boolean;
  currency: string;
  estimated?: boolean;
  months: string[];
  services: { service: string; amounts: Record<string, string>; total: string }[];
  monthly_totals?: Record<string, string>;
  total: string | null;
}

export function SpendHistory({ token, accountId }: { token: string; accountId: number }) {
  const [costs, setCosts] = useState<Costs | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function load() {
    const controller = new AbortController();
    request.current = controller;
    setLoading(true); setError('');
    try {
      const data = await api<Costs>(`/accounts/${accountId}/cost`, token, { signal: controller.signal });
      if (!controller.signal.aborted) setCosts(data);
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Unable to load costs');
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }

  const format = (value: string) => Number(value).toLocaleString('en-US', { style: 'currency', currency: costs?.currency || 'USD' });
  return <section className="panel space-y-4">
    <h2>Spend by service</h2>
    <p className="text-slate-400">Last three completed UTC calendar months. Cost Explorer requests are billed; results are cached per account for a day by default.</p>
    <button onClick={load} disabled={loading}>{loading ? 'Loading costs…' : costs ? 'Reload cost history' : 'Load spend history'}</button>
    {error && <p role="alert" className="error">{error}</p>}
    {costs && !costs.available && <p className="text-amber-200">Cost Explorer unavailable ({costs.reason || 'AWS error'}). Check billing permissions and activation; this does not mean zero spend.</p>}
    {costs?.stale && <p className="text-amber-200">Showing stale cached data because refresh failed.</p>}
    {costs && (costs.available || costs.stale) && <>
      <p className="text-sm text-slate-400">{costs.cached ? 'Cached data' : 'Fetched from AWS'}{costs.estimated ? ' · AWS marks some amounts as estimated' : ''}. Historical spend is separate from estimated savings.</p>
      <div className="overflow-x-auto"><table>
        <thead><tr><th>Service</th>{costs.months.map(month => <th key={month}>{month}</th>)}<th>Period total</th></tr></thead>
        <tbody>{costs.services.map(service => <tr key={service.service}>
          <td>{service.service}</td>{costs.months.map(month => <td key={month}>{format(service.amounts[month] || '0')}</td>)}<td>{format(service.total)}</td>
        </tr>)}</tbody>
        <tfoot><tr><th>Total</th>{costs.months.map(month => <td key={month}>{format(costs.monthly_totals?.[month] || '0')}</td>)}<td>{format(costs.total || '0')}</td></tr></tfoot>
      </table></div>
    </>}
  </section>;
}
