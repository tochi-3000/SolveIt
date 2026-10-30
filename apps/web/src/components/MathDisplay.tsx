'use client';

import React, { useMemo } from 'react';
import katex from 'katex';

interface MathDisplayProps {
  value?: string | null;
  className?: string;
  displayMode?: boolean;
  inline?: boolean;
}

/**
 * Matches explicit math blocks and inline math delimiters while ignoring escaped currency dollar signs (\$).
 * Allows escaped \$ inside inline $...$ blocks (e.g. $I = \$671.40$).
 */
const MATH_REGEX =
  /(?:\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)|(?<!\\)\$((?:\\\$|[^\$\n])+?)(?<!\\)\$)/g;

/**
 * Detects whether a string contains at least one UNESCAPED math delimiter ($$, \[, \(, or unescaped $).
 */
const UNESCAPED_MATH_DELIMITER_REGEX = /(?:(?<!\\)\$\$|\\\[|\\\(|(?<!\\)\$)/;

/**
 * Matches undelimited mathematical sub-expressions embedded inside natural language prose
 * when they contain explicit LaTeX commands (\times, \frac, \Delta, etc.) or exponents (^2, ²).
 * Avoids swallowing multi-letter English words.
 */
const UNDELIMITED_PROSE_MATH_REGEX =
  /(?:(?:\b[0-9]+(?:\.[0-9]+)?|\b[a-zA-Z]\b|\([+-]?[0-9a-zA-Z]+\)|\\[a-zA-Z]+(?:\{[^{}]*\})*)\s*(?:[+\-*/=<>^]|\\[a-zA-Z]+(?:\{[^{}]*\})*|[²³])\s*)+(?:[0-9]+(?:\.[0-9]+)?|\b[a-zA-Z]\b|\([+-]?[0-9a-zA-Z]+\)|\\[a-zA-Z]+(?:\{[^{}]*\})*|[²³])+/g;

const LATEX_TRIGGER_REGEX =
  /\\(?:frac|sqrt|pm|times|cdot|div|quad|qquad|text|left|right|implies|Rightarrow|Delta|alpha|beta|theta|pi|leq|geq|neq|approx)\b|\\[$%]|\^[0-9a-zA-Z{+-]|[²³]/;

interface Segment {
  type: 'text' | 'inline-math' | 'block-math';
  content: string;
}

/**
 * Normalizes malformed currency/LaTeX dollar patterns emitted by LLMs:
 * 1. `$\671.40$` (where LLM tried to escape `$` before digits inside `$...$` and dropped the inner `$`) -> `\$671.40`
 * 2. `$\$671.40$` (standalone currency wrapped in `$...$`) -> `\$671.40`
 * 3. `\$671.40$` (escaped opening `\$` with a stray closing `$`) -> `\$671.40`
 */
function normalizeCurrencyDelimiters(raw: string): string {
  return raw
    .replace(/(?<!\\)\$\s*\\(\d[\d,]*(?:\.\d+)?)\s*\$/g, '\\$$1')
    .replace(/(?<!\\)\$\s*\\\$(\d[\d,]*(?:\.\d+)?)\s*\$/g, '\\$$1')
    .replace(/(?<!\$)\\\$(\d[\d,]*(?:\.\d+)?)\$/g, '\\$$1');
}

/**
 * Secondary tokenizer for plain-text segments that may contain undelimited LaTeX
 * (e.g., "since 2 \times 3 = 6" or "solve 3x^2 - 5x - 2 = 0") when the LLM omits $...$.
 */
function tokenizeUndelimitedMathInText(text: string): Segment[] {
  if (!text || !LATEX_TRIGGER_REGEX.test(text)) {
    return [{ type: 'text', content: text }];
  }

  const result: Segment[] = [];
  let lastIdx = 0;

  for (const match of text.matchAll(UNDELIMITED_PROSE_MATH_REGEX)) {
    const rawMatch = match[0];
    if (!LATEX_TRIGGER_REGEX.test(rawMatch)) {
      continue;
    }

    const matchStart = match.index!;
    // Strip trailing whitespace or sentence punctuation from the math token
    const trimmedMatch = rawMatch.replace(/[\s.,;:!?]+$/, '');
    if (!trimmedMatch || !LATEX_TRIGGER_REGEX.test(trimmedMatch)) {
      continue;
    }

    if (matchStart > lastIdx) {
      result.push({ type: 'text', content: text.slice(lastIdx, matchStart) });
    }

    const normalizedLatex = trimmedMatch.replace(/²/g, '^2').replace(/³/g, '^3');
    result.push({ type: 'inline-math', content: normalizedLatex });

    lastIdx = matchStart + trimmedMatch.length;
  }

  if (result.length === 0) {
    return [{ type: 'text', content: text }];
  }

  if (lastIdx < text.length) {
    result.push({ type: 'text', content: text.slice(lastIdx) });
  }

  return result;
}

function parseSegments(value: string): Segment[] {
  if (!value) return [];
  const rawSegments: Segment[] = [];
  let lastIndex = 0;

  for (const match of value.matchAll(MATH_REGEX)) {
    const matchStart = match.index!;
    if (matchStart > lastIndex) {
      rawSegments.push({ type: 'text', content: value.slice(lastIndex, matchStart) });
    }

    const blockMath = match[1] || match[2];
    const inlineMath = match[3] || match[4];

    if (blockMath) {
      rawSegments.push({ type: 'block-math', content: blockMath });
    } else if (inlineMath) {
      rawSegments.push({ type: 'inline-math', content: inlineMath });
    }

    lastIndex = matchStart + match[0].length;
  }

  if (lastIndex < value.length) {
    rawSegments.push({ type: 'text', content: value.slice(lastIndex) });
  }

  // Run secondary pass on text segments to rescue any undelimited LaTeX commands
  const finalSegments: Segment[] = [];
  for (const seg of rawSegments) {
    if (seg.type === 'text') {
      finalSegments.push(...tokenizeUndelimitedMathInText(seg.content));
    } else {
      finalSegments.push(seg);
    }
  }

  return finalSegments;
}

/**
 * Determines whether an undelimited string is a standalone mathematical equation
 * rather than a natural-language prose sentence.
 */
function isStandaloneEquation(value: string): boolean {
  // Strip \text{...}, LaTeX commands, escaped symbols (\$, \%), and math keywords to count natural prose words
  const withoutLatex = value
    .replace(/\\text\s*\{[^{}]*\}/g, ' ')
    .replace(/\\[a-zA-Z]+/g, ' ')
    .replace(/\\[$%&#_]/g, ' ')
    .replace(/\b(?:and|or|mod|sin|cos|tan|log|ln|lim|max|min)\b/gi, ' ');

  const proseWords = withoutLatex.match(/\b[a-zA-Z]{3,}\b/g) || [];
  if (proseWords.length >= 2) {
    return false;
  }

  return (
    LATEX_TRIGGER_REGEX.test(value) ||
    /[=<>+\-*/]/.test(value)
  );
}

function renderKatexHtml(latex: string, isBlock: boolean): string {
  try {
    // Production Safeguard: In TeX/LaTeX, a single backslash followed by a digit (e.g. \671.40)
    // is never a valid command and occurs only when an LLM drops '$' from '\$671.40'.
    const normalized = latex
      .trim()
      .replace(/(?<!\\)\\(?=\d)/g, '\\$')
      .replace(/²/g, '^2')
      .replace(/³/g, '^3');

    return katex.renderToString(normalized, {
      displayMode: isBlock,
      throwOnError: false,
      strict: false,
    });
  } catch (err) {
    console.warn('KaTeX render error on:', latex, err);
    return `<span class="text-rose-600 font-mono text-sm">${latex}</span>`;
  }
}

export const MathDisplay: React.FC<MathDisplayProps> = ({
  value,
  className = '',
  displayMode = false,
  inline = false,
}) => {
  const renderedElements = useMemo(() => {
    if (!value) return null;

    const normalizedValue = normalizeCurrencyDelimiters(value);

    // If caller explicitly requested displayMode (e.g. step mathLatex or finalAnswerLatex),
    // strip any redundant outer $...$ or $$...$$ wrapper and render as block KaTeX,
    // BUT ONLY IF it is a standalone math equation, NOT natural-language prose or a word problem!
    if (displayMode) {
      const stripped = normalizedValue
        .trim()
        .replace(/^\$\$([\s\S]*)\$\$$/, '$1')
        .replace(/^\\\[([\s\S]*)\\\]$/, '$1')
        .replace(/^\\\(([\s\S]*)\\\)$/, '$1')
        .replace(/^(?<!\\)\$((?:\\\$|[^\$])+)(?<!\\)\$$/, '$1');

      if (!UNESCAPED_MATH_DELIMITER_REGEX.test(stripped) && isStandaloneEquation(stripped)) {
        return (
          <span
            dangerouslySetInnerHTML={{ __html: renderKatexHtml(stripped, true) }}
            className="inline-block max-w-full overflow-x-auto"
          />
        );
      }
    }

    // Check if the string has explicit UNESCAPED math delimiters ($...$, $$...$$, \(...\), \[...\])
    const hasDelimiters = UNESCAPED_MATH_DELIMITER_REGEX.test(normalizedValue);
    if (!hasDelimiters && isStandaloneEquation(normalizedValue)) {
      return (
        <span
          dangerouslySetInnerHTML={{ __html: renderKatexHtml(normalizedValue, displayMode) }}
          className="inline-block max-w-full overflow-x-auto"
        />
      );
    }

    const segments = parseSegments(normalizedValue);

    return segments.map((seg, idx) => {
      if (seg.type === 'text') {
        // Unescape literal \$ and \% in plain text segments so backslashes never leak onto the screen
        const cleanText = seg.content.replace(/\\\$/g, '$').replace(/\\%/g, '%');
        return (
          <span key={idx} className="whitespace-normal break-words">
            {cleanText}
          </span>
        );
      }

      const isBlock =
        seg.type === 'block-math' ||
        (displayMode && segments.length === 1 && isStandaloneEquation(seg.content));

      // If an inline math segment is just a standalone number or currency amount (e.g., $6$, $+5$, \$671.40),
      // render it in the host sans-serif font so prose numbers don't clash or add gaps before punctuation.
      const trimmedSeg = seg.content.trim().replace(/^\\\$/, '$');
      if (!isBlock && /^\$?[+-]?\d+(?:,\d{3})*(?:\.\d+)?$/.test(trimmedSeg)) {
        return (
          <span key={idx} className="font-semibold">
            {trimmedSeg}
          </span>
        );
      }

      const html = renderKatexHtml(seg.content, isBlock);
      return (
        <span
          key={idx}
          dangerouslySetInnerHTML={{ __html: html }}
          className={
            isBlock
              ? 'block my-2 overflow-x-auto text-center max-w-full'
              : 'inline align-baseline max-w-full'
          }
        />
      );
    });
  }, [value, displayMode]);

  const Wrapper = inline ? 'span' : 'div';
  return (
    <Wrapper className={`leading-relaxed max-w-full overflow-hidden break-words ${className}`}>
      {renderedElements}
    </Wrapper>
  );
};

export default MathDisplay;
