"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import type { GuideBlock, GuideItem, GuideSection } from "@/lib/eventGuide";

// The Event Guide as the dashboard renders it. The pasted Elementor version is a separate
// vanilla port in lib/eventGuideSnippet.ts — same markup and the same class names, so a CSS
// change here has an obvious counterpart there.
//
// One <GuideTabs> per section, each holding its own selected index. Sections are independent:
// changing tab under "Safety" must not move the panel under "Event Essentials".

/**
 * Render `[label](url)` links in authored copy, escaping everything else.
 *
 * React escapes text nodes for us, so the danger here is only in what we choose to turn into an
 * element. Nothing but this one bracket form is interpreted, and the href is checked against a
 * scheme allow-list, so a `javascript:` URL in the data file cannot become a live link
 * (SECURITY r4 — the copy is ours today, and the file is exactly the kind a hurried edit lands in).
 */
const SAFE_HREF = /^(https?:\/\/|mailto:|#|\/)/i;

function linkify(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const [, label, href] = m;
    if (SAFE_HREF.test(href)) {
      const external = /^https?:/i.test(href);
      out.push(
        <a
          key={`l${i++}`}
          href={href}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {label}
        </a>
      );
    } else {
      // Refused rather than dropped: the label still reads, so a bad href shows up as a missing
      // link instead of missing words.
      out.push(label);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Block({ block }: { block: GuideBlock }) {
  if (block.kind === "list") {
    return (
      <div>
        {block.lead ? <p className="eg-lead">{block.lead}</p> : null}
        <ul className="eg-list">
          {block.items.map((item, i) => (
            <li key={i}>{linkify(item)}</li>
          ))}
        </ul>
      </div>
    );
  }
  if (block.kind === "schedule") {
    return (
      <div className="eg-schedule">
        <p className="eg-day">{block.day}</p>
        <ul className="eg-list">
          {block.rows.map((row, i) => (
            <li key={i}>{row}</li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <p>
      {block.lead ? <span className="eg-lead">{block.lead} </span> : null}
      {linkify(block.text)}
    </p>
  );
}

function Panel({
  item,
  id,
  labelledBy,
  active,
  showImage,
}: {
  item: GuideItem;
  id: string;
  labelledBy: string;
  active: boolean;
  /**
   * Whether to mount the <img> at all. EVERY panel is in the DOM (that is what keeps the section
   * height fixed), but a section of eight would then pull eight photos for the one being read.
   * The figure reserves its space through aspect-ratio either way, so adding the image later
   * changes nothing about the layout.
   */
  showImage: boolean;
}) {
  return (
    <div
      className="eg-panel"
      role="tabpanel"
      id={id}
      aria-labelledby={labelledBy}
      data-active={active ? "true" : "false"}
      tabIndex={active ? 0 : -1}
      aria-hidden={active ? undefined : true}
      // `inert` is what actually keeps a hidden panel's links off the keyboard and out of a
      // screen reader. aria-hidden alone leaves them focusable, which is how you end up tabbing
      // into a panel nobody can see.
      inert={active ? undefined : true}
    >
      <div>
        <p className="eg-eyebrow">{item.eyebrow || item.tab}</p>
        <h3 className="eg-panel__title">{item.title}</h3>
        <div className="eg-body">
          {item.blocks.map((block, i) => (
            <Block key={i} block={block} />
          ))}
        </div>
        {item.tags?.length ? (
          <ul className="eg-tags">
            {item.tags.map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
        ) : null}
      </div>
      {/* Photo second in the DOM so a screen reader hears the answer before the decoration, and
          moved above the text on narrow screens by CSS grid-row rather than by duplicating it. */}
      <figure className="eg-panel__media">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote WordPress media, and this
          // markup is mirrored by the vanilla embed which has no next/image.
          <img src={item.image} alt={item.alt} loading="lazy" decoding="async" />
        ) : null}
      </figure>
    </div>
  );
}

function GuideTabs({ section }: { section: GuideSection }) {
  const [active, setActive] = useState(0);
  // Which panels have ever been shown, so their photo stays mounted and coming back to a tab is
  // instant instead of a second download.
  const [visited, setVisited] = useState<Set<number>>(() => new Set([0]));
  const uid = useId().replace(/:/g, "");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const slotRef = useRef<HTMLDivElement | null>(null);
  // The slot's height BEFORE the swap. Captured in the click handler rather than remembered from
  // the last render, so a window resize in between cannot make the animation start from a stale
  // number.
  const fromHeight = useRef<number | null>(null);

  function show(i: number) {
    if (i === active) return;
    fromHeight.current = slotRef.current?.offsetHeight ?? null;
    setActive(i);
    setVisited((prev) => (prev.has(i) ? prev : new Set(prev).add(i)));
  }

  /**
   * Animate the slot from the outgoing panel's height to the incoming one's.
   *
   * Height cannot be transitioned to `auto`, so this measures the new height with the style
   * cleared, then transitions between two explicit pixel values and hands the height back to auto
   * once it lands. Leaving it pinned would break reflow on a window resize.
   *
   * useLayoutEffect, not useEffect: it has to run before the browser paints, or the new panel
   * flashes at its full height for a frame and the animation starts from the wrong place.
   */
  useLayoutEffect(() => {
    const slot = slotRef.current;
    const from = fromHeight.current;
    fromHeight.current = null;
    if (!slot || from == null) return;

    slot.style.height = "";
    const to = slot.offsetHeight;
    if (from === to) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    slot.style.height = `${from}px`;
    // Force the browser to accept the start value before changing it, or both writes collapse
    // into one style recalculation and nothing animates.
    void slot.offsetHeight;
    slot.style.height = `${to}px`;

    function done(e: TransitionEvent) {
      if (e.propertyName !== "height" || !slotRef.current) return;
      slotRef.current.style.height = "";
      slotRef.current.removeEventListener("transitionend", done);
    }
    slot.addEventListener("transitionend", done);
    return () => slot.removeEventListener("transitionend", done);
  }, [active]);

  const tabId = (i: number) => `eg-tab-${uid}-${section.items[i].key}`;
  const panelId = (i: number) => `eg-panel-${uid}-${section.items[i].key}`;

  /**
   * Arrow keys move between tabs, which is what a tablist is expected to do — without this the
   * pills are reachable but a keyboard user has to Tab through every one of the eight under
   * "On-Site Experience" to read the last panel. Home/End jump to the ends.
   */
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const last = section.items.length - 1;
    let next: number | null = null;
    if (e.key === "ArrowRight") next = active === last ? 0 : active + 1;
    else if (e.key === "ArrowLeft") next = active === 0 ? last : active - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    if (next === null) return;
    e.preventDefault();
    show(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <section className="eg-section" aria-labelledby={`eg-h-${uid}`}>
      <h2 className="eg-section__title" id={`eg-h-${uid}`}>
        {section.title}
      </h2>
      <div className="eg-tabs" role="tablist" aria-label={section.title} onKeyDown={onKeyDown}>
        {section.items.map((item, i) => (
          <button
            key={item.key}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            type="button"
            className="eg-tab"
            role="tab"
            id={tabId(i)}
            aria-selected={i === active}
            aria-controls={panelId(i)}
            // Only the selected tab is in the tab order; the arrow keys handle the rest. This is
            // the standard tablist pattern and the reason onKeyDown above exists.
            tabIndex={i === active ? 0 : -1}
            onClick={() => show(i)}
          >
            {item.tab}
          </button>
        ))}
      </div>
      {/* EVERY panel is rendered; only the active one is in flow, so the slot is exactly as tall
          as the panel being read (see .eg-slot). Photos are deferred — the text of all eight is
          cheap, eight images are not. */}
      <div className="eg-slot" ref={slotRef}>
        {section.items.map((item, i) => (
          <Panel
            key={item.key}
            item={item}
            id={panelId(i)}
            labelledBy={tabId(i)}
            active={i === active}
            showImage={visited.has(i)}
          />
        ))}
      </div>
    </section>
  );
}

// NO F.A.Q. The staging design has one and this component rendered it until Auri removed it
// (2026-08-11) — see the note in lib/eventGuide.ts for why the answers could not have shipped.
export function EventGuide({ sections }: { sections: GuideSection[] }) {
  return (
    <div className="eg-wrap">
      {sections.map((section) => (
        <GuideTabs key={section.key} section={section} />
      ))}
    </div>
  );
}
