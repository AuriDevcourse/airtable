"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

// Top menu shared across pages. Each link points at one speaker project/feed.
// Add a new entry here when a new event table gets its own page.
const PROJECTS = [
  { href: "/speakers-2026", label: "Speakers 2026" },
  { href: "/", label: "Speakers (all)" },
  { href: "/life-science", label: "Life Science 2026" },
  { href: "/niss", label: "NISS 2026" },
  { href: "/niss-2025", label: "NISS 2025" },
  { href: "/team", label: "Team" },
  { href: "/team/departments", label: "Team by dept" },
  { href: "/internal/team", label: "Team contacts (internal)" },
];

export function TopNav() {
  const pathname = usePathname();
  return (
    <header className="topnav">
      <div className="wrap topnav__inner">
        <Link href="/" className="topnav__brand">
          TechBBQ <span className="text-tbbq-gradient">Connector</span>
        </Link>
        <nav className="topnav__links" aria-label="Speaker projects">
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
      </div>
    </header>
  );
}
