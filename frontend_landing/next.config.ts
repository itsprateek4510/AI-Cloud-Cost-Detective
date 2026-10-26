import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const config: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  turbopack: { root: process.cwd() },
  images: { remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }] },
  async rewrites() {
    const backend = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";
    return [
      { source: "/v1/:path*", destination: `${backend}/v1/:path*` },
      { source: "/health/:path*", destination: `${backend}/health/:path*` },
      { source: "/api/auth/:path*", destination: `${backend}/api/auth/:path*` },
    ];
  },
};

const withMDX = createMDX({ extension: /\.mdx?$/ });

export default withMDX(config);
