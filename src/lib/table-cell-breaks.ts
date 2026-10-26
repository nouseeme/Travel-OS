import type { Root } from "mdast";

type MarkdownNode = {
  type: string;
  value?: string;
  children?: MarkdownNode[];
};

/** Tiptap serializes newlines in table cells as bare <br> tags. */
export function tableCellBreaks() {
  return (tree: Root) => {
    function visit(node: MarkdownNode, inCell = false) {
      const inside = inCell || node.type === "tableCell";
      if (!node.children) return;
      node.children = node.children.map((child) => {
        if (
          inside &&
          child.type === "html" &&
          /^<br\s*\/?>$/i.test(child.value || "")
        )
          return { type: "break" };
        visit(child, inside);
        return child;
      });
    }
    visit(tree);
  };
}
