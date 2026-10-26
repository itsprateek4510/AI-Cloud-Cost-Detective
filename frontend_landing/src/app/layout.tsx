import type { Metadata } from "next";
import "./globals.css";

const title = "CloudLedger: Your cloud bill, explained and fixed.";
const description =
  "Connect AWS, Azure and Google Cloud with read-only access. Find waste, understand spikes, and approve fixes. Every number has a source.";
const image = "/cloudledger-og.png";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: title,
    template: "%s · CloudLedger",
  },
  description,
  openGraph: {
    type: "website",
    siteName: "CloudLedger",
    title,
    description,
    images: [{ url: image, alt: title }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [image],
  },
  icons: {
    icon: {
      url: "/cloudledger-mark.svg",
      type: "image/svg+xml",
    },
  },
} as Metadata;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
