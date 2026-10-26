"use client";

import { Plus } from "lucide-react";
import { faqs } from "@/lib/data";

export function FAQ({ items = faqs }: { items?: readonly (readonly [string, string])[] }) {
  return (
    <div className="faq-list">
      {items.map(([question, answer]) => (
        <details
          key={question}
          onPointerEnter={(e) => {
            if (e.pointerType !== "mouse") return;
            e.currentTarget.dataset.hover = "1";
            e.currentTarget.open = true;
          }}
          onPointerLeave={(e) => {
            if (e.pointerType !== "mouse") return;
            delete e.currentTarget.dataset.hover;
            e.currentTarget.open = false;
          }}
          onClick={(e) => {
            // When hover already opened the item, swallow the native toggle so
            // a click doesn't instantly re-close it. Touch and keyboard
            // (no hover flag) keep native details behavior.
            if (e.currentTarget.dataset.hover) e.preventDefault();
          }}
        >
          <summary>
            {question}
            <Plus size={16} />
          </summary>
          <p>{answer}</p>
        </details>
      ))}
    </div>
  );
}
