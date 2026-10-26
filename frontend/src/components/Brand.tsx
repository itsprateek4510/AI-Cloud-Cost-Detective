export const WEBSITE_URL = (import.meta.env.VITE_WEBSITE_URL || 'http://localhost:3000').replace(/\/$/, '');

export function Brand() {
  return <a className="brand" href={WEBSITE_URL} aria-label="CloudLedger home">
    <span className="brand-mark"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M9 23h15a5 5 0 0 0 .5-10A8 8 0 0 0 9 11a6 6 0 0 0 0 12Z" fill="currentColor" /><path d="M12 16h9m-9 4h6" stroke="#285d84" strokeWidth="1.8" strokeLinecap="round" /></svg></span>
    CloudLedger<span className="brand-period">.</span>
  </a>;
}

const paths = {
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  cloud: 'M6 18h12a4 4 0 0 0 .4-8A6.5 6.5 0 0 0 6 8a5 5 0 0 0 0 10Z',
  scan: 'M4 8V4h4m8 0h4v4m0 8v4h-4m-8 0H4v-4M7 12h10',
  report: 'M7 3h7l4 4v14H7z M14 3v5h4M10 12h5m-5 4h5',
  shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  link: 'm9 15 6-6M8 16l-2 2a4 4 0 0 1-5-5l5-5a4 4 0 0 1 5 0m2 8a4 4 0 0 0 5 0l5-5a4 4 0 0 0-5-5l-2 2',
  check: 'm5 12 4 4L19 6',
  logout: 'M9 4H4v16h5m4-13 5 5-5 5m-6-5h11',
  book: 'M3 4h7l2 2 2-2h7v15h-7l-2 2-2-2H3z M12 6v15',
} as const;

export function Icon({ name, size = 19 }: { name: keyof typeof paths; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
