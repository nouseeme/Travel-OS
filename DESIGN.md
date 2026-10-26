---
name: "travelOS · Egimu Travel"
description: "A calm travel desk for readable operational work."
colors:
  bg: "#f6f7f9"
  paper: "#ffffff"
  ink: "#242a30"
  action: "#252b31"
  green: "#326652"
  green-soft: "#edf4f0"
  warm: "#fcf5e8"
  red: "#ab453d"
  muted: "#626b74"
  line: "#e5e8ec"
  control-border: "#cbd1d8"
  surface-soft: "#f7f8fa"
  surface-inset: "#f3f5f7"
  chart-accent: "#4c7866"
  chart-comparison: "#b6c5be"
typography:
  task-title:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 550
    lineHeight: 1.5
  source-code:
    fontFamily: "Consolas, monospace"
    fontSize: "0.75rem"
    lineHeight: 1.9
  headline:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "clamp(1.625rem, 2.1vw, 2rem)"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "-0.04em"
  title:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 650
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  card-title:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  editor:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "1rem"
    lineHeight: 1.8
  label:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 550
    lineHeight: 1.5
  metric:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-0.04em"
rounded:
  tag: "5px"
  compact: "6px"
  sm: "8px"
  board-card: "10px"
  card: "12px"
  panel: "14px"
  navigation: "16px"
  auth: "20px"
spacing:
  space-1: "4px"
  space-2: "8px"
  space-3: "12px"
  space-4: "16px"
  space-5: "20px"
  space-6: "24px"
  space-8: "32px"
  space-10: "40px"
components:
  task-item:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "12px"
  public-panel:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "24px"
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
  button-ghost:
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
  button-danger:
    backgroundColor: "#a4473b"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
  navigation:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.navigation}"
    padding: "24px 12px 0"
    width: "220px"
  chip-neutral:
    backgroundColor: "#f0f2f4"
    textColor: "{colors.muted}"
    rounded: "{rounded.tag}"
    padding: "3px 7px"
  board-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.board-card}"
    padding: "14px"
  panel:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "24px"
  metric-strip:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.panel}"
  notes-editor:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.editor}"
---

# Design System: travelOS · Egimu Travel

## Overview

**Creative North Star: "A calm travel desk"**

The workspace presents operational information on a cool neutral canvas with white work surfaces, charcoal actions, and quiet semantic color. A floating labelled navigation panel, open columns, grouped facts, and shared metric strips make context and work easy to skim. Plus Jakarta Sans supplies both headings and working text.

The visual system describes the implemented October 26, 2026 redesign. Preserve travelOS, Egimu Travel, and the existing brand image at `public/brand/egimu-logo.jpg`. Existing routes, actions, forms, permission boundaries, financial meanings, and recovery behavior remain authoritative. See PRODUCT.md for product constraints and the surface brief for the approved direction; this document records reusable visual rules.

**Key Characteristics:**

- Cool neutral canvas and white work surfaces.
- Charcoal actions with restrained semantic sage, blue, and amber.
- Readable facts and metadata grouped by meaning.
- Flat surfaces with fine outlines and quiet interaction feedback.
- The same operational capabilities across desktop and narrow screens.

## Colors

The frontmatter records the reusable CSS palette; component-specific status colors remain local to their existing semantic variants.

### Primary

- **Charcoal Action** (`action`): filled primary buttons and prominent help entry actions.
- **Desk Sage** (`green`): positive values, selected editor controls, links, focus, and meaningful state; **Soft Sage** (`green-soft`) supports selected or focused contexts.
- **Chart Sage** (`chart-accent`) and **Comparison Sage** (`chart-comparison`): current and comparison data series.

### Neutral

- **Cool Canvas** (`bg`): the outer workspace and authentication frame.
- **White Paper** (`paper`): navigation, panels, cards, and fields.
- **Working Ink** (`ink`) and **Muted Slate** (`muted`): primary content and secondary metadata.
- **Fine Line** (`line`) and **Control Stroke** (`control-border`): surface separation and stronger field boundaries.
- **Soft Surface** (`surface-soft`) and **Inset Surface** (`surface-inset`): quiet secondary contexts and segmented controls.

Warm (`warm`) and red (`red`) are semantic signals for warning/overdue and negative financial or error information. Existing lead tags use a pale blue fill; Trip tags use a pale sage fill. Keep their text labels visible.

**The Semantic Accent Rule.** Use accent color to communicate data, state, focus, or an existing link; keep everyday navigation and primary actions neutral.

## Typography

The existing raw Markdown source field (`.markdown-input`) uses Consolas, monospace at 12px/1.9. This is a source-code role only; interface text continues to use Plus Jakarta Sans.

