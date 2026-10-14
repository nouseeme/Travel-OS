import test from "node:test";
import assert from "node:assert/strict";
import { Editor } from "@tiptap/core";
import { editorExtensions, safeEditorLink } from "../src/lib/editor-extensions";
import { dateInZone, localTimestamp, validTimezone } from "../src/lib/time";
import { parseFilters } from "../src/lib/filters";

test("Markdown survives WYSIWYG round trips for requested formatting and existing tables/checklists", () => {
  const markdown = '# Heading\n\n## Section\n\n### Subsection\n\n**Bold** *italic* ~~strike~~ `code` [link](https://example.com)\n\n- Bullet\n  - Nested\n\n1. First\n2. Second\n\n> Quote\n\n```js\nconst value = 1;\n```\n\n| Name | Value |\n| --- | --- |\n| Trip | 2 |\n\n- [x] Complete\n- [ ] Pending';
  const first = new Editor({extensions:editorExtensions(),content:markdown,contentType:"markdown"});
  const serialized = first.getMarkdown();
  const second = new Editor({extensions:editorExtensions(),content:serialized,contentType:"markdown"});
  assert.deepEqual(second.getJSON(),first.getJSON());
  assert.match(serialized,/```js/);
  assert.match(serialized,/https:\/\/example.com/);
  assert.match(serialized,/\[x\]/);
  first.destroy();second.destroy();
});
test("editor links accept explicit safe schemes and reject executable URLs",()=>{
  for(const href of ['https://example.com','mailto:work@example.com','tel:+123'])assert.ok(safeEditorLink(href));
  for(const href of ['javascript:alert(1)','data:text/html,evil','vbscript:evil'])assert.equal(safeEditorLink(href),false);
});
test("local calendar date handles midnight and daylight-saving changes",()=>{
  const instant = new Date('2026-10-14T00:30:00Z');
  assert.equal(dateInZone(instant,'America/Los_Angeles'),'2026-10-13');
  assert.equal(dateInZone(instant,'Europe/Istanbul'),'2026-10-14');
  assert.match(localTimestamp(instant.toISOString(),'Europe/Istanbul'),/03[.:]30/);
  assert.match(localTimestamp('2026-03-08T06:30:00Z','America/New_York'),/01[.:]30/);
  assert.match(localTimestamp('2026-03-08T07:30:00Z','America/New_York'),/03[.:]30/);
  assert.equal(parseFilters({from:'2026-10-14',timezone:'America/Los_Angeles'}).from,'2026-10-14');
  assert.throws(()=>validTimezone('Invalid/Timezone'));
  assert.throws(()=>parseFilters({timezone:'Invalid/Timezone'}));
});
