import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { TableKit } from "@tiptap/extension-table";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { TypedTables } from "./editor-table-input";

export const safeEditorLink = (href: string) =>
  /^(https?:\/\/|mailto:|tel:)/i.test(href.trim());
export function editorExtensions() {
  return [
    StarterKit.configure({
      underline: false,
      link: {
        openOnClick: false,
        autolink: false,
        isAllowedUri: safeEditorLink,
      },
    }),
    Markdown,
    TableKit,
    TypedTables,
    TaskList,
    TaskItem.configure({ nested: true }),
  ];
}
