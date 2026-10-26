import { Extension, type Command } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";

/** Convert a completed Markdown header and separator when Enter is pressed. */
export const convertTypedTable: Command = ({ editor, state, dispatch }) => {
  const { $from, empty } = state.selection;
  if (
    !empty ||
    $from.parent.type.name !== "paragraph" ||
    $from.parentOffset !== $from.parent.content.size ||
    editor.isActive("table")
  )
    return false;

  let from = $from.before();
  let source = $from.parent.textBetween(
    0,
    $from.parent.content.size,
    "\n",
    "\n",
  );
  if (!source.includes("\n") && $from.index($from.depth - 1) > 0) {
    const previous = $from
      .node($from.depth - 1)
      .child($from.index($from.depth - 1) - 1);
    if (previous.type.name !== "paragraph") return false;
    source = previous.textContent + "\n" + source;
    from -= previous.nodeSize;
  }
  const lines = source.split("\n");
  if (
    lines.length !== 2 ||
    !/^\s*\|.*\|\s*$/.test(lines[0]) ||
    !/^\s*\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|\s*$/.test(lines[1])
  )
    return false;
  const parsed = editor.markdown?.parse(source);
  const table = parsed?.content?.[0];
  if (parsed?.content?.length !== 1 || table?.type !== "table") return false;
  const header = table.content?.[0];
  const columns = lines[1].trim().split("|").slice(1, -1).length;
  if (!header?.content || header.content.length !== columns) return false;
  table.content!.push({
    type: "tableRow",
    content: header.content.map(() => ({
      type: "tableCell",
      content: [{ type: "paragraph" }],
    })),
  });
  if (dispatch) {
    const node = state.schema.nodeFromJSON(table);
    const tr = state.tr.replaceWith(from, $from.after(), node);
    const bodyStart = from + 1 + node.firstChild!.nodeSize;
    tr.setSelection(TextSelection.near(tr.doc.resolve(bodyStart + 2)));
    dispatch(tr.scrollIntoView());
  }
  return true;
};

export const TypedTables = Extension.create({
  name: "typedTables",
  priority: 1100,
  addKeyboardShortcuts() {
    return { Enter: () => this.editor.commands.command(convertTypedTable) };
  },
});
