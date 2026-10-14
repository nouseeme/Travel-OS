# Requirements before P2

Owner direction, 14 October 2026. These requirements supersede the original PRD's textarea/preview editor allowance and its fixed workspace timezone for user-facing time displays. The owner subsequently selected Tiptap. The editor and timezone changes are implemented; validation status is recorded in RELEASE.md.

## Markdown editing

Use one WYSIWYG editing surface instead of switching between source and preview. Preserve Markdown as the stored format, explicit Save, unsaved-change protection, and read-only rendering for users without edit privilege. Apply consistently to named Lead/Trip documents, Markdown templates and Markdown itinerary descriptions. Plain-text task descriptions need not become rich text.

Selected library: **Tiptap 3.32.0**, with its official Markdown extension and a simple custom toolbar. Headings 1–6, bold, italic, strikethrough, inline code, bullet/numbered lists, quote, code block, link/remove-link and undo/redo are available. Existing tables and checklists have compatibility extensions. Images/attachments remain out of scope; unsupported existing Markdown is protected as read-only content rather than silently discarded.

The editor is loaded only on the client. Markdown remains the stored format. Explicit save, unsaved-change protection and permission-restricted read-only rendering remain. Template replacements update the editor without creating a false dirty event. The original green/sage palette and Plus Jakarta Sans are retained.
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

Implemented: event columns remain `timestamptz` and serialize in UTC. Initial dates, greetings, audit/expiry display, server-produced `today`, analytics day boundaries and transaction future-date validation use a validated browser timezone. Requests without a timezone default to UTC. Existing stored calendar-only dates are unchanged. UI local-day state refreshes on window focus and checks for midnight/timezone changes once per minute.

Required verification: UTC storage round trips; different browser timezones; local/UTC midnight boundaries; daylight-saving transitions; unchanged calendar-only dates; audit/expiry display; matching UI and server date filters/validation.
