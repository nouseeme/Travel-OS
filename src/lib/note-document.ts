/** Storage and rendering types, kept independent of the editor's browser bundle. */
export type NoteText = {
  type: "text";
  text: string;
  styles?: Record<string, boolean | string>;
};
export type NoteInline =
  NoteText | { type: "link"; href: string; content: NoteText[] };
export type NoteCell = {
  type: "tableCell";
  props?: Record<string, unknown>;
  content: NoteInline[];
};
export type NoteTable = {
  type: "tableContent";
  columnWidths?: (number | null | undefined)[];
  headerRows?: number;
  headerCols?: number;
  rows: { cells: (NoteCell | NoteInline[])[] }[];
};
export type NoteBlock = {
  id?: string;
  type: string;
  props?: Record<string, unknown>;
  content?: NoteInline[] | NoteTable | string;
  children?: NoteBlock[];
};
export type NoteDocument = {
  format: "blocknote";
  version: 1;
  blocks: NoteBlock[];
};
const blockTypes = new Set([
  "paragraph",
  "heading",
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "quote",
  "codeBlock",
  "table",
  "divider",
]);
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

function validInline(value: unknown): value is NoteInline[] {
  return (
    Array.isArray(value) &&
    value.every(
      (v) =>
        record(v) &&
        (v.type === "text"
          ? typeof v.text === "string" &&
            (v.styles === undefined ||
              (record(v.styles) &&
                Object.values(v.styles).every(
                  (s) => typeof s === "string" || typeof s === "boolean",
                )))
          : v.type === "link" &&
            typeof v.href === "string" &&
            Array.isArray(v.content) &&
            v.content.every(
              (s) => record(s) && s.type === "text" && validInline([s]),
            )),
    )
  );
}
function validBlocks(value: unknown, depth = 0): value is NoteBlock[] {
  return (
    depth <= 20 &&
    Array.isArray(value) &&
    value.every((block) => {
      if (
        !record(block) ||
        !blockTypes.has(String(block.type)) ||
        (block.props !== undefined && !record(block.props))
      )
        return false;
      if (
        block.children !== undefined &&
        !validBlocks(block.children, depth + 1)
      )
        return false;
      if (block.type === "divider") return block.content === undefined;
      if (block.type !== "table")
        return (
          block.content === undefined ||
          typeof block.content === "string" ||
          validInline(block.content)
        );
      const table = block.content;
      return (
        record(table) &&
        table.type === "tableContent" &&
        (table.columnWidths === undefined ||
          (Array.isArray(table.columnWidths) &&
            table.columnWidths.every(
              (w) =>
                w === null ||
                (typeof w === "number" &&
                  Number.isFinite(w) &&
                  w >= 0 &&
                  w < 10000),
            ))) &&
        [table.headerRows, table.headerCols].every(
          (v) =>
            v === undefined ||
            (typeof v === "number" &&
              Number.isInteger(v) &&
              v >= 0 &&
              v <= 1000),
        ) &&
        Array.isArray(table.rows) &&
        table.rows.length > 0 &&
        table.rows.every(
          (row) =>
            record(row) &&
            Array.isArray(row.cells) &&
            row.cells.every(
              (cell) =>
                validInline(cell) ||
                (record(cell) &&
                  cell.type === "tableCell" &&
                  (cell.props === undefined ||
                    (record(cell.props) &&
                      [cell.props.colspan, cell.props.rowspan].every(
                        (n) =>
                          n === undefined ||
                          (typeof n === "number" &&
                            Number.isInteger(n) &&
                            n >= 1 &&
                            n <= 1000),
                      ))) &&
                  validInline(cell.content)),
            ),
        )
      );
    })
  );
}
export function readNoteDocument(body: string): NoteDocument | null {
  if (!body.trimStart().startsWith("{")) return null;
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    return null;
  }
  if (!record(value) || value.format !== "blocknote") return null;
  if (value.version !== 1 || !validBlocks(value.blocks))
    throw new Error("Format dokumen notes tidak valid.");
  return { format: "blocknote", version: 1, blocks: value.blocks };
}
export function writeNoteDocument(blocks: NoteBlock[]) {
  const body = JSON.stringify({ format: "blocknote", version: 1, blocks });
  readNoteDocument(body);
  return body;
}
export const safeNoteLink = (href: string) =>
  /^(https?:\/\/|mailto:|tel:)/i.test(href.trim());
