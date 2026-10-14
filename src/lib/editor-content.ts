import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
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
  const tree = unified().use(remarkParse).use(remarkGfm).parse(value);
  function visit(node: {
    type: string;
    children?: typeof tree.children;
  }): boolean {
    return (
      !supported.has(node.type) ||
      !!node.children?.some((child) => visit(child))
    );
  }
  return visit(tree);
}
