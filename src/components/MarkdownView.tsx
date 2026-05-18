import { useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Eye } from "lucide-react";
import { HtmlPreviewModal } from "./HtmlPreviewModal";

interface Props {
  text: string;
}

function textOf(node: ReactNode): string {
  if (node == null || node === false) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (typeof node === "object" && "props" in node) {
    return textOf((node as { props: { children?: ReactNode } }).props.children);
  }
  return "";
}

export function MarkdownView({ text }: Props) {
  const [preview, setPreview] = useState<string | null>(null);

  const components: Components = {
    code({ className, children, ...rest }) {
      const match = /language-(\w+)/.exec(className ?? "");
      const lang = match?.[1];
      const isBlock = (rest as { node?: { position?: unknown } }).node !== undefined && lang !== undefined;
      if (!isBlock) {
        return (
          <code className="rounded-md bg-black/[0.06] px-1.5 py-0.5 font-mono text-[12.5px] text-neutral-800">
            {children}
          </code>
        );
      }
      const raw = textOf(children);
      const isHtml = lang === "html";
      return (
        <div className="my-3 overflow-hidden rounded-2xl border border-black/[0.06] bg-neutral-950">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
              {lang}
            </span>
            {isHtml ? (
              <button
                type="button"
                onClick={() => setPreview(raw)}
                className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-white/20"
              >
                <Eye size={11} />
                Preview
              </button>
            ) : null}
          </div>
          <pre className="overflow-x-auto p-3 font-mono text-[12.5px] leading-relaxed">
            <code className={className}>{children}</code>
          </pre>
        </div>
      );
    },
    a({ href, children }) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className="text-neutral-900 underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-700"
        >
          {children}
        </a>
      );
    },
    table({ children }) {
      return (
        <div className="my-3 overflow-x-auto">
          <table className="min-w-full border-collapse text-[13.5px]">{children}</table>
        </div>
      );
    },
    th({ children }) {
      return (
        <th className="border-b border-black/[0.1] px-3 py-2 text-left font-medium text-neutral-700">
          {children}
        </th>
      );
    },
    td({ children }) {
      return (
        <td className="border-b border-black/[0.04] px-3 py-2 align-top text-neutral-800">
          {children}
        </td>
      );
    },
    ul({ children }) {
      return <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>;
    },
    ol({ children }) {
      return <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>;
    },
    h1({ children }) {
      return <h1 className="mb-2 mt-3 text-xl font-semibold tracking-tight">{children}</h1>;
    },
    h2({ children }) {
      return <h2 className="mb-2 mt-3 text-lg font-semibold tracking-tight">{children}</h2>;
    },
    h3({ children }) {
      return <h3 className="mb-1.5 mt-2.5 text-[15px] font-semibold tracking-tight">{children}</h3>;
    },
    p({ children }) {
      return <p className="my-2 leading-relaxed first:mt-0 last:mb-0">{children}</p>;
    },
    blockquote({ children }) {
      return (
        <blockquote className="my-2 border-l-2 border-black/15 pl-3 text-neutral-600">
          {children}
        </blockquote>
      );
    },
  };

  return (
    <>
      <div className="markdown-body text-[15px] leading-relaxed text-neutral-900">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={components}
        >
          {text}
        </ReactMarkdown>
      </div>
      <HtmlPreviewModal html={preview} onClose={() => setPreview(null)} />
    </>
  );
}
