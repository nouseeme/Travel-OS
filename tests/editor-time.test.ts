import test from "node:test";
import assert from "node:assert/strict";
import { Editor } from "@tiptap/core";
import { editorExtensions, safeEditorLink } from "../src/lib/editor-extensions";
import { dateInZone, localTimestamp, validTimezone } from "../src/lib/time";
import { parseFilters } from "../src/lib/filters";
import { unsupportedMarkdown } from "../src/lib/editor-content";
import { convertTypedTable } from "../src/lib/editor-table-input";
import { publicMarkdown } from "../src/lib/public-markdown";

test("table cell line breaks render safely without accepting arbitrary HTML", () => {
  const table = "| Nama |\n| --- |\n| Satu<br>Dua<br />Tiga |";
  assert.equal(unsupportedMarkdown(table), false);
  assert.match(publicMarkdown(table), /Satu<br>\s*Dua<br>\s*Tiga/);
  for (const value of [
    "Satu<br>Dua",
    "| Nama |\n| --- |\n| <br onclick=alert(1)> |",
    "| Nama |\n| --- |\n| <script>alert(1)</script> |",
  ])
    assert.equal(unsupportedMarkdown(value), true);
});

test("Enter inside a table cell and adding a row keep the note editable", () => {
  const editor = new Editor({
    extensions: editorExtensions(),
    content: "| Nama | Harga |\n| --- | --- |\n| Trip | 20 |",
    contentType: "markdown",
  });
  editor.commands.setTextSelection(4);
  assert.equal(editor.commands.splitBlock(), true);
  const multiline = editor.getMarkdown();
  assert.equal(unsupportedMarkdown(multiline), false, multiline);
  assert.equal(editor.commands.addRowAfter(), true);
  assert.equal(unsupportedMarkdown(editor.getMarkdown()), false);
  const reopened = new Editor({
    extensions: editorExtensions(),
    content: editor.getMarkdown(),
    contentType: "markdown",
  });
  assert.equal(unsupportedMarkdown(reopened.getMarkdown()), false);
  reopened.destroy();
  editor.destroy();
});

test("typed Markdown table converts on Enter and places cursor in the empty body", () => {
  for (const sameParagraph of [false, true]) {
    const header = { type: "text", text: "| Nama | Harga |" };
    const separator = { type: "text", text: "| --- | --- |" };
    const editor = new Editor({
      extensions: editorExtensions(),
      content: {
        type: "doc",
        content: sameParagraph
          ? [
              {
                type: "paragraph",
                content: [header, { type: "hardBreak" }, separator],
              },
            ]
          : [
              { type: "paragraph", content: [header] },
              { type: "paragraph", content: [separator] },
            ],
      },
    });
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    assert.equal(editor.commands.command(convertTypedTable), true);
    const table = editor.state.doc.firstChild!;
    assert.equal(table.type.name, "table");
    assert.equal(table.childCount, 2);
    assert.equal(table.child(0).child(0).textContent, "Nama");
    assert.equal(table.child(1).childCount, 2);
    assert.equal(editor.state.selection.$from.node(-1).type.name, "tableCell");
    assert.match(editor.getMarkdown(), /Nama/);
    const reopened = new Editor({
      extensions: editorExtensions(),
      content: editor.getMarkdown(),
      contentType: "markdown",
    });
    assert.deepEqual(reopened.getJSON(), editor.getJSON());
    reopened.destroy();
    editor.destroy();
  }
});

test("ordinary pipes and incomplete separators remain plain text", () => {
  for (const value of [
    "ordinary | text",
    "| Nama | Harga |\n| -- | -- |",
    "| Nama | Harga |\n| --- |",
    "| --- | --- |",
  ]) {
    const editor = new Editor({
      extensions: editorExtensions(),
      content: {
        type: "doc",
        content: value.split("\n").map((text) => ({
          type: "paragraph",
          content: [{ type: "text", text }],
        })),
      },
    });
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    const before = editor.getJSON();
    assert.equal(editor.commands.command(convertTypedTable), false);
    assert.deepEqual(editor.getJSON(), before);
    editor.destroy();
  }
});

test("Markdown survives WYSIWYG round trips for requested formatting and existing tables/checklists", () => {
  const markdown =
    "# Heading\n\n## Section\n\n### Subsection\n\n**Bold** *italic* ~~strike~~ `code` [link](https://example.com)\n\n- Bullet\n  - Nested\n\n1. First\n2. Second\n\n> Quote\n\n```js\nconst value = 1;\n```\n\n| Name | Value |\n| --- | --- |\n| Trip | 2 |\n\n- [x] Complete\n- [ ] Pending";
  const first = new Editor({
    extensions: editorExtensions(),
    content: markdown,
    contentType: "markdown",
  });
  const serialized = first.getMarkdown();
  const second = new Editor({
    extensions: editorExtensions(),
    content: serialized,
    contentType: "markdown",
  });
  assert.deepEqual(second.getJSON(), first.getJSON());
  assert.match(serialized, /```js/);
  assert.match(serialized, /https:\/\/example.com/);
  assert.match(serialized, /\[x\]/);
  first.destroy();
  second.destroy();
});
test("editor links accept explicit safe schemes and reject executable URLs", () => {
  for (const href of [
    "https://example.com",
    "mailto:work@example.com",
    "tel:+123",
  ])
    assert.ok(safeEditorLink(href));
  for (const href of [
    "javascript:alert(1)",
    "data:text/html,evil",
    "vbscript:evil",
  ])
    assert.equal(safeEditorLink(href), false);
});
test("unsupported existing Markdown stays protected instead of being discarded", () => {
  assert.equal(
    unsupportedMarkdown("![old image](https://example.com/image.png)"),
    true,
  );
  assert.equal(unsupportedMarkdown("<section>Raw HTML</section>"), true);
  assert.equal(
    unsupportedMarkdown("```html\n<section>literal code</section>\n```"),
    false,
  );
  assert.equal(
    unsupportedMarkdown("# Title\n\n**Bold** and [link](https://example.com)"),
    false,
  );
});
test("local calendar date handles midnight and daylight-saving changes", () => {
  const instant = new Date("2026-10-14T00:30:00Z");
  assert.equal(dateInZone(instant, "America/Los_Angeles"), "2026-10-13");
  assert.equal(dateInZone(instant, "Europe/Istanbul"), "2026-10-14");
  assert.match(
    localTimestamp(instant.toISOString(), "Europe/Istanbul"),
    /03[.:]30/,
  );
  assert.match(
    localTimestamp("2026-03-08T06:30:00Z", "America/New_York"),
    /01[.:]30/,
  );
  assert.match(
    localTimestamp("2026-03-08T07:30:00Z", "America/New_York"),
    /03[.:]30/,
  );
  assert.equal(
    parseFilters({ from: "2026-10-14", timezone: "America/Los_Angeles" }).from,
    "2026-10-14",
  );
  assert.throws(() => validTimezone("Invalid/Timezone"));
  assert.throws(() => parseFilters({ timezone: "Invalid/Timezone" }));
});
