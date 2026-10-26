"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import styles from "./scroll-motion.module.css";

export function ScrollMotion() {
  const pathname = usePathname();
  const progress = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const main = document.getElementById("main");
    if (!main) return;

    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let stop = () => {};

    const setup = () => {
      stop();
      if (preference.matches) {
        if (progress.current) progress.current.style.transform = "scaleX(0)";
        return;
      }

      const animations = new Set<Animation>();
      const selector = [
        ".hero-copy",
        ".hero figure",
        ".page-heading",
        ".section-title",
        ".section-head-row",
        ".how-grid",
        "section article",
        ".faq-list details",
        ".yearly-plan",
        "section h2",
        "section > .container > p",
      ].join(",");
      const candidates = [...main.querySelectorAll<HTMLElement>(selector)];
      const selected = new Set(candidates);
      // Animate a group or its contents, never both: nested transforms feel heavy.
      const targets = candidates.filter((element) => {
        let parent = element.parentElement;
        while (parent && parent !== main) {
          if (selected.has(parent)) return false;
          parent = parent.parentElement;
        }
        return true;
      });

      const observer = new IntersectionObserver(
        (entries) => {
          const entering = entries.filter((entry) => entry.isIntersecting);
          entering.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          entering.forEach((entry, index) => {
            observer.unobserve(entry.target);
            // Do not replay content above the viewport when navigating to an anchor.
            if (entry.boundingClientRect.bottom <= 0) return;
            const animation = entry.target.animate(
              [
                { opacity: 0, transform: "translate3d(0, 22px, 0)" },
                { opacity: 1, transform: "translate3d(0, 0, 0)" },
              ],
              {
                duration: 720,
                delay: Math.min(index * 70, 210),
                easing: "cubic-bezier(0.22, 1, 0.36, 1)",
                fill: "backwards",
              },
            );
            animations.add(animation);
            animation.onfinish = () => animations.delete(animation);
          });
        },
        { threshold: 0.08, rootMargin: "0px 0px -24px 0px" },
      );
      targets.forEach((target) => observer.observe(target));

      let frame = 0;
      const update = () => {
        frame = 0;
        const distance = document.documentElement.scrollHeight - window.innerHeight;
        const value = distance > 0 ? Math.max(0, Math.min(1, window.scrollY / distance)) : 0;
        if (progress.current) progress.current.style.transform = `scaleX(${value})`;
      };
      const schedule = () => {
        if (!frame) frame = requestAnimationFrame(update);
      };
      window.addEventListener("scroll", schedule, { passive: true });
      window.addEventListener("resize", schedule);
      const resize = new ResizeObserver(schedule);
      resize.observe(main);
      update();

      stop = () => {
        observer.disconnect();
        resize.disconnect();
        animations.forEach((animation) => animation.cancel());
        animations.clear();
        window.removeEventListener("scroll", schedule);
        window.removeEventListener("resize", schedule);
        cancelAnimationFrame(frame);
      };
    };

    setup();
    preference.addEventListener("change", setup);
    return () => {
      stop();
      preference.removeEventListener("change", setup);
    };
  }, [pathname]);

  return <div ref={progress} className={styles.progress} aria-hidden="true" />;
}
