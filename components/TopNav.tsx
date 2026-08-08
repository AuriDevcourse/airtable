"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { INVESTOR_EVENTS, SECTIONS } from "@/lib/pages";

// Top menu shared across pages, rendered as a grouped dropdown, BUILT FROM lib/pages.ts.
//
// It used to hold its own hardcoded copy of the page list, and by 2026-08-08 that copy and the
// front page's had drifted: /interns was here but not there, and The Policy Stage and Future of
// Fintech sat under "Projects" here and under "Event Rooms" there. Same page, two stories
// depending on how you arrived. Adding a page is now one line in lib/pages.ts and it lands in
// both places with the same grouping.
//
// The only thing this menu adds is the investor deep-links: /investors?event=… preselects an
// event on a page that already exists (see app/investors/page.tsx), so they are shortcuts rather
// than pages and are not on the front-page grid.
type MenuItem = { href: string; label: string };
type MenuGroup = { heading: string; items: MenuItem[] };

const MENU: MenuGroup[] = [
  ...SECTIONS.map((s) => ({
    heading: s.title,
    // A per-year entry is ONE card on the front page with a link per year, but a dropdown has no
    // room for that, so it expands back into one line per year: "NISS 2026", "NISS 2025".
    items: s.items.flatMap((i) =>
      i.years
        ? i.years.map((y) => ({ href: y.href, label: `${i.label} ${y.label}` }))
        : [{ href: i.href, label: i.label }],
    ),
  })),
  {
    heading: "Investor events",
    items: INVESTOR_EVENTS.map((i) => ({ href: i.href, label: i.label })),
  },
];

// This nav sits in the root layout, so useSearchParams needs a Suspense boundary here or
// every prerendered page inherits the requirement. Until the params resolve, the fallback
// renders the same header matched on pathname alone — the only difference is which investor
// event reads as current, so nothing visibly jumps.
export function TopNav() {
  return (
    <Suspense fallback={<TopNavShell search="" />}>
      <TopNavShellWithParams />
    </Suspense>
  );
}

function TopNavShellWithParams() {
  // Query-only navigations (/investors?event=lp-forum → ?event=investor-day) do not change
  // the pathname and do not remount this component, so reading window.location in an effect
  // keyed on pathname left the trigger showing the previous event. useSearchParams re-renders
  // on every navigation, query included.
  const search = useSearchParams().toString();
  return <TopNavShell search={search ? `?${search}` : ""} />;
}

function TopNavShell({ search }: { search: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // The trigger shows where you are. Exact href match (path + query) wins so
  // "/investors?event=lp-forum" beats the bare "/investors" entry; a path-only match is
  // the fallback for a page reached without the param.
  const current = useMemo(() => {
    const items = MENU.flatMap((g) => g.items);
    const full = pathname + search;
    return (
      items.find((i) => i.href === full) ??
      items.find((i) => i.href === pathname) ??
      items.find((i) => i.href.split("?")[0] === pathname)
    );
  }, [pathname, search]);

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
            {/* "All pages" rather than a guess: the only page with no entry of its own is the
                hub at "/", where nothing is selected yet. */}
            {current?.label ?? "All pages"}
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
            <nav className="topnav__menu" aria-label="Pages">
              {MENU.map((group) => (
                <div key={group.heading} className="topnav__group">
                  <p className="topnav__heading">{group.heading}</p>
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={item.href === current?.href ? "page" : undefined}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              ))}
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}
