import { HeroBackdrop } from "@/components/HeroBackdrop";
import { EventGuide } from "@/components/EventGuide";
import { CopyEventGuideEmbed } from "@/components/CopyEventGuideEmbed";
import { GUIDE_SECTIONS, assertUniqueKeys, guideItems } from "@/lib/eventGuide";

// THE EVENT GUIDE — practical attendee information, in the staging techbbq.dk layout.
//
// The odd one out among the pages here: NO FETCH AND NO LOADING STATE. The content is a
// TypeScript file (lib/eventGuide.ts) rendered on the server, so there is no useCachedList, no
// skeleton and no Refresh button, because there is nothing to refresh from — a copy change ships
// in a deploy. /api/event-guide exists for the pasted embed, not for this page.
//
// TYPEFACE: Onest, inherited from the app's own --font-heading like every other page. An earlier
// version loaded Archivo here to match the staging design; Auri corrected that to Onest
// (2026-08-11), which also means this page needs no font import of its own.
export const metadata = {
  title: "Event Guide · TechBBQ Airtable Connector",
  description: "Practical information for TechBBQ 2026 attendees, and the embed for techbbq.dk.",
};

export default function EventGuidePage() {
  // Item keys become element ids and aria-controls targets. A duplicate would wire a tab to
  // another panel and read as a CSS bug, so the page refuses to render instead.
  assertUniqueKeys();

  const total = guideItems().length;

  return (
    <main>
      <section className="hero">
        <HeroBackdrop image="/backgrounds/bg-landscape-3.jpg" />
        <div className="wrap hero__inner">
          <p className="eyebrow">Event Guide · hand-written content, not Airtable</p>
          <h1>
            TechBBQ 2026 <span className="text-tbbq-gradient">Guide</span>
          </h1>
          <p className="lede">
            {total} items across {GUIDE_SECTIONS.length} sections · tabs instead of the old popup
            grid · served as JSON at <code>/api/event-guide</code>. The copy lives in{" "}
            <code>lib/eventGuide.ts</code>, so an edit is a deploy, not an Airtable change.
          </p>

          <div
            style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}
          >
            <CopyEventGuideEmbed />
            <span className="lede" style={{ margin: 0, fontSize: 13 }}>
              One self-contained snippet for the whole guide, for an Elementor HTML widget. No hero,
              because the WordPress page has its own title. Copy from the deployed dashboard, not
              localhost.
            </span>
          </div>
        </div>
      </section>

      <div className="eg-page">
        <EventGuide sections={GUIDE_SECTIONS} />
      </div>
    </main>
  );
}
