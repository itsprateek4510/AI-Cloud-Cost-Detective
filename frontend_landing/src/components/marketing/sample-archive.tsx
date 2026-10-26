"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, BookOpen, ChevronDown } from "lucide-react";
import { MarketingLayout } from "../chrome";
import { Button, PageHeading } from "../ui";
import { sampleStories } from "@/lib/sample-stories";
import { formatTime } from "@/lib/workspace";
import styles from "./sample-archive.module.css";

const family = [
  {
    name: "AWS · Networking",
    label: "Northwind Labs, prod",
    description: "Data transfer and NAT Gateway costs",
    first: 0,
  },
  {
    name: "Azure · Compute",
    label: "Northwind Labs, staging · Coming soon",
    description: "Forgotten resources and idle capacity",
    first: 1,
  },
  {
    name: "AWS · Commitments",
    label: "Northwind Labs, prod · Coming soon",
    description: "Savings Plans and baseline usage",
    first: 2,
  },
  {
    name: "Google Cloud · Compute",
    label: "Northwind Labs, data · Coming soon",
    description: "Oversized instances and real usage",
    first: 3,
  },
  {
    name: "LLM APIs · Usage",
    label: "Northwind Labs, product · Coming soon",
    description: "Token spend by model and feature",
    first: 4,
  },
  {
    name: "Kubernetes · Workloads",
    label: "Northwind Labs, platform · Coming soon",
    description: "Requests versus measured usage",
    first: 5,
  },
];
const memoryTitles = [
  "Data transfer, 4x in one week",
  "A staging cluster since March",
  "Steady baseline, right-sized cover",
  "Fourteen oversized VMs",
  "Token spend by team",
  "Memory requests versus usage",
];

