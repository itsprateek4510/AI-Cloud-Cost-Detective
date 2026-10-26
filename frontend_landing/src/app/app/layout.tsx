import { AppProvider } from "@/components/ecosystem/provider";
import { AppShell } from "@/components/ecosystem/shell";
import { SetupBanner } from "@/components/ecosystem/setup-banner";
import "./ecosystem.css";
import "./chat.css";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <SetupBanner />
      <AppShell>{children}</AppShell>
    </AppProvider>
  );
}
