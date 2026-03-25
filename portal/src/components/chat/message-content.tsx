"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChartBlock, type ChartSpec } from "./chart-block";
import type { Components } from "react-markdown";

function tryParseChart(code: string): ChartSpec | null {
  try {
    const parsed = JSON.parse(code);
    if (
      parsed &&
      typeof parsed === "object" &&
      parsed.type &&
      parsed.xKey &&
      Array.isArray(parsed.series) &&
      Array.isArray(parsed.data)
    ) {
      return parsed as ChartSpec;
    }
  } catch {
    // Not valid chart JSON
  }
  return null;
}

const components: Components = {
  // Detect ```chart code blocks and render as interactive charts
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || "");
    const lang = match?.[1];
    const codeString = String(children).replace(/\n$/, "");

    if (lang === "chart") {
      const spec = tryParseChart(codeString);
      if (spec) {
        return <ChartBlock spec={spec} />;
      }
      // Fall through to regular code block if parse fails
    }

    // Inline code vs block code
    const isInline = !className;
    if (isInline) {
      return (
        <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
          {children}
        </code>
      );
    }

    return (
      <pre className="bg-muted/50 border rounded-lg p-3 overflow-x-auto my-2">
        <code className="text-xs font-mono" {...props}>
          {children}
        </code>
      </pre>
    );
  },
  // Styled table for health data
  table({ children }) {
    return (
      <div className="overflow-x-auto my-2">
        <table className="min-w-full text-xs border-collapse">{children}</table>
      </div>
    );
  },
  thead({ children }) {
    return <thead className="bg-muted/50">{children}</thead>;
  },
  th({ children }) {
    return (
      <th className="border border-border px-2 py-1.5 text-left font-medium text-xs">
        {children}
      </th>
    );
  },
  td({ children }) {
    return (
      <td className="border border-border px-2 py-1.5 text-xs">{children}</td>
    );
  },
  // Headings
  h1({ children }) {
    return <h1 className="text-base font-bold mt-3 mb-1">{children}</h1>;
  },
  h2({ children }) {
    return <h2 className="text-sm font-bold mt-3 mb-1">{children}</h2>;
  },
  h3({ children }) {
    return <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>;
  },
  // Lists
  ul({ children }) {
    return <ul className="list-disc list-inside space-y-0.5 my-1">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="list-decimal list-inside space-y-0.5 my-1">{children}</ol>;
  },
  li({ children }) {
    return <li className="text-sm">{children}</li>;
  },
  // Paragraph
  p({ children }) {
    return <p className="my-1">{children}</p>;
  },
  // Links
  a({ href, children }) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">
        {children}
      </a>
    );
  },
  // Blockquote
  blockquote({ children }) {
    return (
      <blockquote className="border-l-2 border-primary/40 pl-3 my-2 text-muted-foreground italic">
        {children}
      </blockquote>
    );
  },
  // Horizontal rule
  hr() {
    return <hr className="border-border my-3" />;
  },
  // Strong/em
  strong({ children }) {
    return <strong className="font-semibold">{children}</strong>;
  },
};

export function MessageContent({ content }: { content: string }) {
  return (
    <div className="prose-chat text-sm leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
