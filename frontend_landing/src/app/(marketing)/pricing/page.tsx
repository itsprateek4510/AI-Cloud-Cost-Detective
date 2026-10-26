import { MarketingLayout } from "@/components/chrome";
import { PricingCards } from "@/components/marketing/pricing";
import { FAQ } from "@/components/marketing/faq";
import { ClosingCTA } from "@/components/marketing/sections";
import { Button, PageHeading } from "@/components/ui";

export const metadata = {
  title: "Plans & pricing",
  description:
    "Free, Team, Business and Enterprise plans for cloud cost visibility. Read-only access, monthly billing in USD.",
};

export default function PricingPage() {
  return (
    <MarketingLayout>
      <div className="container">
        <PageHeading
          label="Plans"
          title="Start free. Pay when it pays for itself."
          description="Explore the sample report for free, then connect your first account when you're ready. Prices are placeholders until launch. [CONFIRM]"
        />
        <PricingCards />
        <div className="yearly-plan" id="yearly">
          <div>
            <span className="tag">DONE-FOR-YOU AUDIT</span>
            <h3 style={{ marginTop: 12 }}>An expert on your account.</h3>
            <p>A human cloud-cost review, a written report, and a call to walk through every change.</p>
          </div>
          <div>
            <h3>
              From $299{" "}
              <small style={{ fontSize: 12, fontWeight: 400 }}>/ audit [CONFIRM]</small>
            </h3>
            <Button href="/book?type=story" variant="outline" style={{ marginTop: 14 }}>
              Book an audit
            </Button>
          </div>
        </div>
        <section className="section">
          <div className="section-title">
            <h2>A closer look at the plans.</h2>
            <p>
              Every feature is marked live or coming soon. Nothing outside the live list is
              presented as available today.
            </p>
          </div>
          <div className="table-scroll">
            <table className="comparison">
              <thead>
                <tr>
                  {[
                    "What’s included",
                    "Free",
                    "Team",
                    "Business",
                    "Enterprise and Audit",
                  ].map((t) => (
                    <th key={t}>{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  [
                    "Multi-cloud cost dashboard by service, account, region and tag (AWS live; Azure and Google Cloud coming soon)",
                    "AWS",
                    "AWS",
                    "AWS",
                    "AWS",
                  ],
                  [
                    "Waste and idle-resource detection (AWS)",
                    "Live",
                    "Live",
                    "Live",
                    "Live",
                  ],
                  [
                    "Rightsizing (coming soon)",
                    "—",
                    "—",
                    "Coming soon",
                    "Coming soon",
                  ],
                  [
                    "Commitment recommendations (coming soon)",
                    "—",
                    "—",
                    "Coming soon",
                    "Coming soon",
                  ],
                  [
                    "Anomaly detection and alerts (coming soon)",
                    "—",
                    "—",
                    "Coming soon",
                    "Coming soon",
                  ],
                  [
                    "Budgets and forecasting (coming soon)",
                    "—",
                    "—",
                    "Coming soon",
                    "Coming soon",
                  ],
                  [
                    "Cost allocation, tagging gaps and showback (coming soon)",
                    "—",
                    "—",
                    "Coming soon",
                    "Coming soon",
                  ],
                  [
                    "Kubernetes costs (coming soon)",
                    "—",
                    "—",
                    "Coming soon",
                    "Coming soon",
                  ],
                  [
                    "AI and LLM spend tracking (coming soon)",
                    "—",
                    "—",
                    "Coming soon",
                    "Coming soon",
                  ],
                  [
                    "Fix generation, pull requests and approvals (coming soon)",
                    "—",
                    "—",
                    "Coming soon",
                    "Coming soon",
                  ],
                  [
                    "Ask your bill with source-linked answers (coming soon)",
                    "—",
                    "Coming soon",
                    "Coming soon",
                    "Coming soon",
                  ],
                  [
                    "Weekly summaries (live) · PDF and white-label reports (coming soon)",
                    "Email",
                    "Email",
                    "Email",
                    "Email and white-label soon",
                  ],
                  [
                    "Integrations (Slack and email live; Teams, Jira, GitHub and API coming soon)",
                    "Email",
                    "Email and Slack",
                    "Email and Slack",
                    "All soon",
                  ],
                  [
                    "Multi-account orgs, roles, SSO and audit logs (coming soon)",
                    "—",
                    "—",
                    "Coming soon",
                    "Coming soon",
                  ],
                  [
                    "Off-hours scheduling for non-production resources (coming soon)",
                    "—",
                    "—",
                    "Coming soon",
                    "Coming soon",
                  ],
                  [
                    "Export and deletion (coming soon)",
                    "—",
                    "Coming soon",
                    "Coming soon",
                    "Coming soon",
                  ],
                ].map((row) => (
                  <tr key={row[0]}>
                    {row.map((cell, i) => (
                      <td key={i}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="section faq-section">
          <div className="section-title">
            <h2>A few practical questions.</h2>
          </div>
          <FAQ
            items={[
              [
                "Are these prices final?",
                "No. Prices shown are placeholders in USD. [CONFIRM the final price list before launch.]",
              ],
              [
                "Can I try CloudLedger before paying?",
                "Yes. Explore the sample report, or start on the Free plan with one AWS account. No payment details are required for Free.",
              ],
              [
                "How do payments work?",
                "Paid plans are billed monthly in USD. [CONFIRM payment provider, taxes and invoicing.]",
              ],
              [
                "What about refunds and tax invoices?",
                "Refund and tax terms will be shown before a paid plan is purchased. [CONFIRM refund and tax policy.]",
              ],
            ]}
          />
        </section>
      </div>
      <ClosingCTA />
    </MarketingLayout>
  );
}
