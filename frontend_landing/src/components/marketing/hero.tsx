"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  ArrowDown,
  Play,
  ShieldCheck,
  Cloud,
  MessageCircle,
  FileDown,
} from "lucide-react";
import { Button } from "../ui";
import styles from "./hero.module.css";

const phrases = ["your cloud bill.", "a forgotten disk.", "an idle NAT gateway."];

export function Hero() {
  const [phrase, setPhrase] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const interval = setInterval(() => setPhrase((value) => (value + 1) % phrases.length), 4200);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className={`hero ${styles.hero}`}>
      <div className="container hero-grid">
        <div className="hero-copy">
          <div className="hero-badges">
            <span className="hero-badge">
              <Cloud size={22} />
              <span>
                BUILT FOR ENGINEERING TEAMS<strong>Made for the people who own the bill</strong>
              </span>
            </span>
            <span className="hero-badge">
              <ShieldCheck size={22} />
              <span>
                READ-ONLY BY DESIGN<strong>Your cloud. Your control.</strong>
              </span>
            </span>
          </div>
          <h1>
            There’s money hiding in
            <br />
            <span className="changing-line">
              {phrases[phrase]}
              <i className="typing-cursor" />
            </span>
          </h1>
          <p className="hero-subtitle">
            See your spend. Understand the spikes.
            <br />
            Fix the waste.
          </p>
          <div className="button-row">
            <Button href="/signup">Start free</Button>
            <Button href="/book" variant="outline">
              Talk to us
            </Button>
          </div>
          <div className="hero-integrations">
            <p className="eyebrow">A few minutes to connect. A smaller bill to read.</p>
            <div className="integration-icons">
              <span>
                <ShieldCheck color="#37ad75" />
                Read-only access
              </span>
              <span>
                <MessageCircle color="#2676ff" />
                AWS live · Azure and Google Cloud coming soon
              </span>
              <span>
                <FileDown color="#da8d4e" />
                Open formats · Coming soon
              </span>
            </div>
          </div>
        </div>
        <figure className={styles.visual}>
          <div className={styles.orbit} aria-hidden="true" />
          <div className={styles.edition} aria-hidden="true">
            EVERY DOLLAR, ACCOUNTED FOR.
          </div>
          <div className={styles.keepsake}>
            <div className={`portrait-image ${styles.photo}`}>
              <Image
                src="/cloudledger-dashboard.png"
                alt="Dashboard showing monthly cloud spend by service and account"
                fill
                priority
                sizes="(max-width: 600px) 90vw, (max-width: 900px) 480px, 43vw"
              />
              <span className={styles.photoLabel}>Every dollar, traced to a resource.</span>
            </div>
            <div className={styles.story}>
              <div className={styles.storyMeta}>
                <span>SAMPLE REPORT · NORTHWIND LABS</span>
                <span>01 / 06</span>
              </div>
              <h2>
                Behind every line item,
                <br />
                <em>there’s a resource somebody forgot.</em>
              </h2>
              <Button href="/sample" variant="outline" className={styles.sampleLink}>
                <Play size={13} fill="currentColor" /> Explore a sample report
              </Button>
            </div>
          </div>
          <figcaption className={styles.caption}>
            <span className={styles.wave} aria-hidden="true">
              {[9, 17, 25, 13, 21, 11, 19].map((height, i) => (
                <i key={i} style={{ height, animationDelay: `${i * 0.15}s` }} />
              ))}
            </span>
            <span>
              <strong>Your data. Still yours.</strong>
              <br />
              Real numbers, never guessed by AI. Findings, never made up.
            </span>
          </figcaption>
        </figure>
      </div>
      <a className="hero-scroll" href="#how-it-works">
        SCROLL
        <ArrowDown size={14} />
      </a>
    </section>
  );
}
