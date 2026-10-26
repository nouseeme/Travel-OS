"use client";
import { useEffect, useRef } from "react";
import { BlockNoteView } from "@blocknote/ariakit";
import {
  useCreateBlockNote,
  FormattingToolbar,
  FormattingToolbarController,
  BlockTypeSelect,
  BasicTextStyleButton,
  CreateLinkButton,
  TableCellMergeButton,
  SideMenu,
  SideMenuController,
  DragHandleMenu,
  RemoveBlockItem,
  TableRowHeaderItem,
  TableColumnHeaderItem,
} from "@blocknote/react";
import { noteSchema } from "@/lib/note-schema";
import {
  readNoteDocument,
  writeNoteDocument,
  type NoteBlock,
} from "@/lib/note-document";
import type { RichEditorProps } from "./rich-editor";

function NoteFormattingToolbar() {
  return (
    <FormattingToolbar>
      <BlockTypeSelect />
      <BasicTextStyleButton basicTextStyle="bold" />
      <BasicTextStyleButton basicTextStyle="italic" />
      <BasicTextStyleButton basicTextStyle="strike" />
      <BasicTextStyleButton basicTextStyle="code" />
      <CreateLinkButton />
      <TableCellMergeButton />
    </FormattingToolbar>
  );
}
function NoteBlockMenu() {
  return (
    <DragHandleMenu>
      <RemoveBlockItem>Hapus blok</RemoveBlockItem>
      <TableRowHeaderItem>Baris judul</TableRowHeaderItem>
      <TableColumnHeaderItem>Kolom judul</TableColumnHeaderItem>
    </DragHandleMenu>
  );
}
export default function RichEditorClient({
  value,
  onChange,
  label,
  disabled = false,
}: RichEditorProps) {
  const syncing = useRef(false),
    loadedEditor = useRef<typeof noteSchema.BlockNoteEditor | null>(null),
    lastSerialized = useRef<string | null>(null),
    lastReceived = useRef<string | null>(null);
  const editor = useCreateBlockNote({
    schema: noteSchema,
    tables: {
      splitCells: true,
      headers: true,
      cellBackgroundColor: false,
      cellTextColor: false,
    },
    domAttributes: {
      editor: {
        "aria-label": label,
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    placeholders: {
      default: "Tulis catatan atau ketik / untuk menambah blok…",
    },
    pasteHandler: ({ defaultPasteHandler }) =>
      defaultPasteHandler({
        plainTextAsMarkdown: true,
        prioritizeMarkdownOverHTML: false,
      }),
  });
  useEffect(() => {
    if (
      loadedEditor.current === editor &&
      (value === lastSerialized.current || value === lastReceived.current)
    )
      return;
    const document = readNoteDocument(value);
    const blocks = document?.blocks.length
      ? (document.blocks as (typeof noteSchema.PartialBlock)[])
      : value.trim() && !document
        ? editor.tryParseMarkdownToBlocks(value)
        : [{ type: "paragraph" as const }];
    syncing.current = true;
    try {
      editor.replaceBlocks(
        editor.document,
        blocks.length ? blocks : [{ type: "paragraph" }],
      );
      lastSerialized.current = writeNoteDocument(
        editor.document as NoteBlock[],
      );
      lastReceived.current = value;
      loadedEditor.current = editor;
    } finally {
      syncing.current = false;
    }
  }, [editor, value]);
  return (
    <div className="note-block-editor">
      <BlockNoteView
        editor={editor}
        theme="light"
        editable={!disabled}
        formattingToolbar={false}
        sideMenu={false}
        onChange={() => {
          if (loadedEditor.current !== editor || syncing.current || disabled)
            return;
          const next = writeNoteDocument(editor.document as NoteBlock[]);
          if (next === lastSerialized.current) return;
          lastSerialized.current = next;
          onChange(next);
        }}
      >
        <FormattingToolbarController
          formattingToolbar={NoteFormattingToolbar}
        />
        <SideMenuController
          sideMenu={(props) => (
            <SideMenu {...props} dragHandleMenu={NoteBlockMenu} />
          )}
        />
      </BlockNoteView>
    </div>
  );
}
