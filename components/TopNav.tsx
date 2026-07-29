"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

// Top menu shared across pages. Each entry points at one speaker project/feed.
// Add a new entry here when a new event table gets its own page. Rendered as a
// dropdown — the tab row outgrew the header once the project count hit double digits.
const PROJECTS = [
  { href: "/all-speakers-2026", label: "All Speakers 2026" },
  { href: "/speakers-2026", label: "Speakers 2026" },
  { href: "/main-speakers", label: "Main Page 12" },
  { href: "/", label: "Speakers (all)" },
  { href: "/life-science", label: "Life Science 2026" },
  { href: "/niss", label: "NISS 2026" },
  { href: "/niss-2025", label: "NISS 2025" },
  { href: "/nass", label: "NASS 2026" },
  { href: "/investors", label: "Investors" },
  { href: "/team", label: "Team" },
];

export function TopNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const current = PROJECTS.find((p) => p.href === pathname);

  // Close on outside click and on Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Navigation closes the menu.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="topnav">
      <div className="wrap topnav__inner">
        <Link href="/" className="topnav__brand">
          TechBBQ <span className="text-tbbq-gradient">Connector</span>
        </Link>

        <div className="topnav__dropdown" ref={rootRef}>
          <button
            type="button"
            className="topnav__trigger"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {current?.label ?? "Projects"}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          {open && (
            <nav className="topnav__menu" aria-label="Speaker projects">
              {PROJECTS.map((p) => (
                <Link
                  key={p.href}
                  href={p.href}
                  aria-current={pathname === p.href ? "page" : undefined}
                >
                  {p.label}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}
