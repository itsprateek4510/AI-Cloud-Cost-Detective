"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";

type Answer = "yes" | "no";

export function DocsHelpful() {
  const path = usePathname();
  const [answer, setAnswer] = useState<Answer | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(`cloudledger-docs-helpful:${path}`);
      setAnswer(saved === "yes" || saved === "no" ? saved : null);
    } catch {
      setAnswer(null);
    }
  }, [path]);

  function choose(value: Answer) {
    setAnswer(value);
    try {
      window.localStorage.setItem(`cloudledger-docs-helpful:${path}`, value);
    } catch {
      // Remembering the choice is a nicety; ignore storage failures.
    }
  }

  return (
    <section className="docs-helpful" aria-label="Was this helpful?">
      <p className="docs-helpful-question">Was this helpful?</p>
      {answer === null ? (
        <div className="docs-helpful-actions">
          <button type="button" onClick={() => choose("yes")}>
            <ThumbsUp size={16} aria-hidden /> Yes
          </button>
          <button type="button" onClick={() => choose("no")}>
            <ThumbsDown size={16} aria-hidden /> Not really
          </button>
        </div>
      ) : (
        <p className="docs-helpful-thanks" role="status">
          {answer === "yes"
            ? "Thank you — noted."
            : "Thank you. Please tell us what was missing so we can improve it."}{" "}
          <Link href="/contact">Send feedback</Link>
        </p>
      )}
    </section>
  );
}
