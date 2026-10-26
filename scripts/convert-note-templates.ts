import { createClient } from "@supabase/supabase-js";
import { ServerBlockNoteEditor } from "@blocknote/server-util";
import { mkdir, writeFile } from "node:fs/promises";
import { noteSchema } from "../src/lib/note-schema";
import {
  readNoteDocument,
  writeNoteDocument,
  type NoteBlock,
} from "../src/lib/note-document";

const apply = process.argv.includes("--apply");
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY)
  throw new Error("Configure the project URL and server secret in .env.local.");
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } },
);
const result = await db
  .from("templates")
  .select("id,workspace_id,name,kind,content,active,version")
  .in("kind", ["lead_note", "trip_note", "internal_doc"]);
if (result.error) throw result.error;
const editor = ServerBlockNoteEditor.create({
  schema: noteSchema,
  tables: { splitCells: true, headers: true },
});
const changes = [];
for (const template of result.data) {
  if (typeof template.content !== "string")
    throw new Error(`Unexpected content in template ${template.id}`);
  if (readNoteDocument(template.content)) continue;
  const blocks = await editor.tryParseMarkdownToBlocks(template.content);
  const content = writeNoteDocument(blocks as NoteBlock[]);
  if (content.length > 50000)
    throw new Error(
      `Converted template exceeds the storage limit: ${template.id}`,
    );
  changes.push({ before: template, content });
}
await mkdir(".local", { recursive: true });
const file = `.local/blocknote-template-conversion-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
await writeFile(file, JSON.stringify(changes, null, 2));
if (apply) {
  // Applying before the new app is deployed would expose JSON to the old renderer.
  if (!process.argv.includes("--new-renderer-deployed"))
    throw new Error(
      "Deploy the BlockNote renderer first, then rerun with --apply --new-renderer-deployed.",
    );
  for (const { before, content } of changes) {
    const updated = await db
      .from("templates")
      .update({ content, version: before.version + 1 })
      .eq("id", before.id)
      .eq("workspace_id", before.workspace_id)
      .eq("version", before.version)
      .select("id");
    if (updated.error) throw updated.error;
    if (updated.data.length !== 1)
      throw new Error(
        `Template changed during conversion: ${before.id}. The backup contains the original content.`,
      );
  }
}
console.log(
  JSON.stringify({
    mode: apply ? "applied" : "preview",
    converted: changes.length,
    alreadyConverted: result.data.length - changes.length,
    backup: file,
  }),
);
editor.editor._tiptapEditor.destroy();
