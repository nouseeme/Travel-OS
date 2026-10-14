import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSanitize, {
    ...defaultSchema,
    tagNames: defaultSchema.tagNames?.filter((t) => t !== "img"),
    protocols: {
      ...defaultSchema.protocols,
      href: ["http", "https", "mailto"],
    },
  })
  .use(rehypeStringify);
export function publicMarkdown(body: string) {
  return String(processor.processSync(body));
}
