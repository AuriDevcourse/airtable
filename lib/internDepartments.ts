// The intern pool's department list, in ONE place and in a module with no server imports.
//
// It lives here rather than in lib/interns.ts because three things need it and one of them runs in
// the browser: the feed (server), the embed builder, and the "Copy embed code" button, which is a
// client component. Importing it from lib/interns.ts would drag that file's Airtable fetcher and
// its `process.env.AIRTABLE_TOKEN` read into the client bundle.
//
// The alternative — a second copy of the list in the client component — is how a page and its embed
// end up disagreeing about which departments exist, which is the same class of bug as the side-event
// grid being 4 in one place and 3 in the other.
//
// The nine match the staff directory's options (DEPARTMENTS in lib/team.ts) and are deliberately a
// SEPARATE constant, not an import of it: the two agree today, and coupling them would mean an edit
// to the staff table's select silently regrouping the intern page.
export const INTERN_DEPARTMENTS = [
  "Management",
  "Event",
  "Finance",
  "Marketing",
  "Operations",
  "Partnerships",
  "PR and Communication",
  "Program",
  "Projects",
];
