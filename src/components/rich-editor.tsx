"use client";
import dynamic from "next/dynamic";
export type RichEditorProps = {value: string; onChange: (value: string) => void; label: string; disabled?: boolean};
export const RichEditor = dynamic<RichEditorProps>(() => import("./rich-editor-client"), {
  ssr: false, loading: () => <p role="status">Menyiapkan editor…</p>,
});
