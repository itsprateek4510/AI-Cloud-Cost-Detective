import { notFound } from "next/navigation";
import { MarketingLayout } from "@/components/chrome";
import { PageHeading, Button } from "@/components/ui";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { ClosingCTA } from "@/components/marketing/sections";

export async function generateMetadata({ params }: { params: Promise<{ audience: string }> }) {
  const { audience } = await params;
  const business = audience === "business-families";
  return {
    title: business ? "For agencies and MSPs" : "For startups",
    description: business
      ? "Review every client’s cloud spend from one dashboard, with findings you can put your name on."
      : "Keep your credits from disappearing. See what each cloud service costs and what to fix first.",
  };
}

export default async function AudiencePage({ params }: { params: Promise<{ audience: string }> }) {
  const { audience } = await params;
  if (!["families", "business-families"].includes(audience)) notFound();
  const business = audience === "business-families";
  return (
    <MarketingLayout>
      <div className="container">
        <PageHeading
          label={business ? "For agencies and MSPs" : "For startups and small teams"}
          title={
            business
              ? "Every client. One dashboard."
              : "Make your credits last a little longer."
          }
          description={
            business
              ? "Review cloud spend across every client account, with source-linked findings and reports you can hand over."
              : "See what each service costs, which resources are idle, and what to fix first. Read-only access from day one."
          }
        >
          <div className="button-row">
            <Button href={business ? "/book?type=story" : "/signup"}>
              {business ? "Book an audit" : "Start free"}
            </Button>
            <Button href="/sample" variant="outline">
              Explore a sample
            </Button>
          </div>
        </PageHeading>
      </div>
      <HowItWorks />
      <ClosingCTA />
    </MarketingLayout>
  );
}
