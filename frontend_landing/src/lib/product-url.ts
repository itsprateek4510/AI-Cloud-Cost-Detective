export const productUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5173";

export function dashboardUrl(options: { plan?: string; demo?: boolean } = {}) {
  const url = new URL(productUrl);
  if (options.plan) url.searchParams.set("plan", options.plan);
  if (options.demo) url.searchParams.set("demo", "1");
  return url.toString();
}
