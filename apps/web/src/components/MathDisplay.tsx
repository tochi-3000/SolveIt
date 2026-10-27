'use client';

import React, { useMemo } from 'react';
import katex from 'katex';

interface MathDisplayProps {
  value: string;
  className?: string;
  displayMode?: boolean;
}

const MATH_REGEX = /(?:\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)|\$([^\$]+?)\$)/g;

interface Segment {
  type: 'text' | 'inline-math' | 'block-math';
  content: string;
}

function parseSegments(value: string): Segment[] {
  if (!value) return [];
  const segments: Segment[] = [];
  let lastIndex = 0;

  for (const match of value.matchAll(MATH_REGEX)) {
    const matchStart = match.index!;
    if (matchStart > lastIndex) {
      segments.push({ type: 'text', content: value.slice(lastIndex, matchStart) });
    }

    const blockMath = match[1] || match[2];
    const inlineMath = match[3] || match[4];

    if (blockMath) {
      segments.push({ type: 'block-math', content: blockMath });
    } else if (inlineMath) {
      segments.push({ type: 'inline-math', content: inlineMath });
    }

    lastIndex = matchStart + match[0].length;
  }

  if (lastIndex < value.length) {
    segments.push({ type: 'text', content: value.slice(lastIndex) });
  }

  return segments;
}

function renderKatexHtml(latex: string, isBlock: boolean): string {
  try {
    return katex.renderToString(latex.trim(), {
      displayMode: isBlock,
      throwOnError: false,
      strict: false,
    });
  } catch (err) {
    console.warn("KaTeX render error on:", latex, err);
    return `<span class="text-rose-400 font-mono text-sm">${latex}</span>`;
  }
}

export const MathDisplay: React.FC<MathDisplayProps> = ({ value, className = "", displayMode = false }) => {
  const renderedElements = useMemo(() => {
    if (!value) return null;

    // Check if entire string is pure LaTeX without delimiters
    const hasDelimiters = /(?:\$\$|\\\[|\\\(|\$)/.test(value);
    if (!hasDelimiters) {
      // If displayMode is forced or string contains obvious LaTeX syntax (\frac, \sqrt, ^, _)
      if (displayMode || /\\(frac|sqrt|pm|times|cdot|\^|_)/.test(value)) {
        return (
          <span
            dangerouslySetInnerHTML={{ __html: renderKatexHtml(value, displayMode) }}
            className="inline-block"
          />
        );
      }
      return <span>{value}</span>;
    }

    const segments = parseSegments(value);

    return segments.map((seg, idx) => {
      if (seg.type === 'text') {
        return <span key={idx}>{seg.content}</span>;
      }

      const html = renderKatexHtml(seg.content, seg.type === 'block-math');
      return (
        <span
          key={idx}
          dangerouslySetInnerHTML={{ __html: html }}
          className={seg.type === 'block-math' ? "block my-2 overflow-x-auto text-center" : "inline-block px-0.5"}
        />
      );
    });
  }, [value, displayMode]);

  return <div className={`leading-relaxed ${className}`}>{renderedElements}</div>;
};

export default MathDisplay;
