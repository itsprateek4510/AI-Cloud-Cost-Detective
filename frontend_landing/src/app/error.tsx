"use client";
import { Button } from "@/components/ui";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="container section narrow stack">
      <h1>Something interrupted the page.</h1>
      <p>
        Please try loading this page again. If the problem continues, contact us and tell us
        what you were doing.
      </p>
      <div className="button-row">
        <Button onClick={reset}>Try again</Button>
        <Button href="/" variant="outline">
          Back home
        </Button>
      </div>
    </main>
  );
}
