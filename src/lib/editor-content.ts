import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { tableCellBreaks } from "./table-cell-breaks";
import type { Root } from "mdast";
const supported = new Set([
  "root",
  "paragraph",
  "heading",
  "text",
  "emphasis",
  "strong",
  "delete",
  "inlineCode",
  "code",
  "link",
  "linkReference",
  "definition",
  "list",
  "listItem",
  "blockquote",
  "thematicBreak",
  "break",
  "table",
  "tableRow",
  "tableCell",
]);
/** Protect stored Markdown that the configured editor cannot round-trip. */
export function unsupportedMarkdown(value: string) {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(tableCellBreaks);
  const tree = processor.runSync(processor.parse(value));
  function visit(node: { type: string; children?: Root["children"] }): boolean {
    return (
      !supported.has(node.type) ||
      !!node.children?.some((child) => visit(child))
    );
  }
  return visit(tree);
}