export function SampleArchive() {
  const params = useSearchParams();
  const initial = Number(params.get("question") ?? 3);
  const [selected, setSelected] = useState(
    Number.isInteger(initial) && initial >= 0 && initial < sampleStories.length ? initial : 3,
  );
  const [line, setLine] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const story = sampleStories[selected];
  const person = family.find((member) => member.name === story.group)!;
  const memories = sampleStories
    .map((memory, index) => ({ ...memory, index }))
    .filter((memory) => memory.group === story.group);

  function choose(index: number) {
    setSelected(index);
    setLine(null);
    setShowTranscript(false);
  }

  useEffect(() => {
    if (!showTranscript) return;
    const source = story.transcript.find((entry) => entry.time === story.time);
    if (source)
      document
        .getElementById(`sample-line-${source.id}`)
        ?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
          block: "center",
        });
  }, [showTranscript, story]);

  return (
    <MarketingLayout>
      <div className={`container ${styles.page}`}>
        <PageHeading
          label="See what a report can show"
          title="Meet Northwind Labs."
          description="A fictional startup with a real-looking bill. Follow one finding from the line item to the resource, the metric and the time window behind it."
        />

        <div className={styles.explainer}>
          <BookOpen size={20} aria-hidden="true" />
          <p>
            <strong>A cost report, in plain words.</strong> Every finding has a number and a source.
            You can check the exact resource, the usage, and the window it came from. AI explains
            the finding; it does not produce the figure.
          </p>
        </div>

        <section className={styles.demo} aria-labelledby="family-picker-heading">
          <div className={styles.demoBar}>
            <span>THE NORTHWIND LABS REPORT</span>
            <span>Fictional demo · Prepared findings · Sample data</span>
          </div>
          <div className={styles.demoBody}>
            <div className={styles.pickerHeading}>
              <h2 id="family-picker-heading">Which finding would you like to explore?</h2>
              <p>Choose a cloud area to see a finding and the data behind it.</p>
            </div>
            <div className={styles.people}>
              {family.map((member) => (
                <button
                  key={member.name}
                  className={styles.personButton}
                  aria-pressed={member.name === story.group}
                  aria-controls="selected-memory"
                  onClick={() => choose(member.first)}
                >
                  <span className={styles.initials} aria-hidden="true">
                    {sampleStories[member.first].initials}
                  </span>
                  <span>
                    <strong>{member.name}</strong>
                    <small>{member.label}</small>
                  </span>
                </button>
              ))}
            </div>

            <div className={styles.memberIntro}>
              <strong>{person.name} findings</strong>
              <span>{person.description}</span>
            </div>
            {memories.length > 1 && (
              <div
                className={styles.memories}
                aria-label={`Choose one of ${person.name} findings`}
              >
                {memories.map((memory) => (
                  <button
                    key={memory.index}
                    aria-pressed={selected === memory.index}
                    aria-controls="selected-memory"
                    onClick={() => choose(memory.index)}
                  >
                    {memoryTitles[memory.index]}
                  </button>
                ))}
              </div>
            )}

            <div id="selected-memory" className={styles.memoryLayout} key={selected}>
              <section className={styles.memory} aria-labelledby="memory-title">
                <span className={styles.label}>THE FINDING</span>
                <h2 id="memory-title">{memoryTitles[selected]}</h2>
                <p className={styles.memoryDescription}>{story.subtitle}</p>
                <blockquote>“{story.evidence}”</blockquote>
                <p className={styles.attribution}>
                  — {story.name}
                  <span>Excerpt from illustrative source data</span>
                </p>
                <p className={styles.memoryNote}>
                  In your own report, this is where you would see the exact resource, metric and
                  time window behind the finding.
                </p>
              </section>

              <article
                className={`answer-panel ${styles.answer}`}
                aria-labelledby="example-question"
              >
                <span className={styles.label}>NOW ASK A QUESTION ABOUT THAT FINDING</span>
                <h2 id="example-question">{story.question}</h2>
                <span className={styles.answerLabel}>What CloudLedger found</span>
                <p className={styles.answerText}>{story.answer}</p>
                <p className={styles.sourceLabel}>
                  <BookOpen size={13} aria-hidden="true" /> Based on source rows from{" "}
                  {story.name}—not an invented figure.
                </p>
                <details className={`evidence ${styles.evidence}`}>
                  <summary>
                    <span>Read the supporting evidence</span>
                    <ChevronDown size={16} aria-hidden="true" />
                  </summary>
                  <p className={styles.helper}>Here is the exact source row used for the answer.</p>
                  <blockquote>“{story.evidence}”</blockquote>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const source = story.transcript.find((entry) => entry.time === story.time);
                      setLine(source?.id ?? null);
                      setShowTranscript(!showTranscript);
                    }}
                    aria-expanded={showTranscript}
                    aria-controls="sample-full-transcript"
                  >
                    <BookOpen size={14} />
                    {showTranscript
                      ? "Hide source data"
                      : `${formatTime(story.time)} · View in source data`}
                  </Button>
                  {showTranscript && (
                    <div id="sample-full-transcript" className={styles.transcript}>
                      <h3>The source rows</h3>
                      <p className={styles.helper}>
                        Illustrative cost data · Sample account. The cited row is highlighted.
                      </p>
                      {story.transcript.map((entry) => (
                        <button
                          id={`sample-line-${entry.id}`}
                          className={`transcript-line ${line === entry.id ? "current" : ""}`}
                          key={entry.id}
                          onClick={() => setLine(entry.id)}
                        >
                          <span>{formatTime(entry.time)}</span>
                          {entry.text}
                        </button>
                      ))}
                    </div>
                  )}
                </details>
              </article>
            </div>
          </div>
        </section>

        <div className={styles.start}>
          <div>
            <h2>What would you check first?</h2>
            <p>Start with one account and one scan. Your own workspace begins empty.</p>
            <p className={styles.previewNote}>
              This demo uses prepared findings. Live scanning, multi-cloud coverage and AI answers
              require a connected account. Azure and Google Cloud are coming soon.
            </p>
          </div>
          <Button href="/signup">
            Connect your first account <ArrowRight size={15} />
          </Button>
        </div>
      </div>
    </MarketingLayout>
  );
}
