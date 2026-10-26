import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Cloud } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  href?: string;
  variant?: "primary" | "dark" | "outline" | "white";
  arrow?: boolean;
};

export function Button({
  href,
  variant = "primary",
  arrow,
  children,
  className = "",
  ...props
}: ButtonProps) {
  const classes = `button button-${variant} ${className}`;
  const content = (
    <>
      {children}
      {arrow && <ArrowUpRight size={16} />}
    </>
  );
  return href ? (
    <Link className={classes} href={href}>
      {content}
    </Link>
  ) : (
    <button className={classes} {...props}>
      {content}
    </button>
  );
}

export function Logo() {
  return (
    <Link href="/" className="brand" aria-label="CloudLedger home">
      <span className="brand-symbol">
        <Image src="/cloudledger-mark.svg" alt="" width={30} height={30} />
      </span>
      <span className="brand-word">CloudLedger</span>
    </Link>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="eyebrow">[ &nbsp;{children}&nbsp; ]</p>;
}

export function Waveform({ active = false }: { active?: boolean }) {
  return (
    <div className={`audio-wave ${active ? "is-active" : ""}`} aria-hidden="true">
      {Array.from({ length: 48 }, (_, i) => (
        <i
          key={i}
          style={{
            height: `${12 + ((i * 17 + i * i * 7) % 72)}%`,
            animationDelay: `${(i % 7) * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
}

export function PageHeading({
  label,
  title,
  description,
  children,
}: {
  label?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      {label && <SectionLabel>{label}</SectionLabel>}
      <h1>{title}</h1>
      {description && <p>{description}</p>}
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Cloud size={26} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
