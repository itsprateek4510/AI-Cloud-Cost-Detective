"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { Button } from "../ui";
import { featuredSampleStories } from "@/lib/sample-stories";

const cards = featuredSampleStories;

const total = cards.length;
const SLIDE_MS = 650;
const AUTO_MS = 4200;

function SampleCard({ card, i }: { card: (typeof cards)[number]; i: number }) {
  return (
    <Link
      href={`/sample?question=${card.index}`}
      className={`sample-card ${["bg-blue", "bg-cream", "bg-peach"][i % 3]}`}
    >
      <span className="small-label">{card.tag}</span>
      <h3>“{card.question}”</h3>
      <p>{card.subtitle}</p>
      <div className="card-footer">
        <div className="mini-person">
          <span className="avatar">{card.initials}</span>
          <div>
            <strong>{card.name}</strong>
            <small>{card.chapter}</small>
          </div>
        </div>
        <span className="icon-button">
          <ArrowUpRight size={16} />
        </span>
      </div>
    </Link>
  );
}

export function SampleSection() {
  const rail = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const paused = useRef(false);

  const measure = useCallback(() => {
    const el = rail.current;
    if (!el) return null;
    const card = el.querySelector<HTMLElement>(".sample-card");
    if (!card) return null;
    const gap = parseFloat(getComputedStyle(el).columnGap || getComputedStyle(el).gap) || 20;
    return { step: card.offsetWidth + gap, el };
  }, []);

  useEffect(() => {
    const m = measure();
    if (!m) return;
    m.el.scrollTo({ left: index * m.step, behavior: "smooth" });
    if (index >= total) {
      // landed on the duplicate set — snap back instantly after the slide
      const t = setTimeout(() => {
        m.el.scrollTo({ left: (index - total) * m.step });
        setIndex(index - total);
      }, SLIDE_MS);
      return () => clearTimeout(t);
    }
  }, [index, measure]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      if (!paused.current) setIndex((v) => v + 1);
    }, AUTO_MS);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onResize = () => {
      const m = measure();
      if (m) m.el.scrollTo({ left: (index % total) * m.step });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [index, measure]);

  function move(direction: number) {
    if (direction < 0 && index === 0) {
      // jump instantly to the last card when wrapping backward
      const m = measure();
      if (!m) return;
      m.el.scrollTo({ left: (total - 1) * m.step });
      setIndex(total - 1);
      return;
    }
    setIndex((v) => v + direction);
  }

  return (
    <section className="section">
      <div className="container">
        <div className="section-head-row">
          <div>
            <p className="eyebrow">The sample report · A fictional startup</p>
            <h2>One bill. More than one cause.</h2>
            <p>
              An idle NAT gateway. A staging cluster nobody stopped. A log group that never expires.
              <br />
              Meet Northwind Labs, and follow every finding back to the data behind it.
            </p>
          </div>
          <div className="section-controls">
            <Button href="/sample" variant="dark">
              Explore the report <ArrowUpRight size={14} />
            </Button>
            <button
              className="icon-button"
              aria-label="Previous sample finding"
              onClick={() => move(-1)}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              className="icon-button"
              aria-label="Next sample finding"
              onClick={() => move(1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div
          className="sample-cards"
          ref={rail}
          onMouseEnter={() => (paused.current = true)}
          onMouseLeave={() => (paused.current = false)}
          onFocusCapture={() => (paused.current = true)}
          onBlurCapture={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) paused.current = false;
          }}
        >
          {cards.map((card, i) => (
            <SampleCard card={card} i={i} key={card.tag} />
          ))}
          {cards.map((card, i) => (
            <SampleCard card={card} i={i} key={`dup-${card.tag}`} />
          ))}
        </div>
        <p className="sample-note">
          <Info size={12} /> Sample data only. No sign-in needed.
        </p>
      </div>
    </section>
  );
}
