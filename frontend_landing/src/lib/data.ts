export const brand = {
  name: "CloudLedger",
  tagline: "See it. Explain it. Fix it.",
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "hello@cloudledger.example",
};

export const plans = [
  {
    id: "starter",
    name: "Free",
    price: 0,
    priceLabel: "$0",
    description: "See what you're spending.",
    cta: "Start free",
    features: [
      "1 cloud account (AWS)",
      "Cost dashboard",
      "Top 3 findings per scan",
      "Weekly summary email",
    ],
    featured: false,
  },
  {
    id: "family",
    name: "Team",
    price: 49,
    description: "Find it. Fix it.",
    cta: "Start Team",
    features: [
      "Everything in Free",
      "Up to 5 accounts across AWS, Azure and Google Cloud (Azure and Google Cloud coming soon)",
      "All AWS waste findings (rightsizing coming soon)",
      "Anomaly alerts in Slack and email (coming soon)",
      "Source-linked answers (coming soon)",
      "Export in open formats (coming soon)",
    ],
    featured: false,
  },
  {
    id: "premium",
    name: "Business",
    price: 199,
    description: "Allocated, budgeted, under control.",
    cta: "Start Business",
    features: [
      "Everything in Team",
      "Unlimited accounts (coming soon)",
      "Commitment recommendations (coming soon)",
      "Budgets and forecasting (coming soon)",
      "Allocation and showback (coming soon)",
      "Kubernetes and AI-spend costs (coming soon)",
      "Fix pull requests and approvals (coming soon)",
      "SSO and audit logs (coming soon)",
    ],
    featured: true,
  },
  {
    id: "professional",
    name: "Enterprise and Audit",
    price: 299,
    priceLabel: "Custom. Audits from $299",
    description: "Reviewed by an expert.",
    cta: "Talk to us",
    features: [
      "Human cloud-cost review",
      "Written report and walkthrough call",
      "Multi-client dashboards and white-label reports (coming soon)",
      "Custom security review (coming soon)",
      "Priority support (coming soon)",
    ],
    featured: false,
  },
] as const;

export const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

export const faqs: [string, string][] = [
  [
    "Do you need my cloud credentials?",
    "No access keys. You create a read-only role (or the equivalent on Azure and Google Cloud) that you can revoke at any time.",
  ],
  [
    "Can you change or delete anything?",
    "No. Access is read-only. Fixes are suggested as code or tickets that your team reviews and applies.",
  ],
  [
    "Which clouds and services are covered?",
    "AWS, Azure and Google Cloud. Coverage varies by service. See the feature list for what is live and what is coming soon.",
  ],
  [
    "How are savings calculated?",
    "Our code calculates them from your usage and published pricing. AI never produces the numbers; it explains and prioritises. Savings are estimates and may differ with your discounts.",
  ],
  [
    "What does the AI see?",
    "Findings and cost metadata, not your application data. Resource names and tags are treated as untrusted text. [CONFIRM which AI provider processes this and say so plainly.]",
  ],
  [
    "Can I export or delete everything?",
    "Deletion is available whenever you choose. Export is coming soon; until then, contact us and we will arrange a copy of your data.",
  ],
  [
    "How is this different from the cloud providers' own tools?",
    "Those are free and useful, but each covers one cloud. We bring all three into one view, explain why costs moved, and turn findings into reviewable fixes.",
  ],
  [
    "What if two teams disagree about a resource?",
    "Mark a finding as expected, with a reason. It stops showing up, and the reason stays on record.",
  ],
  [
    "Are you SOC 2 certified?",
    "Not yet. A security overview is available on request.",
  ],
  [
    "How does billing work?",
    "Paid plans are billed monthly in USD. You can cancel before the next renewal. Invoices, taxes and refund terms are confirmed at checkout. [CONFIRM tax and refund terms.]",
  ],
];
