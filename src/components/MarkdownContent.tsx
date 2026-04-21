"use client";

import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";

const components: Components = {
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 underline hover:text-blue-700"
    >
      {children}
    </a>
  ),
  img: ({ src, alt }) => (
    <img
      src={src}
      alt={alt || ""}
      className="max-w-full rounded-lg my-3"
      loading="lazy"
    />
  ),
  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="list-disc pl-5 mb-3">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 mb-3">{children}</ol>
  ),
  h1: ({ children }) => (
    <h1 className="text-xl font-bold mb-2">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-bold mb-2">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-bold mb-1">{children}</h3>
  ),
  hr: () => <hr className="my-4 border-gray-200" />,
};

export default function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="text-gray-600 leading-relaxed">
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
    </div>
  );
}
