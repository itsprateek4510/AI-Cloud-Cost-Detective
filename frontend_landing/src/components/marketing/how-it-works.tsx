"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionLabel } from "../ui";
import { ProductPreview } from "./product-preview";

const steps = [
  {
    title: "Connect your clouds",
    text: "Add AWS, Azure or Google Cloud with a read-only role. No agents. It takes a few minutes. Azure and Google Cloud are coming soon.",
  },
  {
    title: "See what’s wasted",
    text: "We scan every connected account and region, flag idle resources, and show the estimated saving for each. Rightsizing oversized resources is coming soon.",
  },
  {
    title: "Ask. Review. Fix.",
    text: "Ask in plain English, get answers linked to the source data, and approve fixes as pull requests or tickets. Answers and fix pull requests are coming soon.",
  },
];

export function HowItWorks() {
  const [step, setStep] = useState(0);
  return (
    <section className="section paper-section" id="how-it-works">
      <div className="container">
        <div className="section-title">
          <SectionLabel>How it works</SectionLabel>
          <h2>
            From a surprise bill
            <br />
            to a clear plan.
          </h2>
        </div>
        <div className="how-grid">
          <div>
            <div className="step-tabs" role="tablist" aria-label="How CloudLedger works">
              {steps.map((item, i) => (
                <button
                  id={`step-${i}`}
                  key={item.title}
                  className="step-tab"
                  role="tab"
                  aria-selected={step === i}
                  aria-controls="product-preview"
                  tabIndex={step === i ? 0 : -1}
                  onClick={() => setStep(i)}
                  onKeyDown={(e) => {
                    if (["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(e.key)) {
                      e.preventDefault();
                      const next = (i + (["ArrowRight", "ArrowDown"].includes(e.key) ? 1 : 2)) % 3;
                      setStep(next);
                      document.getElementById(`step-${next}`)?.focus();
                    }
                  }}
                >
                  <span>0{i + 1}</span>
                  <div>
                    <small>STEP 0{i + 1}</small>
                    <strong>{item.title}</strong>
                  </div>
                </button>
              ))}
            </div>
            <div className="step-description">
              <p>{steps[step].text}</p>
              <Link className="text-link" href="/signup">
                Connect your first account <ArrowRight size={14} />
              </Link>
            </div>
          </div>
          <div id="product-preview" role="tabpanel" aria-labelledby={`step-${step}`}>
            <ProductPreview step={step} />
          </div>
        </div>
      </div>
    </section>
  );
}
