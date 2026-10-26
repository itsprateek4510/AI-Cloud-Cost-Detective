"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

export function Heading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="eco-heading">
      <div>
        {eyebrow && <span className="eco-eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}
export function ErrorState({ error }: { error: unknown }) {
  return error ? (
    <p className="eco-error" role="alert">
      {error instanceof Error ? error.message : String(error)}
    </p>
  ) : null;
}
export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="eco-empty">
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  bottomSheet = false,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  title: string;
  description: string;
  children: React.ReactNode;
  bottomSheet?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="eco-overlay" />
        <Dialog.Content className={`eco-dialog${bottomSheet ? " eco-bottom-sheet" : ""}`}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 20 }}>
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close aria-label="Close dialog">
              <X size={18} />
            </Dialog.Close>
          </div>
          <Dialog.Description>{description}</Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
