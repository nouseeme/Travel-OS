"use client";
import dynamic from "next/dynamic";
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
  return <Editor {...props} />;
}
