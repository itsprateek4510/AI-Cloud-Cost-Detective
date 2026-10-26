import { MarketingLayout } from "@/components/chrome";
import { Promise } from "@/components/marketing/sections";
import { Button, SectionLabel } from "@/components/ui";
import {
  Ban,
  Database,
  Fingerprint,
  KeyRound,
  ArrowRight,
  Check,
  ShieldCheck,
} from "lucide-react";

export const metadata = {
  title: "Trust & privacy",
  description:
    "How CloudLedger keeps your cloud data private: read-only access, source-linked findings, and no automatic changes.",
};

function IconShieldLock() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3l7 3v5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6l7-3z" />
      <rect x="9.5" y="11" width="5" height="4.5" rx="1" />
      <path d="M10.5 11V9.8a1.5 1.5 0 0 1 3 0V11" />
    </svg>
  );
}
function IconLocalDevice() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <path d="M3 8h18" />
      <circle cx="6" cy="6" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="6" r="0.8" fill="currentColor" stroke="none" />
      <ellipse cx="12" cy="12.5" rx="3.5" ry="1.4" />
      <path d="M8.5 12.5v2.4c0 .8 1.6 1.4 3.5 1.4s3.5-.6 3.5-1.4v-2.4" />
      <path d="M9 20.5h6" />
    </svg>
  );
}
function IconWaveSlash() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 10v4" />
      <path d="M7.5 7v10" />
      <path d="M11 4.5v15" />
      <path d="M14.5 8v8" />
      <path d="M18 10.5v3" />
      <path d="M4.6 4.6l14.8 14.8" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="9.5" strokeDasharray="2.6 2.8" opacity="0.45" />
    </svg>
  );
}
function IconOpenDoc() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" />
      <path d="M14 3v5h5" />
      <path d="M12 11.5v4.5" />
      <path d="M9.8 13.8L12 16l2.2-2.2" />
    </svg>
  );
}
function IconKeyAccess() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="9" cy="9" r="5" />
      <circle cx="9" cy="9" r="1.6" />
      <path d="M12.8 12.8L20 20" />
      <path d="M17.4 17.4l1.9-1.9" />
      <path d="M15.1 15.1l1.5-1.5" />
      <path d="M4 20.5c1.4-1.4 2.9-2 5-2" opacity="0.5" />
    </svg>
  );
}
function IconHonestChat() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4V6z" />
      <path d="M8.5 10.5l2.5 2.5 4.5-4.5" />
    </svg>
  );
}

const principles = [
  {
    icon: <IconShieldLock />,
    title: "Private by default",
    text: "Your cost and usage data is visible only to the people you invite. Nothing is shared by default.",
  },
  {
    icon: <IconLocalDevice />,
    title: "Read-only access",
    text: "CloudLedger connects with a read-only role. No access keys, no agents, and no permission to change resources.",
  },
  {
    icon: <IconWaveSlash />,
    title: "We never touch your cloud",
    text: "We never delete a resource, change a configuration, or move money. Fixes are suggestions for your team to apply.",
  },
  {
    icon: <IconOpenDoc />,
    title: "Open formats",
    text: "CSV and JSON export is coming soon. No lock-in, no proprietary vault.",
  },
  {
    icon: <IconKeyAccess />,
    title: "You control access",
    text: "Choose which accounts, regions, and teams are scanned. Revoke access at any time by deleting the role.",
  },
  {
    icon: <IconHonestChat />,
    title: "Honest by design",
    text: "Every finding cites the resource, metric, and time window behind it. AI explains the numbers. It never invents them.",
  },
];

const neverList = [
  "Write access to your cloud",
  "Automatic deletes or changes",
  "Invented savings numbers",
  "Selling or sharing your data",
  "Training models on your account data",
  "Ads, trackers, or dark patterns",
];

export default function TrustPage() {
  return (
    <MarketingLayout>
      {/* Hero */}
      <section className="trust-hero">
        <div className="container">
          <SectionLabel>Trust, built in</SectionLabel>
          <h1>
            Your cloud is <br />
            not a dataset.
          </h1>
          <p>
            A cost tool should be a place of trust. Every principle behind CloudLedger — access,
            storage, honesty — starts with your team, not the platform.
          </p>
          <div className="trust-hero-badges">
            <span>
              <Fingerprint size={13} /> Read-only by default
            </span>
            <span>
              <ShieldCheck size={13} /> Private by default
            </span>
            <span>
              <KeyRound size={13} /> Revoke access any time
            </span>
          </div>
        </div>
        <div className="trust-hero-glow" aria-hidden />
      </section>

      {/* Principles */}
      <section className="section trust-principles">
        <div className="container">
          <div className="section-title">
            <SectionLabel>The principles</SectionLabel>
            <h2>How trust works here.</h2>
            <p>Six commitments that shape every part of CloudLedger.</p>
          </div>
          <div className="trust-grid">
            {principles.map((item) => (
              <article className="trust-card" key={item.title}>
                <span className="trust-icon">
                  {item.icon}
                </span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* What we never do */}
      <section className="never-section">
        <div className="never-glow" aria-hidden />
        <div className="container">
          <SectionLabel>What we never do</SectionLabel>
          <h2>
            A line we will <span>never</span> cross.
          </h2>
          <div className="never-grid">
            {neverList.map((item) => (
              <div className="never-item" key={item}>
                <Ban size={14} />
                <span>{item}</span>
              </div>
            ))}
          </div>
          <p className="never-footnote">
            Some things should never be automatic. Deleting a resource. Changing production.
            Spending your money.
          </p>
        </div>
      </section>

      {/* Data residency */}
      <section className="section residency">
        <div className="container residency-grid">
          <div className="residency-copy">
            <SectionLabel>Data residency</SectionLabel>
            <h2>Know where your data lives.</h2>
            <p>
              Cost and usage metadata is stored on our servers in{" "}
              [CONFIRM hosting provider and region before publishing]. We do not store your cloud
              credentials, because access is granted through a read-only role.
            </p>
            <p>
              Sign in from any device with your account. Revoking the role takes effect immediately.
              You can request deletion at any time from Settings. Export is coming soon.
            </p>
            <div className="button-row">
              <Button href="/legal/privacy" variant="outline">
                Read the privacy details
              </Button>
              <Button href="/docs/your-data" variant="outline">
                Your data settings
              </Button>
            </div>
          </div>
          <div className="residency-card">
            <div className="residency-card-head">
              <Database size={15} />
              <span>Your workspace</span>
              <em>Private by default</em>
            </div>
            <ul>
              <li>
                <Check size={13} /> Account and cost metadata stored separately
              </li>
              <li>
                <Check size={13} /> Read-only role, no stored access keys
              </li>
              <li>
                <Check size={13} /> Findings behind server-side access checks
              </li>
              <li>
                <Check size={13} /> Export in open formats · Coming soon
              </li>
              <li className="muted">
                <Ban size={13} /> No ads or trackers
              </li>
              <li className="muted">
                <Ban size={13} /> No training on your cloud data
              </li>
            </ul>
            <div className="residency-foot">
              <ArrowRight size={12} /> Backed by our{" "}
              <a href="/legal/privacy">privacy policy</a>
            </div>
          </div>
        </div>
      </section>

      <Promise />
    </MarketingLayout>
  );
}
