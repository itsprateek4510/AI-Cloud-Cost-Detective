"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  ChevronDown,
  Menu,
  X,
  Heart,
  Building2,
  BookOpen,
  ShieldCheck,
  MessageCircle,
  Cloud,
} from "lucide-react";
import { Button, Logo } from "./ui";
import { ScrollMotion } from "./marketing/scroll-motion";
import ending from "./marketing/ending.module.css";
import "./marketing/theme.css";

export { Logo } from "./ui";

const groups = [
  {
    title: "Solutions",
    links: [
      {
        href: "/for/families",
        title: "For startups",
        text: "Make your credits last.",
        icon: Heart,
      },
      {
        href: "/for/business-families",
        title: "For agencies and MSPs",
        text: "Every client. One dashboard.",
        icon: Building2,
      },
    ],
  },
  {
    title: "Resources",
    links: [
      {
        href: "/integrations",
        title: "Cloud integrations",
        text: "Connect AWS with read-only access.",
        icon: Cloud,
      },
      {
        href: "/sample",
        title: "Sample report",
        text: "Explore a fictional startup’s bill.",
        icon: BookOpen,
      },
      {
        href: "/trust",
        title: "Trust & security",
        text: "Read-only access. Your data, yours.",
        icon: ShieldCheck,
      },
      {
        href: "/faq",
        title: "Frequently asked questions",
        text: "A few things you might be wondering.",
        icon: MessageCircle,
      },
    ],
  },
];

export function Nav() {
  const [menu, setMenu] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const path = usePathname();
  const header = useRef<HTMLElement>(null);

  useEffect(() => {
    setMobile(false);
    setMenu(null);
  }, [path]);
  useEffect(() => {
    if (!mobile) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobile]);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!header.current?.contains(e.target as Node)) setMenu(null);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(null);
        setMobile(false);
      }
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  return (
    <header className="site-nav" ref={header}>
      <div className="container nav-inner">
        <Logo />
        <nav className="desktop-links" aria-label="Main navigation">
          {groups.map((group) => (
            <div
              className="nav-group"
              key={group.title}
              onMouseEnter={() => setMenu(group.title)}
              onMouseLeave={() => setMenu(null)}
            >
              <button
                className="nav-link"
                onClick={() => setMenu(menu === group.title ? null : group.title)}
                aria-expanded={menu === group.title}
                aria-controls={`nav-${group.title}`}
              >
                {group.title}
                <ChevronDown size={13} />
              </button>
              {menu === group.title && (
                <div className="nav-dropdown" id={`nav-${group.title}`}>
                  {group.links.map((item) => (
                    <Link href={item.href} key={item.href} onClick={() => setMenu(null)}>
                      <item.icon size={20} />
                      <span>
                        <strong>{item.title}</strong>
                        <small>{item.text}</small>
                      </span>
                      <ArrowUpRight size={15} />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
          <Link href="/pricing">Pricing</Link>
          <Link href="/about">About</Link>
          <Link href="/book">Talk to us</Link>
        </nav>
        <div className="nav-actions">
          <Button href="/signup" variant="dark">
            Start for Free
          </Button>
          <button
            className="menu-toggle icon-button"
            onClick={() => setMobile(!mobile)}
            aria-label={mobile ? "Close navigation" : "Open navigation"}
            aria-expanded={mobile}
          >
            {mobile ? <X /> : <Menu />}
          </button>
        </div>
      </div>
      {mobile && (
        <nav className="mobile-menu" aria-label="Mobile navigation">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="eyebrow">{group.title}</p>
              {group.links.map((item) => (
                <Link href={item.href} key={item.href} onClick={() => setMobile(false)}>
                  {item.title}
                  <ArrowUpRight size={18} />
                </Link>
              ))}
            </div>
          ))}
          <Link href="/pricing">Pricing</Link>
          <Link href="/about">About</Link>
          <Link href="/book">Talk to us</Link>
          <Link href="/login">Sign in</Link>
        </nav>
      )}
    </header>
  );
}

export function Footer() {
  const columns = [
    {
      title: "Solutions",
      links: [
        ["/for/families", "Startups"],
        ["/for/business-families", "Agencies & MSPs"],
        ["/book?type=story", "Cloud audits"],
        ["/pricing", "Plans & pricing"],
      ],
    },
    {
      title: "Resources",
      links: [
        ["/sample", "Sample report"],
        ["/trust", "Trust & security"],
        ["/faq", "FAQs"],
        ["/login", "Log in"],
      ],
    },
    {
      title: "Company",
      links: [
        ["/about", "About"],
        ["/contact", "Get in touch"],
        ["/book", "Book a demo"],
      ],
    },
  ];
  return (
    <footer className={`site-footer ${ending.footer}`}>
      <div className="container footer-grid">
        <div className="footer-brand">
          <Logo />
          <p className={ending.footerMotto}>
            See it. Explain it.
            <br />
            <span>Fix it.</span>
          </p>
          <div className={ending.footerSignature}>
            <span className={ending.signatureLine} aria-hidden="true" />
            <span>BUILT FOR TEAMS WHO OWN THE BILL.</span>
          </div>
        </div>
        {columns.map((column) => (
          <nav
            className="footer-column"
            key={column.title}
            aria-label={`${column.title} footer links`}
          >
            <h4>{column.title}</h4>
            {column.links.map(([href, text]) => (
              <Link href={href} key={href}>
                {text}
                <ArrowUpRight size={12} aria-hidden="true" />
              </Link>
            ))}
          </nav>
        ))}
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} CloudLedger. Your data belongs to you.</span>
        <div className={ending.footerEnd}>
          <nav className={ending.legalLinks} aria-label="Legal footer links">
            <Link href="/legal/privacy">Privacy policy</Link>
            <Link href="/legal/terms">Terms of use</Link>
          </nav>
          <a href="#main" className={ending.backTop}>
            Back to top <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        </div>
      </div>
    </footer>
  );
}

export function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main id="main" className="marketing-main">{children}</main>
      <Footer />
      <ScrollMotion />
    </>
  );
}
