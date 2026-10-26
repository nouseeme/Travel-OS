import test from "node:test";
import assert from "node:assert/strict";
import { ServerBlockNoteEditor } from "@blocknote/server-util";
import { noteSchema } from "../src/lib/note-schema";
import {
  readNoteDocument,
  writeNoteDocument,
  noteDocumentHtml,
  type NoteBlock,
} from "../src/lib/note-document";
import { publicMarkdown } from "../src/lib/public-markdown";
import { validateContent } from "../src/lib/domain";

const aiText = `## Rencana perjalanan

**Penting**: baca [panduan](https://example.com/trip).

| Kota | Tamu |
| --- | --- |
| Istanbul | 12 |
| Ankara | 8 |

\`\`\`js
const budget = 120;

console.log("<trip>", budget);
\`\`\`

- [x] Hotel
- [ ] Bus
`;
test("AI Markdown converts to JSON, reopens without loss and renders for shared notes", async () => {
  const editor = ServerBlockNoteEditor.create({
    schema: noteSchema,
    tables: { splitCells: true, headers: true },
  });
  try {
    const blocks = await editor.tryParseMarkdownToBlocks(aiText);
    const value = writeNoteDocument(blocks as NoteBlock[]);
    const doc = readNoteDocument(value)!;
    assert.deepEqual(doc.blocks, JSON.parse(JSON.stringify(blocks)));
    assert.ok(blocks.some((b) => b.type === "table"));
    const code = blocks.find((b) => b.type === "codeBlock")!;
    assert.equal(code.type, "codeBlock");
    const html = publicMarkdown(value);
    assert.match(html, /<table>/);
    assert.match(html, /Istanbul/);
    assert.match(html, /href="https:\/\/example.com\/trip"/);
    assert.match(
      html,
      /<pre><code>const budget = 120;\n\nconsole.log\(&quot;&lt;trip&gt;&quot;, budget\);<\/code><\/pre>/,
    );
    const restored = editor._blocksToProsemirrorNode(
      doc.blocks as (typeof noteSchema.PartialBlock)[],
    );
    const reopened = editor._prosemirrorNodeToBlocks(restored);
    assert.equal(JSON.stringify(reopened), JSON.stringify(blocks));
    validateContent({
      notes: [
        {
          id: "10000000-0000-4000-8000-000000000001",
          title: "AI",
          body: value,
        },
      ],
    });
  } finally {
    editor.editor._tiptapEditor.destroy();
  }
});
test("block JSON preserves table widths, spans, headers, links and code exactly", () => {
  const blocks: NoteBlock[] = [
    {
      type: "table",
      content: {
        type: "tableContent",
        columnWidths: [160, 220],
        headerRows: 1,
        rows: [
          {
            cells: [
              {
                type: "tableCell",
                props: { colspan: 2 },
                content: [
                  { type: "text", text: "Title", styles: { bold: true } },
                ],
              },
            ],
          },
          {
            cells: [
              [{ type: "text", text: "One\nTwo" }],
              [
                {
                  type: "link",
                  href: "https://example.com",
                  content: [{ type: "text", text: "Link" }],
                },
              ],
            ],
          },
        ],
      },
    },
  ];
  const doc = readNoteDocument(writeNoteDocument(blocks))!;
  assert.deepEqual(doc.blocks, blocks);
  const html = noteDocumentHtml(doc);
  assert.match(html, /width:160px/);
  assert.match(html, /<th colspan="2"/);
  assert.match(html, /One<br>Two/);
});
test("JSON renderer escapes content and rejects executable links or unsupported blocks", () => {
  const body = writeNoteDocument([
    {
      type: "paragraph",
      content: [
        { type: "text", text: '<img src=x onerror="alert(1)">' },
        {
          type: "link",
          href: "javascript:alert(1)",
          content: [{ type: "text", text: "Bad" }],
        },
      ],
    },
  ]);
  const html = publicMarkdown(body);
  assert.doesNotMatch(html, /<img|javascript:|<script/);
  assert.match(html, /&lt;img/);
  assert.throws(() =>
    readNoteDocument('{"format":"blocknote","version":2,"blocks":[]}'),
  );
  assert.throws(() =>
    readNoteDocument(
      '{"format":"blocknote","version":1,"blocks":[{"type":"image"}]}',
    ),
  );
  assert.throws(() =>
    validateContent({
      notes: [
        {
          id: "10000000-0000-4000-8000-000000000001",
          title: "Invalid",
          body: '{"format":"blocknote","version":1,"blocks":[{"type":"image"}]}',
        },
      ],
    }),
  );
});
