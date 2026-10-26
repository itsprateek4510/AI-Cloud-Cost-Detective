import Image from "next/image";
import { ArrowRight, MessageCircle, Sparkles, BookOpen, ShieldCheck } from "lucide-react";
import { MarketingLayout } from "@/components/chrome";
import { ClosingCTA, WhySmriti } from "@/components/marketing/sections";
import { Button, SectionLabel } from "@/components/ui";

export const metadata = {
  title: "About",
  description:
    "Why CloudLedger exists: a read-only cloud cost platform that turns AWS, Azure and Google Cloud bills into findings you can act on.",
};

const questions = [
  "Which service grew the most this month?",
  "What changed after last week’s deploy?",
  "Where are we paying for idle resources?",
  "Which team owns this line item?",
  "What will next month cost at this rate?",
  "Which savings are safe to act on?",
  "Why did the bill jump on Tuesday?",
  "Which resources have no owner tag?",
  "What did we spend on data transfer?",
  "Where can we cut without slowing down?",
];

const moments = [
  {
    title: "Why we started.",
    text: "[PLACEHOLDER: founder note — a short, factual paragraph on why CloudLedger exists. Do not publish invented history or bios.]",
  },
  {
    title: "Start with the bill you already have.",
    text: "Connect an AWS account with a read-only role. No agents to install, no access keys, no changes to your infrastructure.",
  },
  {
    title: "Turn spend into findings.",
    text: "Each finding names the resource, the time window, the estimated monthly saving, and the evidence behind the number.",
  },
  {
    title: "Keep a person in the loop.",
    text: "You review every recommendation. Fixes arrive as code or tickets for your team, never as an automatic change.",
  },
];

const principles = [
  {
    icon: MessageCircle,
    title: "Evidence over guesses.",
    text: "Every finding links back to the cost and usage data that produced it. No number without a source.",
  },
  {
    icon: Sparkles,
    title: "Plain English, on purpose.",
    text: "Findings say what changed, what it costs, and what to do next. If a sentence needs a manual, we rewrite it.",
  },
  {
    icon: ShieldCheck,
    title: "Read-only by default.",
    text: "We never need write access to your cloud. You choose what we scan and can revoke access at any time.",
  },
];

export default function AboutPage() {
  return (
    <MarketingLayout>
      <section className="story-hero">
        <div className="container story-hero-grid">
          <div className="story-hero-copy">
            <SectionLabel>About</SectionLabel>
            <h1>
              Cloud spend,
              <br />
              explained plainly.
            </h1>
            <p>
              CloudLedger reads your cloud bill, finds what is wasted, and tells you what to fix
              first. Read-only access. No agents.
            </p>
            <div className="button-row">
              <Button href="/signup" variant="dark">
                Start for Free <ArrowRight size={14} />
              </Button>
              <Button href="/sample" variant="outline">
                See a sample report
              </Button>
            </div>
          </div>
          <div className="story-visual">
            <div className="story-orbit" aria-hidden="true" />
            <div className="portrait-card story-photo">
              <div className="portrait-image story-photo-img">
                <Image
                  src="/cloudledger-dashboard.png"
                  alt="CloudLedger sample workspace showing fictional AWS spend and estimated savings"
                  fill
                  priority
                  sizes="(max-width: 800px) 90vw, 460px"
                />
              </div>
            </div>
            <div className="story-float-chip">
              <ShieldCheck size={14} />
              Read-only. No agents.
            </div>
          </div>
        </div>
      </section>

      <section className="story-quote">
        <div className="container">
          <blockquote>
            “Most cloud bills are accurate. They are just hard to read, and nobody has time to
            trace every line.”
          </blockquote>
          <p>CloudLedger exists to make the reasons easy to find.</p>
        </div>
      </section>

      <div className="question-marquee" aria-hidden="true">
        <div className="marquee-track">
          {[...questions, ...questions].map((q, i) => (
            <span className="marquee-chip" key={`${q}-${i}`}>
              <MessageCircle size={13} />
              {q}
            </span>
          ))}
        </div>
      </div>

      <section className="section story-timeline">
        <div className="container">
          <div className="section-title">
            <SectionLabel>How it works</SectionLabel>
            <h2>From a monthly bill to a weekly habit.</h2>
          </div>
          <div className="timeline-list">
            {moments.map((m, i) => (
              <article className="timeline-item" key={m.title}>
                <span className="timeline-num">0{i + 1}</span>
                <div>
                  <h3>{m.title}</h3>
                  <p>{m.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section story-principles">
        <div className="container">
          <div className="section-title">
            <SectionLabel>What we believe</SectionLabel>
            <h2>A short list, not a dashboard tour.</h2>
            <p>Three rules we build CloudLedger around.</p>
          </div>
          <div className="principle-grid">
            {principles.map((p, i) => (
              <article className="principle-card" key={p.title}>
                <span className="principle-num">0{i + 1}</span>
                <p.icon size={22} />
                <h3>{p.title}</h3>
                <p>{p.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="story-keepsake">
        <div className="container keepsake-grid">
          <div className="keepsake-visual">
            <div className="book-preview">
              <div className="book-cover">
                <small>A SAMPLE REPORT</small>
                <h3>
                  One month.
                  <br />
                  Six
                  <br />
                  findings.
                </h3>
                <small>SAMPLE DATA · NOT A CUSTOMER</small>
              </div>
            </div>
          </div>
          <div className="keepsake-copy">
            <SectionLabel>Your data</SectionLabel>
            <h2>Read-only, and easy to leave.</h2>
            <p>
              CloudLedger never needs permission to change your infrastructure. Review findings
              today, and disconnect the role whenever you choose. Export is coming soon.
            </p>
            <div className="keepsake-tags">
              <span>
                <BookOpen size={13} /> Cost and usage data
              </span>
              <span>
                <BookOpen size={13} /> Findings export · Coming soon
              </span>
              <span>
                <ShieldCheck size={13} /> Read-only access
              </span>
            </div>
            <Button href="/trust" variant="outline">
              Our approach to trust <ArrowRight size={14} />
            </Button>
          </div>
        </div>
      </section>

      <WhySmriti />
      <ClosingCTA />
    </MarketingLayout>
  );
}
