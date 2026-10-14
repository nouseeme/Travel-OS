# Requirements before P2

Owner direction, 14 October 2026. These requirements supersede the original PRD's textarea/preview editor allowance and its fixed workspace timezone for user-facing time displays. This document records requirements and research; the editor and timezone changes are not implemented yet.

## Markdown editing

Use one WYSIWYG editing surface instead of switching between source and preview. Preserve Markdown as the stored format, explicit Save, unsaved-change protection, and read-only rendering for users without edit privilege. Apply consistently to named Lead/Trip documents, Markdown templates and Markdown itinerary descriptions. Plain-text task descriptions need not become rich text.

Recommended library: **MDXEditor** (`@mdxeditor/editor`), an MIT-licensed React editor that accepts/emits Markdown strings. Its Markdown-first interface fits the existing schema. Enable headings, emphasis, lists, quotes, links, tables and necessary code constructs, with a compact responsive toolbar styled in the existing green/sage palette and Plus Jakarta Sans. Images/attachments remain out of scope. Do not enable executable JSX/MDX content.

Load the editor on the client only, including plugin initialization, as required by its Next.js integration guide. Check existing Markdown round trips, template Append/Replace synchronization, permission behavior and save/error/conflict handling before release. Unsupported existing content must not be silently lost when a document is saved.

Alternative researched: **Tiptap**, which supports bidirectional Markdown conversion but currently labels its official Markdown extension beta. Prefer MDXEditor for this Markdown-focused requirement; revisit Tiptap if a broader document model becomes necessary.

Sources checked 14 October 2026:
- https://mdxeditor.dev/editor/docs/overview
- https://mdxeditor.dev/editor/docs/getting-started
- https://github.com/mdx-editor/editor
- https://tiptap.dev/docs/editor/markdown

## Time contract

- An instant is stored as UTC using `timestamptz`; API timestamp strings must include `Z` or an explicit offset. Never store a local wall-clock time without its timezone/offset.
- Display instants using the user's device/browser timezone, including audit events, invitation/share expiry, creation/update times and any later scheduled-time controls. Display the active timezone where ambiguity matters.
- Convert user-entered local date/time into an instant before sending it to the API. Handle daylight-saving gaps/ambiguities if scheduled date/time input is added.
- Calendar-only dates remain `YYYY-MM-DD` / SQL `date`: trip start/end, transaction business dates, and date-only due dates. They must not shift to the preceding/following day when a user changes timezone.
- UI today, greetings, default periods and relative deadline labels use the user's local date. Timestamp-range filters convert local boundaries into UTC and use a half-open interval (start inclusive, next-day end exclusive).
- Keep server-authoritative expiry and authorization comparisons based on actual instants. Client timezone must never extend expiry or bypass validation.

Current implementation check: event columns already use `timestamptz`, but initial dates, greetings, audit display and server-produced `today`/analytics currently use the workspace's `Asia/Jakarta` timezone. Those paths require coordinated changes. Decide and document the local-day validation contract for transaction dates so a browser's local day does not conflict with the existing server future-date rule.

Required verification: UTC storage round trips; different browser timezones; local/UTC midnight boundaries; daylight-saving transitions; unchanged calendar-only dates; audit/expiry display; matching UI and server date filters/validation.