const escape = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
function inlineHtml(content: NoteInline[] | string | undefined): string {
  if (typeof content === "string")
    return escape(content).replace(/\n/g, "<br>");
  return (content || [])
    .map((node) => {
      if (node.type === "link") {
        const text = inlineHtml(node.content);
        return safeNoteLink(node.href)
          ? `<a href="${escape(node.href)}" target="_blank" rel="noopener noreferrer">${text}</a>`
          : text;
      }
      let text = escape(node.text).replace(/\n/g, "<br>");
      for (const [style, tag] of [
        ["code", "code"],
        ["bold", "strong"],
        ["italic", "em"],
        ["strike", "s"],
        ["underline", "u"],
      ])
        if (node.styles?.[style]) text = `<${tag}>${text}</${tag}>`;
      return text;
    })
    .join("");
}
const positive = (v: unknown, fallback = 1) =>
  typeof v === "number" && Number.isInteger(v) && v > 0 && v <= 1000
    ? v
    : fallback;
function tableHtml(table: NoteTable) {
  const widths = table.columnWidths || [];
  const cols = widths
    .map(
      (w) =>
        `<col${typeof w === "number" && Number.isFinite(w) && w > 0 && w < 10000 ? ` style="width:${w}px"` : ""}>`,
    )
    .join("");
  return `<div class="note-table-scroll"><table>${cols ? `<colgroup>${cols}</colgroup>` : ""}<tbody>${table.rows
    .map((row, r) => {
      let column = 0;
      return `<tr>${row.cells
        .map((cell) => {
          const props = Array.isArray(cell) ? {} : cell.props || {};
          const tag =
            r < (table.headerRows || 0) || column < (table.headerCols || 0)
              ? "th"
              : "td";
          const colSpan = positive(props.colspan),
            rowSpan = positive(props.rowspan);
          column += colSpan;
          const align = ["left", "center", "right", "justify"].includes(
            String(props.textAlignment),
          )
            ? String(props.textAlignment)
            : "left";
          return `<${tag} colspan="${colSpan}" rowspan="${rowSpan}" style="text-align:${align}">${inlineHtml(Array.isArray(cell) ? cell : cell.content)}</${tag}>`;
        })
        .join("")}</tr>`;
    })
    .join("")}</tbody></table></div>`;
}
export function noteDocumentHtml(doc: NoteDocument): string {
  function render(blocks: NoteBlock[]): string {
    let output = "",
      list = "";
    for (const block of blocks) {
      const kind =
        block.type === "numberedListItem"
          ? "ol"
          : ["bulletListItem", "checkListItem"].includes(block.type)
            ? "ul"
            : "";
      if (kind !== list) {
        if (list) output += `</${list}>`;
        if (kind)
          output += `<${kind}${kind === "ol" ? ` start="${positive(block.props?.start)}"` : ""}>`;
        list = kind;
      }
      const content = block.content;
      const text = inlineHtml(
        Array.isArray(content) || typeof content === "string"
          ? content
          : undefined,
      );
      const children = render(block.children || []);
      if (kind)
        output += `<li${block.type === "checkListItem" ? ' class="note-check-item"' : ""}>${block.type === "checkListItem" ? `<input type="checkbox" disabled${block.props?.checked === true ? " checked" : ""}> ` : ""}${text}${children}</li>`;
      else if (
        block.type === "table" &&
        content &&
        typeof content === "object" &&
        !Array.isArray(content)
      )
        output += tableHtml(content) + children;
      else if (block.type === "codeBlock") {
        const raw =
          typeof content === "string"
            ? content
            : Array.isArray(content)
              ? content
                  .map((n) =>
                    n.type === "text"
                      ? n.text
                      : n.content.map((s) => s.text).join(""),
                  )
                  .join("")
              : "";
        output += `<pre><code>${escape(raw)}</code></pre>` + children;
      } else if (block.type === "divider") output += "<hr>";
      else {
        const tag =
          block.type === "heading"
            ? `h${Math.min(6, positive(block.props?.level))}`
            : block.type === "quote"
              ? "blockquote"
              : "p";
        output += `<${tag}>${text || "<br>"}</${tag}>` + children;
      }
    }
    return output + (list ? `</${list}>` : "");
  }
  return render(doc.blocks);
}
