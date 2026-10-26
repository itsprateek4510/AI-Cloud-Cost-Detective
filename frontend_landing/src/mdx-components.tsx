import type { MDXComponents } from "mdx/types";
import type { AnchorHTMLAttributes, HTMLAttributes } from "react";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function textOf(children: React.ReactNode): string {
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(textOf).join("");
  if (children && typeof children === "object" && "props" in children) {
    return textOf((children as { props: { children?: React.ReactNode } }).props.children);
  }
  return "";
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h2: ({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
      <h2 id={slugify(textOf(children))} {...props}>
        {children}
      </h2>
    ),
    h3: ({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
      <h3 id={slugify(textOf(children))} {...props}>
        {children}
      </h3>
    ),
    a: ({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
      <a href={href} {...props} />
    ),
    ...components,
  };
}
