---
version: 1
slug: "src-components-dashboard-tsx"
primary_target: "src/components/dashboard.tsx"
related_targets: ["src/components/board.tsx","src/components/detail.tsx","src/components/auth.tsx","src/components/internal-docs.tsx","src/app/styles/components.css"]
---

# Platform visual redesign

Mode: Operate. Scope: every existing workspace module, record detail and editor, authentication, external Trip view, and help. The six user images are style inspiration, not a topology specification. All existing actions, routes, handlers, permissions and flow remain authoritative.

## Direction contract

THESIS: A calm travel desk: clear operational content, compact useful facts, and separated work surfaces. Replace the old green-tinted, uniformly boxed dashboard composition with a floating navigation panel, open work canvas, information strips, and deliberately grouped content.

OWN-WORLD: White floating navigation on a cool neutral canvas; charcoal actions; quiet sage, blue and amber only for data/context/state. Plus Jakarta Sans with distinct 12px metadata, 13–15px content and 26–32px page headings. Cards use restrained 12–14px corners and fine neutral outlines.

STORY: The person identifies their work context, scans existing tasks or records, narrows through the existing filters, and uses the same actions. Trip facts use a two-part date/guest grouping. Task cards distinguish content from deadline, owner and status controls. No extra step, new KPI or decorative data.

FIRST VIEWPORT: A 220px labelled navigation panel sits 16px inside the desktop frame. Breadcrumbs stay above the work canvas; title/action row, compact summary strip and scoped controls align to the board/table edges. Phones use the existing drawer, 16px content gutters, horizontally scrollable boards/tables, stacked record details and two-column filters where legible.

FORM: User-pinned clean modern operational UI governs the visual result and retains incumbent navigation topology. seed:83b9c998059cd9dd. Taste achromatic-ledger principles inform color restraint; the user's references and existing identity control palette and typography. All seven candidate families (travel publication, service directory, itinerary folio, calm travel desk, passenger manifest, team notebook, cash ledger) were constrained to the existing workflows; the seeded fourth is the calm travel desk. The user explicitly rejected the first pass as only changing color; final review must evaluate component composition and hierarchy as well as palette.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

No new raster assets. Existing Egimu brand image is preserved. Browser fixtures are synthetic and stay in .local; they are never application fallbacks or production data. Physical phone interaction and software keyboard behavior remain hardware checks.
