"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
export function Markdown({ body }: { body: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
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
