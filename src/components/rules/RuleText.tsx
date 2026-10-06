"use client";

import { Fragment, useMemo, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { parseRuleMarkdown, type Inline, type Lines } from "@/lib/rules-markdown";

interface RuleTextProps {
  content: string;
  /** Link colour (theme.linkColor / primaryColor); inherits text colour when omitted */
  linkColor?: string;
  className?: string;
}

/**
 * Renders rulebook Markdown (see rules-markdown.ts) as React elements — used on the public
 * rules page and in the admin editor preview.
 */
export function RuleText({ content, linkColor, className }: RuleTextProps) {
  const blocks = useMemo(() => parseRuleMarkdown(content), [content]);

  const renderInlines = (inlines: Inline[]): ReactNode[] => inlines.map((node, i) => {
    switch (node.type) {
      case "text":
        return <Fragment key={i}>{node.text}</Fragment>;
      case "bold":
        return <strong key={i} className="font-semibold">{renderInlines(node.children)}</strong>;
      case "italic":
        return <em key={i}>{renderInlines(node.children)}</em>;
      case "strike":
        return <s key={i} className="opacity-70">{renderInlines(node.children)}</s>;
      case "link": {
        const external = /^(https?:|mailto:)/i.test(node.href);
        return (
          <a
            key={i}
            href={node.href}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="underline underline-offset-2 decoration-1 hover:opacity-80 transition-opacity break-words"
            style={linkColor ? { color: linkColor } : undefined}
          >
            {renderInlines(node.children)}
          </a>
        );
      }
      case "image":
        // Plain <img>, not next/image: admin-provided URL on an arbitrary host
        return <img key={i} src={node.src} alt={node.alt} loading="lazy" className="block max-w-full max-h-96 rounded-lg my-2" />;
    }
  });

  const renderLines = (lines: Lines) => lines.map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {renderInlines(line)}
    </Fragment>
  ));

  return (
    <div className={cn("space-y-2 break-words", className)}>
      {blocks.map((block, i) => {
        if (block.type === "heading") {
          const size = block.level === 1 ? "text-lg" : block.level === 2 ? "text-base" : "text-[0.95em]";
          return <p key={i} role="heading" aria-level={block.level + 2} className={cn(size, "font-semibold pt-1")}>{renderInlines(block.inlines)}</p>;
        }
        if (block.type === "list") {
          const ListTag = block.ordered ? "ol" : "ul";
          return (
            <ListTag
              key={i}
              start={block.ordered && block.start !== 1 ? block.start : undefined}
              className={cn("pl-5 space-y-1", block.ordered ? "list-decimal" : "list-disc")}
            >
              {block.items.map((item, j) => <li key={j} className="pl-1">{renderInlines(item)}</li>)}
            </ListTag>
          );
        }
        return <p key={i}>{renderLines(block.lines)}</p>;
      })}
    </div>
  );
}
