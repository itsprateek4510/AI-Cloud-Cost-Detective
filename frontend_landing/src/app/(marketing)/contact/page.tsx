import { MarketingLayout } from "@/components/chrome";
import { PageHeading, Button } from "@/components/ui";
import { CalendarDays, Mail } from "lucide-react";

export const metadata = {
  title: "Get in touch",
  description:
    "Contact the CloudLedger team about a cost audit, a demo, security review, or anything else.",
};
export default function ContactPage() {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  return (
    <MarketingLayout>
      <div className="container">
        <PageHeading
          label="We’re here to help"
          title="Let’s look at your bill."
          description="About your cloud accounts, the costs you want to understand, or where to begin."
        />
        <div className="two-col narrow" style={{ marginBottom: 90 }}>
          <div className="panel stack">
            <CalendarDays color="#2676ff" />
            <h3>Find a time to talk.</h3>
            <p>Choose a short introduction or a longer session to walk through a cost audit.</p>
            <Button href="/book" variant="outline">
              Book a demo
            </Button>
          </div>
          <div className="panel stack">
            <Mail color="#2676ff" />
            <h3>Ask a question.</h3>
            <p>
              {email
                ? "Send us a little context and we’ll take it from there."
                : "Start with our answers to the most common questions about access, coverage, and billing."}
            </p>
            <Button href={email ? `mailto:${email}` : "/#faq"} variant="outline">
              {email ? "Write to us" : "Read the FAQs"}
            </Button>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
}
