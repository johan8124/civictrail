"use client";

import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { href: "#home", label: "Home" },
  { href: "#start-a-case", label: "Start a Case" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#evidence", label: "Evidence" },
  { href: "#about", label: "About" },
];

/**
 * Presentation-only scroll spy: the navigation link for the section currently
 * in view receives aria-current so the active state is real, not just a hover.
 */
export function Header() {
  const [active, setActive] = useState("#home");

  useEffect(() => {
    const sections = NAV_ITEMS.map((item) => document.querySelector(item.href)).filter(
      (el): el is Element => el !== null,
    );
    if (sections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActive(`#${visible.target.id}`);
      },
      { rootMargin: "-25% 0px -55% 0px", threshold: [0.01, 0.2, 0.5] },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      {/* Deliberate frosted band: the fixed bar never collides with section
          content scrolling underneath it — it always sits on its own surface. */}
      <div className="ct-header-scrim" aria-hidden="true" />
      <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <a href="#home" className="ct-lift flex items-center gap-3">
          <span className="liquid-glass flex h-10 w-10 items-center justify-center rounded-xl font-display text-sm tracking-widest text-neon">
            CT
          </span>
          <span className="leading-tight">
            <span className="block font-display text-lg uppercase tracking-widest text-cream">
              CivicTrail
            </span>
            <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-cream/60">
              AI + Civic workflow
            </span>
          </span>
        </a>

        <nav aria-label="Primary" className="liquid-glass hidden rounded-full px-2 py-1.5 md:block">
          <ul className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  aria-current={active === item.href ? "true" : undefined}
                  className="ct-nav-link rounded-full px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-cream/70 hover:text-cream"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <span className="ct-chip hidden lg:inline-flex">Evidence-first · Decision-support</span>

        <details className="relative md:hidden">
          <summary className="liquid-glass list-none rounded-xl px-4 py-2 font-mono text-xs uppercase tracking-wider text-cream/80 [&::-webkit-details-marker]:hidden">
            Menu
          </summary>
          <nav
            aria-label="Mobile"
            className="absolute right-0 top-12 w-52 rounded-xl border border-white/15 bg-[rgba(1,8,40,0.95)] p-2 backdrop-blur"
          >
            <ul>
              {NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="block rounded-lg px-3 py-2 font-mono text-xs uppercase tracking-wider text-cream/75 hover:bg-white/10 hover:text-cream"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </details>
      </div>
    </header>
  );
}
