import { MarketingLayout } from "./chrome";
import { Hero } from "./marketing/hero";
import { HowItWorks } from "./marketing/how-it-works";
import { SampleSection } from "./marketing/sample-section";
import { PricingSection } from "./marketing/pricing";
import { FAQ } from "./marketing/faq";
import { ClosingCTA, Promise, TrustStrip, UseCases, WhySmriti } from "./marketing/sections";

export default function Home() {
  return (
    <MarketingLayout>
      <Hero />
      <TrustStrip />
      <HowItWorks />
      <SampleSection />
      <UseCases />
      <WhySmriti />
      <Promise />
      <PricingSection />
      <section className="section faq-section" id="faq">
        <div className="container">
          <div className="section-title">
            <h2>Questions, answered.</h2>
            <p>Straight answers about access, savings and what we do with your data.</p>
          </div>
          <FAQ />
        </div>
      </section>
      <ClosingCTA />
    </MarketingLayout>
  );
}
