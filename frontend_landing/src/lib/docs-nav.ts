export type DocItem = {
  slug: string;
  href: string;
  title: string;
  description: string;
  group: string;
};

export const docsNav: DocItem[] = [
  {
    slug: "overview",
    href: "/docs",
    title: "Overview",
    description: "What CloudLedger is and how to find your way around the guide.",
    group: "Start here",
  },
  {
    slug: "getting-started",
    href: "/docs/getting-started",
    title: "Getting started",
    description: "Create an account, connect an AWS account, and run your first scan.",
    group: "Start here",
  },
  {
    slug: "add-your-family",
    href: "/docs/add-your-family",
    title: "Connect a cloud account",
    description: "Add an AWS account with a read-only role and choose what is scanned.",
    group: "Start here",
  },
  {
    slug: "record-a-story",
    href: "/docs/record-a-story",
    title: "Review findings",
    description: "Open a finding, check the evidence, and see the estimated saving.",
    group: "Your workspace",
  },
  {
    slug: "ask-your-archive",
    href: "/docs/ask-your-archive",
    title: "Ask a question",
    description: "Ask about a cost and understand what the data can and cannot answer.",
    group: "Your workspace",
  },
  {
    slug: "gentle-hints",
    href: "/docs/gentle-hints",
    title: "Weekly summary",
    description: "What the weekly email and Slack summary include, and how to change it.",
    group: "Your workspace",
  },
  {
    slug: "privacy-and-sharing",
    href: "/docs/privacy-and-sharing",
    title: "Privacy and sharing",
    description: "Read-only access, account scope, team roles, and what we never do.",
    group: "Privacy & trust",
  },
  {
    slug: "your-data",
    href: "/docs/your-data",
    title: "Your data",
    description: "What is stored, how long it is kept, and how to delete it.",
    group: "Privacy & trust",
  },
  {
    slug: "troubleshooting",
    href: "/docs/troubleshooting",
    title: "Troubleshooting",
    description: "Common questions about connections, findings, sign-in, and summaries.",
    group: "Help",
  },
  {
    slug: "developers",
    href: "/docs/developers",
    title: "Developers",
    description: "Run this site locally and understand the read-only connection model.",
    group: "Developers",
  },
];

export const docGroups = ["Start here", "Your workspace", "Privacy & trust", "Help", "Developers"];

export function docBySlug(slug: string) {
  return docsNav.find((doc) => doc.slug === slug);
}
