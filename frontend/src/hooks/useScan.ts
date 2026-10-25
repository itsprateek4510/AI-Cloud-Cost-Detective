import { useEffect, useState } from 'react';
import { api, ApiError, type Scan } from '../api';

export function useScan(token: string, scanId: number | null) {
  const [scan, setScan] = useState<Scan | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    setScan(null);
    setError('');
    if (scanId === null) return;

    async function poll() {
      let retry = true;
      try {
        const data = await api<Scan>(`/scans/${scanId}`, token, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setScan(data);
        setError('');
        retry = data.status === 'pending' || data.status === 'running';
      } catch (error) {
        if (controller.signal.aborted) return;
        setError(error instanceof Error ? error.message : 'Unable to load scan');
        retry = !(error instanceof ApiError && [401, 403, 404].includes(error.status));
      }
      if (retry && !controller.signal.aborted) timer = setTimeout(poll, 2500);
    }
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [token, scanId]);

  return { scan, error };
}
