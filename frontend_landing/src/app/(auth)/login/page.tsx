import { redirect } from "next/navigation";
import { dashboardUrl } from "@/lib/product-url";
export const metadata = { title: "Sign in" };
export default function LoginPage() {
  redirect(dashboardUrl());
}
