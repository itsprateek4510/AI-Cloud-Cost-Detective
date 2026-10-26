import { Check, ArrowRight } from "lucide-react";
import Link from "next/link";
import { plans, money } from "@/lib/data";
import { Button, SectionLabel } from "../ui";

export function PricingCards() {
  return (
    <>
      <div className="pricing-grid">
        {plans.map((plan) => (
          <article className={`price-card ${plan.featured ? "featured" : ""}`} key={plan.id}>
            {plan.featured && <span className="price-badge">Best Value</span>}
            <h3>{plan.name}</h3>
            <p>{plan.description}</p>
            <div className="plan-price">
              {"priceLabel" in plan ? plan.priceLabel : money(plan.price)}
            </div>
            <span className="price-period">
              {plan.id === "professional"
                ? "Talk to us"
                : plan.id === "starter"
                  ? "Free forever"
                  : "per month, billed monthly"}
            </span>
            <Button
              href={plan.id === "professional" ? "/book?type=story" : `/signup?plan=${plan.id}`}
              variant={plan.featured ? "primary" : "outline"}
            >
              {plan.cta}
            </Button>
            <ul>
              {plan.features.map((feature) => (
                <li key={feature}>
                  <Check size={12} />
                  {feature}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      <p className="pricing-footnote">
        Prices in USD. Savings are estimates. Not sure which fits?{" "}
        <Link href="/book">
          Book a free intro call <ArrowRight size={12} style={{ display: "inline" }} />
        </Link>
      </p>
    </>
  );
}

export function PricingSection() {
  return (
    <section className="section" id="pricing">
      <div className="container">
        <div className="section-title">
          <SectionLabel>Plans</SectionLabel>
          <h2>
            Start free.
            <br />
            Pay when it pays for itself.
          </h2>
          <p>Explore the sample report for free. Connect your first account when you&apos;re ready.</p>
        </div>
        <PricingCards />
      </div>
    </section>
  );
}
