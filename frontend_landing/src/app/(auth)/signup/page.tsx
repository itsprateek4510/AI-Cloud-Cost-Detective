import { redirect } from "next/navigation";
import { dashboardUrl } from "@/lib/product-url";
export const metadata = { title: "Create your account" };
export default async function SignupPage({ searchParams }: {
  searchParams: Promise<{ plan?: string | string[] }>;
}) {
  const { plan } = await searchParams;
  redirect(dashboardUrl({ plan: typeof plan === "string" ? plan : undefined }));
}
