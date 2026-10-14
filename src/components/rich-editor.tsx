"use client";
import dynamic from "next/dynamic";
import { unsupportedMarkdown } from "@/lib/editor-content";
import { Markdown } from "./markdown";
export type RichEditorProps = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
};
const Editor = dynamic<RichEditorProps>(() => import("./rich-editor-client"), {
  ssr: false,
  loading: () => <p role="status">Menyiapkan editor…</p>,
});
export function RichEditor(props: RichEditorProps) {
  if (unsupportedMarkdown(props.value))
    return (
      <div>
        <p role="alert" className="notice">
          Konten ini memuat format di luar editor sederhana. Konten asli
          dipertahankan dan ditampilkan hanya-baca.
        </p>
        <Markdown body={props.value} />
      </div>
    );
  return <Editor {...props} />;
}
