"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { tableCellBreaks } from "@/lib/table-cell-breaks";
import { readNoteDocument, noteDocumentHtml } from "@/lib/note-document";
export function Markdown({ body }: { body: string }) {
  const document = readNoteDocument(body);
  if (document)
    return (
      <div
        className="markdown note-document"
        dangerouslySetInnerHTML={{ __html: noteDocumentHtml(document) }}
      />
    );
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, tableCellBreaks]}
        skipHtml
        components={{
          a: ({ href, children }) => (
            <a
              href={
                href && /^(https?:\/\/|mailto:)/i.test(href) ? href : undefined
              }
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          img: () => null,
        }}
      >
        {body || "_Belum ada catatan._"}
      </ReactMarkdown>
    </div>
  );
}
