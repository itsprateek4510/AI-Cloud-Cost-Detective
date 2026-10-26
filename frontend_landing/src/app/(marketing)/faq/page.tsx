import { MarketingLayout } from "@/components/chrome";
import { FAQ } from "@/components/marketing/faq";
import { Button, SectionLabel } from "@/components/ui";
import { faqs } from "@/lib/data";
import { MessageCircleQuestion, BookOpenText, ShieldCheck, Tags, ArrowRight } from "lucide-react";

const groups = [
  {
    icon: BookOpenText,
    label: "Getting started",
    title: "First steps.",
    items: [faqs[0], faqs[2], faqs[6]],
  },
  {
    icon: ShieldCheck,
    label: "Security & trust",
    title: "Read-only, by design.",
    items: [faqs[1], faqs[4], faqs[5], faqs[8]],
  },
  {
    icon: Tags,
    label: "Plans & billing",
    title: "Clear prices, in USD.",
    items: [faqs[3], faqs[7], faqs[9]],
  },
] as const;

export const metadata = {
  title: "Frequently asked questions",
  description:
    "Straight answers about how CloudLedger works, what it can access, and what it costs.",
};

export default function FAQPage() {
  return (
    <MarketingLayout>
      {/* Hero */}
      <section className="faq-hero">
        <div className="faq-hero-glow" aria-hidden />
        <div className="container">
          <SectionLabel>Answers, upfront</SectionLabel>
          <h1>
            Questions, <br />
            answered.
          </h1>
          <p>
            Straight answers about how CloudLedger works, what it can access, and what it costs.
            Nothing hidden.
          </p>
          <div className="faq-hero-badges">
            <span>
              <MessageCircleQuestion size={13} /> 10 questions
            </span>
            <span>
              <ShieldCheck size={13} /> Honest answers
            </span>
            <span>
              <ArrowRight size={13} /> Or talk to a human
            </span>
          </div>
        </div>
      </section>

      {/* Grouped FAQ sections */}
      {groups.map((group) => (
        <section className="section faq-group" key={group.label}>
          <div className="container">
            <div className="faq-group-head">
              <span className="faq-group-icon">
                <group.icon size={18} />
              </span>
              <div>
                <SectionLabel>{group.label}</SectionLabel>
                <h2>{group.title}</h2>
              </div>
            </div>
            <FAQ items={group.items} />
          </div>
        </section>
      ))}

      {/* Contact band */}
      <section className="faq-contact">
        <div className="faq-contact-glow" aria-hidden />
        <div className="container">
          <MessageCircleQuestion size={26} strokeWidth={1.5} style={{ margin: "0 auto 20px", color: "#8fb4ff" }} />
          <h2>Didn’t find your answer?</h2>
          <p>Book a free intro call. A real person will walk you through it.</p>
          <div className="button-row">
            <Button href="/book" variant="white">
              Book a free call
            </Button>
            <Button href="/contact" variant="outline">
              Contact us
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