**Display Font:** Plus Jakarta Sans, with system-ui and sans-serif fallbacks.
**Body Font:** The same family, loaded locally as a variable font with weights 200–800. The CSS family resolves through `--font-jakarta` and `--font-sans`.

Use the frontmatter hierarchy for page headings, section titles, card titles, working text, metadata, and metrics. The system uses a practical role-based scale rather than a fixed modular ratio. Secondary descriptions and table cells commonly use 13px. Base metadata is 12px; base body is 14px. Editor text is 16px with roomier leading.

Page headings range from 26–32px. Detail headings use 28px and reduce to 24px on phones. Authentication story headings range from 28–36px; help article headings range from 28–38px. These are local hierarchy variants, not a second display family. Ordinary counters use tabular numerals; cash metrics use `clamp(1.375rem, 1.8vw, 1.875rem)` and weight 550. Phone counters reduce to 28px and phone cash figures to 22px.

## Layout

Public Share Trip uses the same neutral palette in a centered 1080px shell, with 24px outer padding and a white branded header. Public content is full-width within this shell; tabs stay in one horizontal row. Phone outer padding is 12px, panel padding is 18px by 16px, and the title aligns to the panel edge. Public overview includes the published date/guest facts; internal stage identifiers and workspace-only chrome are not displayed. Shared modal forms use the common field spacing. Existing viewer/editor permissions and every sharing action remain authoritative. Script-free snapshot documents use matching neutral reading surfaces and a system font fallback.

Desktop navigation floats 16px from the top, left, and bottom of the frame, at 220px wide. The main area starts at navigation width plus 32px, with a 16px right margin. At widths up to 1100px the implemented navigation width becomes 224px; at 850px it becomes the existing off-canvas drawer, sized `min(300px, 85vw)`. Desktop content is capped at 1600px. A transparent breadcrumb row precedes the title/action row and the work surface.

Use the four-pixel spacing rhythm in the frontmatter, with existing local 10px, 14px, 18px, and 28px optical adjustments where needed. Panels use 24px padding, compact board cards 14px, page-heading separation 28px, and common toolbar gaps 12–20px. The board columns themselves are open canvas. Three-column boards have 20px gaps; four-column boards have 16px gaps. Cards within each column are separated by 10px.

At 1100px, boards become horizontally scrollable columns and general summary strips become two columns. Record overviews stack. At 900px title/actions and authentication columns stack. At 850px the drawer replaces floating navigation and content uses 20px side padding. At 650px phone content uses 16px gutters, panels use 20px by 16px padding, journey cards retain 14px padding and task items use 12px, and board columns use `min(86vw, 340px)`. Tables retain their horizontal scroller; the finance table retains a 760px minimum width below 600px.

Phone Home filters use two columns with the existing select spanning the row. At 380px and below, Home filters stack to one column to give native date inputs enough room; finance date labels also span the row. Notes lists stack above the editor at 650px. Record summary facts become separated rows. Cash metrics become a one-column list with figures aligned beside their labels. Preserve safe-area padding and coarse-pointer field text at 16px; coarse-pointer icon controls and board status selects have 44px targets.

Help is a separate reading layout capped at 1200px, with 32px side padding, a 210px table-of-contents column and 64px gap. At 900px this becomes 170px plus a 32px gap; at 640px it stacks with 20px side padding. Help journey rows stack their own internal columns at 650px.

**The Grouped Facts Rule.** Keep each record's facts visually together, with labels close to values and existing controls clearly separated from descriptive content.

## Elevation & Depth

Surfaces are predominantly flat. White fills, fine outlines, inset control backgrounds, and dividers establish grouping. Board cards carry a very faint resting shadow, and hover provides a small lift in contrast. Drawers, popovers, dialogs, and the authentication frame use shadows appropriate to their separate layers.

### Shadow Vocabulary

- **Control hover** (`0 2px 4px #18232e05`): the shared small hover shadow.
- **Card hover** (`0 6px 16px #18232e0a`): the shared raised surface shadow.
- **Card rest** (`0 2px 3px #18232e03`): near-flat board cards.
- **Navigation rest** (`0 3px 12px #18232e03`): the floating desktop panel.
- **Drawer** (`12px 0 40px #18232e14`): mobile navigation above its scrim.
- **Dialog** (`0 24px 80px #18232e26`): existing modal layer.
- **Authentication frame** (`0 12px 48px #18232e06`): the framed desktop entry screen.

Motion is quiet and state-driven: 140ms control transitions, 180ms surface/dialog transitions, and `cubic-bezier(0.2, 0.8, 0.2, 1)` for eased movement. Press feedback moves enabled buttons down 1px. Surface entry uses opacity and 6px translation; dialog entry uses opacity and scale from 0.98. Reduced-motion preference removes animation and transitions. Drag transforms remain owned by the drag system.

