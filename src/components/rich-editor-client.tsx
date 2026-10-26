"use client";
import { useEffect, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  CodeSquare,
  Link,
  Unlink,
  Undo2,
  Redo2,
  Quote,
  Table2,
} from "lucide-react";
import { editorExtensions, safeEditorLink } from "@/lib/editor-extensions";
import type { RichEditorProps } from "./rich-editor";

export default function RichEditorClient({
  value,
  onChange,
  label,
  disabled = false,
}: RichEditorProps) {
  const [linkOpen, setLinkOpen] = useState(false),
    [href, setHref] = useState(""),
    [error, setError] = useState("");
  const editor = useEditor({
    extensions: editorExtensions(),
    content: value,
    contentType: "markdown",
    immediatelyRender: false,
    editable: !disabled,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": label,
        class: "rich-editor-content",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getMarkdown()),
  });
  useEffect(() => {
    if (editor && value !== editor.getMarkdown())
      editor.commands.setContent(value, {
        contentType: "markdown",
        emitUpdate: false,
      });
  }, [value, editor]);
  useEffect(() => {
    editor?.setEditable(!disabled, false);
  }, [disabled, editor]);
  useEditorState({
    editor,
    selector: ({ transactionNumber }) => transactionNumber,
  });
  if (!editor) return <p role="status">Menyiapkan editor…</p>;
  const tools = [
    {
      label: "Bold",
      icon: Bold,
      active: editor.isActive("bold"),
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: "Italic",
      icon: Italic,
      active: editor.isActive("italic"),
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: "Strikethrough",
      icon: Strikethrough,
      active: editor.isActive("strike"),
      run: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      label: "Inline code",
      icon: Code,
      active: editor.isActive("code"),
      run: () => editor.chain().focus().toggleCode().run(),
    },
    {
      label: "Bullet list",
      icon: List,
      active: editor.isActive("bulletList"),
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: "Numbered list",
      icon: ListOrdered,
      active: editor.isActive("orderedList"),
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      label: "Quote",
      icon: Quote,
      active: editor.isActive("blockquote"),
      run: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      label: "Code block",
      icon: CodeSquare,
      active: editor.isActive("codeBlock"),
      run: () => editor.chain().focus().toggleCodeBlock().run(),
    },
  ];
  return (
    <div className="rich-editor">
      <div
        className="rich-editor-toolbar"
        role="group"
        aria-label={`${label} formatting`}
      >
        <select
          aria-label={`${label} text hierarchy`}
          disabled={disabled}
          value={
            editor.isActive("heading")
              ? String(editor.getAttributes("heading").level)
              : "paragraph"
          }
          onChange={(e) => {
            if (e.target.value === "paragraph")
              editor.chain().focus().setParagraph().run();
            else
              editor
                .chain()
                .focus()
                .toggleHeading({
                  level: Number(e.target.value) as 1 | 2 | 3 | 4 | 5 | 6,
                })
                .run();
          }}
        >
          <option value="paragraph">Paragraph</option>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>
              Heading {n}
            </option>
          ))}
        </select>
        {tools.map((t) => (
          <button
            key={t.label}
            type="button"
            title={t.label}
            aria-label={t.label}
            aria-pressed={t.active}
            disabled={disabled}
            onClick={t.run}
          >
            <t.icon size={16} />
          </button>
        ))}
        <button
          type="button"
          title="Buat tabel (3 kolom)"
          aria-label="Buat tabel (3 kolom)"
          disabled={
            disabled ||
            !editor.can().insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          }
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
        >
          <Table2 size={16} />
        </button>
        <button
          type="button"
          aria-label="Insert or edit link"
          title="Link"
          aria-pressed={editor.isActive("link")}
          disabled={disabled}
          onClick={() => {
            setHref(editor.getAttributes("link").href || "");
            setError("");
            setLinkOpen(!linkOpen);
          }}
        >
          <Link size={16} />
        </button>
        <button
          type="button"
          aria-label="Remove link"
          title="Remove link"
          disabled={disabled || !editor.isActive("link")}
          onClick={() =>
            editor.chain().focus().extendMarkRange("link").unsetLink().run()
          }
        >
          <Unlink size={16} />
        </button>
        <button
          type="button"
          aria-label="Undo"
          title="Undo"
          disabled={disabled || !editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 size={16} />
        </button>
        <button
          type="button"
          aria-label="Redo"
          title="Redo"
          disabled={disabled || !editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 size={16} />
        </button>
      </div>
      {linkOpen && (
        <div className="rich-editor-link">
          <label>
            Link URL
            <input
              type="url"
              value={href}
              placeholder="https://…"
              onChange={(e) => setHref(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
            />
          </label>
          <button
            type="button"
            className="button button-outline"
            disabled={disabled}
            onClick={() => {
              if (!safeEditorLink(href)) {
                setError("Gunakan https://, http://, mailto: atau tel:.");
                return;
              }
              editor
                .chain()
                .focus()
                .extendMarkRange("link")
                .setLink({ href: href.trim() })
                .run();
              setLinkOpen(false);
            }}
          >
            Terapkan
          </button>
          <button
            type="button"
            className="button ghost"
            onClick={() => setLinkOpen(false)}
          >
            Batal
          </button>
          {error && <p role="alert">{error}</p>}
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
