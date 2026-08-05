"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";

// Top menu shared across pages, rendered as a grouped dropdown. The flat list outgrew
// itself once the page count passed a dozen, so entries are grouped by what they are:
//
//   Speakers            the main 2026 rosters
//   Projects            the per-event speaker feeds (Life Science, NISS, NASS, Fintech)
//   Investors           the investor roster plus one entry per investor event
//   Program & internal  agendas, the staff directory, and the ticket lookup
//
// Investor-event entries deep-link into /investors with ?event=… preselected; that page
// reads the param on mount (see app/investors/page.tsx).
//
// Adding a page = one line in the right group.
type MenuItem = { href: string; label: string };
type MenuGroup = { heading: string; items: MenuItem[] };

const MENU: MenuGroup[] = [
  {
    heading: "Speakers",
    items: [
      { href: "/all-speakers-2026", label: "All Speakers 2026" },
      { href: "/speakers-2026", label: "Speakers 2026" },
      { href: "/main-speakers", label: "Main Page 12" },
      // Moved off "/" on 2026-08-05: the front page is now the hub that groups every page in
      // here (app/page.tsx). The feed and the embed snippet are unchanged.
      { href: "/speakers", label: "Speakers (all)" },
    ],
  },
  {
    heading: "Projects",
    items: [
      { href: "/life-science", label: "Life Science 2026" },
      { href: "/ls-startups", label: "Life Science Startups" },
      { href: "/niss", label: "NISS 2026" },
      { href: "/nass", label: "NASS 2026" },
      { href: "/fintech-speakers", label: "Fintech Speakers" },
      { href: "/policy-lounge", label: "The Policy Lounge" },
      { href: "/niss-2025", label: "NISS 2025" },
    ],
  },
  {
    heading: "Investors",
    items: [
      { href: "/investors", label: "All investor speakers" },
      { href: "/investors?event=lp-forum", label: "LP Forum" },
      { href: "/investors?event=investor-day", label: "TechBBQ Investor Day" },
      { href: "/investors?event=pension-summit", label: "Pension & Insurance Summit" },
    ],
  },
  {
    heading: "Program & internal",
    items: [
      // /brella-program is THE TechBBQ program (Brella, the one on techbbq.dk). /program is
      // the other events' agendas, so it no longer competes for the "Program 2026" name.
      { href: "/brella-program", label: "Program 2026" },
      { href: "/program", label: "TechBBQ Project Programs" },
      { href: "/partner-events", label: "Side Events & Event Rooms" },
      { href: "/partners", label: "Partners 2026" },
      { href: "/team", label: "Team" },
      { href: "/lookup", label: "Ticket lookup" },
    ],
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
