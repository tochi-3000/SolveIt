/**
 * Arithmetic Progression (A.P.) Mathematical Parser & Evaluator
 *
 * Production Safeguards:
 * - Robust regex parsing supporting both explicit sequences (e.g. "3, 7, 11, 15...")
 *   and prose problem statements (e.g. "first term 9, common difference 4...").
 * - Sanitized arithmetic expression evaluator using strict character whitelist
 *   guaranteeing zero code injection risk.
 * - Normalized multiplication operator handling (supporting 'x', 'X', '*', '\times', '\cdot').
 * - Zero hardcoded defaults: returns null if the problem is unparseable so the system
 *   can gracefully defer to Meta Muse Spark 1.3 LLM rather than giving false fails.
 */

export interface ParsedAP {
  isSequence: boolean;
  a: number; // First term
  d: number; // Common difference
  targetK: number | null; // e.g. 15 for 15th term
  expectedTk: number | null; // e.g. 3 + (15 - 1)*4 = 59
  totalTerms: number | null; // e.g. 10
  expectedTLast: number | null;
  rawSequence?: number[];
}

/**
 * Parses an Arithmetic Progression problem string into ground-truth parameters.
 */
export function parseArithmeticProgression(problem: string): ParsedAP | null {
  const pClean = problem.replace(/\\left|\\right/g, '').replace(/\\dots|\\ldots|\.\.\./g, '');
  const pLower = pClean.toLowerCase();

  // ---------------------------------------------------------------------------
  // Case 1: Sequence List (e.g. "3, 7, 11, 15..." or "2, 5, 8, 11")
  // ---------------------------------------------------------------------------
  // Look for comma-separated numbers: (-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)
  const seqMatch = pClean.match(/(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)(?:\s*,\s*(-?\d+))?/);
  if (seqMatch) {
    const n1 = parseInt(seqMatch[1], 10);
    const n2 = parseInt(seqMatch[2], 10);
    const n3 = parseInt(seqMatch[3], 10);
    const d1 = n2 - n1;
    const d2 = n3 - n2;

    if (!isNaN(n1) && !isNaN(n2) && !isNaN(n3) && d1 === d2) {
      const a = n1;
      const d = d1;
      const rawSequence = [n1, n2, n3];
      if (seqMatch[4]) rawSequence.push(parseInt(seqMatch[4], 10));

      // Extract target term k (e.g. "Find the 15th term")
      const kMatch =
        pLower.match(/find\s+(?:the\s+)?(\d+)(?:st|nd|rd|th)\s+term/i) ||
        pLower.match(/calculate\s+(?:the\s+)?(\d+)(?:st|nd|rd|th)\s+term/i) ||
        pLower.match(/(\d+)(?:st|nd|rd|th)\s+term/i) ||
        pLower.match(/t_?\{?(\d+)\}?/i);

      const targetK = kMatch ? parseInt(kMatch[1], 10) : null;
      const expectedTk = targetK !== null ? a + (targetK - 1) * d : null;

      // Extract total terms if specified
      const totalMatch = pLower.match(/(\d+)\s*terms in total/i) || pLower.match(/\bn\s*=\s*(\d+)/i);
      const totalTerms = totalMatch ? parseInt(totalMatch[1], 10) : null;
      const expectedTLast = totalTerms !== null ? a + (totalTerms - 1) * d : null;

      return {
        isSequence: true,
        a,
        d,
        targetK,
        expectedTk,
        totalTerms,
        expectedTLast,
        rawSequence,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Case 2: Prose Parameter Statements (e.g. "first term 9 and common difference 4")
  // ---------------------------------------------------------------------------
  const aMatch =
    pClean.match(/first term[^0-9-]*(-?\d+)/i) ||
    pClean.match(/\ba\s*=\s*(-?\d+)/i);
  const dMatch =
    pClean.match(/common difference[^0-9-]*(-?\d+)/i) ||
    pClean.match(/\bd\s*=\s*(-?\d+)/i);
  const totalMatch =
    pClean.match(/(\d+)\s*terms in total/i) ||
    pClean.match(/\bn\s*=\s*(\d+)/i);

  if (aMatch && dMatch) {
    const a = parseInt(aMatch[1], 10);
    const d = parseInt(dMatch[1], 10);
    const totalTerms = totalMatch ? parseInt(totalMatch[1], 10) : null;
    const expectedTLast = totalTerms !== null ? a + (totalTerms - 1) * d : null;

    // Check for target term k (e.g. "5th term" or "T_5")
    const kMatch =
      pLower.match(/find\s+(?:the\s+)?(\d+)(?:st|nd|rd|th)\s+term/i) ||
      pLower.match(/(\d+)(?:st|nd|rd|th)\s+term/i) ||
      pLower.match(/t_?\{?(\d+)\}?/i);

    const targetK = kMatch ? parseInt(kMatch[1], 10) : null;
    const expectedTk = targetK !== null ? a + (targetK - 1) * d : null;

    return {
      isSequence: false,
      a,
      d,
      targetK,
      expectedTk,
      totalTerms,
      expectedTLast,
    };
  }

  // Could not authenticate AP with mathematical certainty
  return null;
}

/**
 * Safely evaluates a pure arithmetic expression string.
 * Whitelists only digits, basic operators (+, -, *, /), and parentheses.
 * Replaces human multiplication notations like 'x' or 'X' between numbers,
 * normalizes implicit multiplication (e.g. 3(14) -> 3*(14)), and strips continuation equals signs.
 */
export function safeEvaluateArithmetic(expr: string): number | null {
  if (!expr || typeof expr !== 'string') return null;

  // 1. Strip label prefixes like "T_15 =", "15th term =", "ans =", etc.
  let clean = expr.trim();

  // If line starts with '=', strip it (continuation line like '= 3 + 56')
  if (clean.startsWith('=')) {
    clean = clean.replace(/^=+\s*/, '');
  } else {
    // If there is an assignment like 'T_15 = 59', extract the RHS
    clean = clean.replace(/^.*?=\s*/, '');
  }

  clean = clean
    .replace(/\\left|\\right/g, '')
    .replace(/\\times|\\cdot/g, '*')
    .replace(/\\div/g, '/')
    .replace(/\s+/g, '');

  // 2. Normalize 'x' or 'X' to '*' when between numbers or parentheses
  // e.g. "14x4" -> "14*4", "(15-1)x4" -> "(15-1)*4"
  clean = clean.replace(/(\d|\))\s*[xX]\s*(\d|\()/g, '$1*$2');

  // 3. Normalize implicit multiplication:
  // e.g. "3(14)" -> "3*(14)", ")4" -> ")*4", ")(" -> ")*("
  clean = clean.replace(/(\d)\s*\(/g, '$1*(');
  clean = clean.replace(/\)\s*(\d)/g, ')*$1');
  clean = clean.replace(/\)\s*\(/g, ')*(');

  // 4. Strict character whitelist check (digits, operators, parentheses, dot)
  if (!/^[\d\+\-\*\/\(\)\.]+$/.test(clean)) {
    return null;
  }

  // 5. Evaluate safely
  try {
    const fn = new Function(`"use strict"; return (${clean});`);
    const val = fn();
    if (typeof val === 'number' && !isNaN(val) && isFinite(val)) {
      return Math.round(val * 10000) / 10000;
    }
  } catch {
    return null;
  }

  return null;
}