## Shapes

Small working controls use softly curved corners; larger work surfaces have a little more radius. Use the frontmatter shape roles: tags, compact controls, inputs/buttons, cards/tables, panels/metric strips, floating navigation/dialogs, and the authentication frame. Shared strips have a single outer outline and internal dividers. Preserve round avatars and tiny status dots where the existing components use them.

## Components

### Buttons

Quiet, clearly actionable controls. Primary buttons use Charcoal Action with white text; outline buttons use White Paper and Control Stroke. The common control is at least 42px high with 10px by 16px padding, 14px text, weight 550, and an 8px radius. Heading actions use 13px text. Small buttons are 36px high. Hover darkens primary buttons to `#3b4249`; outline hover uses `#f5f6f7`. Disabled controls reduce opacity to 0.5. Keep visible sage keyboard-focus outlines.

### Chips

Compact semantic context with sentence-case text. Tags use 12px text, 3px by 7px padding, weight 500, and the tag radius. Neutral tags use muted text on `#f0f2f4`; Lead uses `#3e618e` on `#eef3fb`; Trip uses `#36694e` on `#eaf4ee`. Tags describe existing types or states and retain readable labels.

### Cards / Containers

Journey cards in Sales and Trips retain compact 14px padding, 10px corners, a 14px title and grouped date/guest facts. Their description uses a one-line 12px preview, while full content remains in the existing view.

Home Tasks Overview remains a three-column Kanban. Task items use 12px padding, 8px corners, a 13px title and one-line 12px note. Show only the task, note, due date, source and status; do not add avatars, decorative tags or a separate information block. The footer keeps due/source on the left and the existing status and pencil Edit on the right. Status controls are 104px wide on desktop and 124px wide with 44px height for coarse pointers. Preserve whole-item open, drag, source navigation, permission checks and status/Edit handlers.

Panels provide a shared outlined white surface. Tables use a single rounded white wrapper, horizontal scrolling, 12px headers, 13px cells, and light row dividers. General cell padding is 20px; headers use 14px by 20px. Record details use a separate title/action surface, underline tabs, and a grouped summary with fact dividers.

### Inputs / Fields

White controls with the stronger Control Stroke, 8px corners, 10px by 12px padding, and a 44px minimum height. Inputs stretch within their available track; selects preserve their native affordance. Search combines its icon and field inside one outlined container with a shared focus ring. Rich editor focus uses a sage border and a 2px Soft Sage ring. Authentication fields are at least 48px high and use 16px text. Existing validation, disabled states, labels, and form behavior remain intact.

### Navigation

Labelled icon-and-text rows use 13px text, 12px icon gaps, and 8px corners. Active rows use a quiet neutral fill (`#f0f2f5`), darker ink, weight 600, and an inset outline; hover uses `#e9ecef`. Workspace and account areas are separated by fine lines. The same destinations and account controls remain in the 850px drawer.

### Metric Strips

Related values share one white outlined surface instead of separate decorative cards. Desktop summary strips have four tracks; cash strips have three. Use internal separators and tabular figures, with label and supporting copy grouped together. The phone layout follows Layout above; preserve the existing metric calculations and labels.

### Notes and Documents

Notes live on the parent panel's writing surface. A 200px note list has a right divider; the note title, toolbar, and rich text form the adjacent editor without nested rounded boxes. The title row and toolbar use thin separators. At phone widths the list moves above the editor and the divider becomes horizontal. Document title links use their existing file icon treatment and ordinary table hierarchy.

### Authentication and Help

Authentication uses a framed split surface with a pale sage identity/story area and a white form area. The frame is capped at 1120px; the form content is capped at 380px. Phone authentication becomes a full-height, borderless stacked surface. Help uses readable article typography, restrained outlined cards, and divider-led journey rows. These visual arrangements preserve the existing sign-in, invitation, reset, access, and help navigation behavior.

## Do's and Don'ts

### Do:

- **Do** preserve existing actions, routes, form behavior, permissions, and data meanings while styling new surfaces.
- **Do** group related facts and metrics within shared outlined surfaces.
- **Do** keep semantic color paired with readable text labels.
- **Do** retain visible keyboard focus, reduced-motion behavior, and responsive overflow affordances.
- **Do** preserve the existing Egimu Travel brand image and travelOS identity.

### Don't:

- **Don't** introduce extra workflow steps, KPIs, or product controls as decoration; use existing content and actions.
- **Don't** replace the implemented composition with uniformly boxed columns; keep board columns open and group the records themselves.
- **Don't** compress native date fields below their usable track; keep the narrow-screen stacking rules.

No new visual exception is canonized. Physical phone interaction and software-keyboard behavior remain unverified.
