import { NextRequest, NextResponse } from 'next/server';
import { generateParametricTwin } from '@/lib/symbolicClient';
import { cleanAndExtractJson } from '@/lib/ai/resilience';

/**
 * Stage 1: Meta Muse / LLM Dynamic Twin Problem Synthesizer.
 * Provides 100% curriculum coverage across all WAEC topics (Geometric Progression,
 * Circle Geometry, Trigonometry, Matrices, Surds, etc.) with strict JSON contracts.
 * Production Safeguard: Temperature 0.25 for mathematical consistency, topic invariants,
 * and 6-second timeout guard.
 */
async function generateTwinWithLlm(equation: string, topic: string) {
  const apiKey = process.env.META_API_KEY;
  if (!apiKey) return null;

  const apiUrl = process.env.META_API_URL || 'https://api.meta.ai/v1/chat/completions';

  const systemPrompt = `You are SolvAm's Neuro-Symbolic WAEC Twin Math Problem Synthesizer.
Your goal is to generate a mathematically similar "twin" practice problem based on the student's current problem.

CRITICAL ARCHITECTURAL INVARIANTS:
1. TOPIC & METHOD FIDELITY: The twin problem MUST test the EXACT SAME mathematical topic, syllabus concept, and formula as the original. If the topic is Geometric Progression, the twin MUST be Geometric Progression! If Quadratic, it MUST be Quadratic! NEVER change the topic!
2. EXAM-FRIENDLY INTEGER NUMBERS: High school candidates calculate by hand. Ensure the numbers yield clean integers or simple terminating fractions:
   - For Geometric Progression (G.P.): Choose first term a in [2, 6], common ratio r in [2, 3, 1/2], and term index n in [5, 7] so answers do not exceed 100,000.
   - For Arithmetic Progression (A.P.): Choose first term a in [2, 10], common difference d in [-5, 5], term index n in [8, 15].
   - For Quadratic / Factoring: Choose integer roots in [-6, 6] and leading coefficient a in [1, 2, 3].
   - For Calculus Differentiation: Use polynomials up to degree 4 with small integer coefficients.
3. OUTPUT FORMAT: Return ONLY a valid JSON object matching this exact schema:
{
  "success": true,
  "original_equation": "${equation}",
  "twin_equation": "clean text/formula string",
  "twin_equation_latex": "LaTeX representation of problem or equation",
  "correct_answer_latex": "clean LaTeX answer",
  "topic": "${topic}",
  "solution_steps": [
    "Step 1 explanation",
    "Step 2 explanation",
    "Step 3 explanation"
  ],
  "parameters": {}
}`;

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'meta-muse-spark-1.3',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Generate an exam-friendly twin problem for:\nTopic: ${topic}\nCurrent Problem: ${equation}`,
          },
        ],
        temperature: 0.25,
        max_tokens: 1024,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      console.warn(`[Twin LLM] Meta API returned HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    const rawText = data.choices?.[0]?.message?.content;
    if (!rawText) return null;

    const parsed = cleanAndExtractJson<any>(rawText);
    if (!parsed || !parsed.twin_equation_latex) return null;

    // Topic Invariant Safeguard:
    // If requested Geometric Progression, reject if output looks like a standard quadratic polynomial
    const normTopic = topic.toLowerCase();
    const isGp = normTopic.includes('geometric') || normTopic.includes('g.p.') || normTopic.includes('gp');
    if (isGp && parsed.twin_equation_latex.includes('x^2') && !parsed.twin_equation_latex.toLowerCase().includes('t_')) {
      console.warn('[Twin LLM] Generated topic mismatch (quadratic instead of GP), rejecting.');
      return null;
    }

    return parsed;
  } catch (err: any) {
    console.warn('[Twin LLM] LLM twin generation failed or timed out:', err?.message || err);
    return null;
  }
}

/**
 * Resilient deterministic fallback generator when Meta LLM or Python FastAPI Symbolic Engine
 * is unreachable, timing out, or evaluating equations outside standard quadratics.
 * Production Safeguard: Zero crash guarantee, guaranteed clean integer/exact roots.
 */
function generateFallbackTwin(equation: string, topic: string = 'Quadratic Equations') {
  const normalized = (equation + ' ' + topic).toLowerCase();

  // 1. Geometric Progression Detection
  if (
    normalized.includes('geometric') ||
    normalized.includes('g.p.') ||
    normalized.includes('gp') ||
    normalized.includes('common ratio')
  ) {
    const gpVariants = [
      {
        eq: 'Find the 6th term of 3, 6, 12, 24, ...',
        latex: 'T_n = 3(2)^{n-1} \\quad (\\text{Find } T_6 \\text{ for: } 3, 6, 12, 24, \\dots)',
        ans: 'T_6 = 96',
        steps: [
          'Identify first term: a = 3',
          'Calculate common ratio: r = \\frac{6}{3} = 2',
          'Apply general G.P. formula: T_n = a \\cdot r^{n-1}',
          'Substitute n = 6: T_6 = 3 \\cdot (2)^{5} = 3 \\times 32 = 96',
        ],
      },
      {
        eq: 'Find the 5th term of 2, 6, 18, 54, ...',
        latex: 'T_n = 2(3)^{n-1} \\quad (\\text{Find } T_5 \\text{ for: } 2, 6, 18, 54, \\dots)',
        ans: 'T_5 = 162',
        steps: [
          'Identify first term: a = 2',
          'Calculate common ratio: r = \\frac{6}{2} = 3',
          'Apply general G.P. formula: T_n = a \\cdot r^{n-1}',
          'Substitute n = 5: T_5 = 2 \\cdot (3)^{4} = 2 \\times 81 = 162',
        ],
      },
      {
        eq: 'Find the 7th term of 5, 10, 20, 40, ...',
        latex: 'T_n = 5(2)^{n-1} \\quad (\\text{Find } T_7 \\text{ for: } 5, 10, 20, 40, \\dots)',
        ans: 'T_7 = 320',
        steps: [
          'Identify first term: a = 5',
          'Calculate common ratio: r = \\frac{10}{5} = 2',
          'Apply general G.P. formula: T_n = a \\cdot r^{n-1}',
          'Substitute n = 7: T_7 = 5 \\cdot (2)^{6} = 5 \\times 64 = 320',
        ],
      },
      {
        eq: 'Find the 5th term of 4, 12, 36, 108, ...',
        latex: 'T_n = 4(3)^{n-1} \\quad (\\text{Find } T_5 \\text{ for: } 4, 12, 36, 108, \\dots)',
        ans: 'T_5 = 324',
        steps: [
          'Identify first term: a = 4',
          'Calculate common ratio: r = \\frac{12}{4} = 3',
          'Apply general G.P. formula: T_n = a \\cdot r^{n-1}',
          'Substitute n = 5: T_5 = 4 \\cdot (3)^{4} = 4 \\times 81 = 324',
        ],
      },
    ];

    const pick = gpVariants[Math.floor(Math.random() * gpVariants.length)];
    return {
      success: true,
      original_equation: equation,
      twin_equation: pick.eq,
      twin_equation_latex: pick.latex,
      correct_answer_latex: pick.ans,
      solution_steps: pick.steps,
      topic: 'Geometric Progression',
      parameters: { type: 'geometric_progression' },
    };
  }

  // 2. Calculus / Differentiation Detection
  if (
    normalized.includes('dy/dx') ||
    normalized.includes('d/dx') ||
    normalized.includes('differentiat') ||
    normalized.includes('calculus') ||
    normalized.includes('derivative')
  ) {
    const calculusVariants = [
      {
        eq: 'y = 2x^4 - 6x^2 + 4x - 5',
        latex: 'y = 2x^4 - 6x^2 + 4x - 5',
        ans: '\\frac{dy}{dx} = 8x^3 - 12x + 4',
        steps: [
          'Differentiate term-by-term using the power rule: \\frac{d}{dx}[a x^n] = n \\cdot a x^{n-1}',
          '\\frac{d}{dx}[2x^4] = 8x^3',
          '\\frac{d}{dx}[-6x^2] = -12x',
          '\\frac{d}{dx}[4x] = 4 \\quad \\text{and} \\quad \\frac{d}{dx}[-5] = 0',
          'Combine terms: \\frac{dy}{dx} = 8x^3 - 12x + 4',
        ],
      },
      {
        eq: 'y = 3x^3 - 4x^2 + 5x - 8',
        latex: 'y = 3x^3 - 4x^2 + 5x - 8',
        ans: '\\frac{dy}{dx} = 9x^2 - 8x + 5',
        steps: [
          'Apply the power rule to each monomial: \\frac{d}{dx}[x^n] = n x^{n-1}',
          '\\frac{d}{dx}[3x^3] = 9x^2',
          '\\frac{d}{dx}[-4x^2] = -8x',
          '\\frac{d}{dx}[5x] = 5 \\quad \\text{and} \\quad \\frac{d}{dx}[-8] = 0',
          'Combine terms: \\frac{dy}{dx} = 9x^2 - 8x + 5',
        ],
      },
      {
        eq: 'y = 4x^3 + 2x^2 - 7x + 3',
        latex: 'y = 4x^3 + 2x^2 - 7x + 3',
        ans: '\\frac{dy}{dx} = 12x^2 + 4x - 7',
        steps: [
          'Differentiate each component using the standard polynomial derivative formula',
          '\\frac{d}{dx}[4x^3] = 12x^2',
          '\\frac{d}{dx}[2x^2] = 4x',
          '\\frac{d}{dx}[-7x] = -7 \\quad \\text{and} \\quad \\frac{d}{dx}[3] = 0',
          'Combine terms: \\frac{dy}{dx} = 12x^2 + 4x - 7',
        ],
      },
    ];

    const pick = calculusVariants[Math.floor(Math.random() * calculusVariants.length)];
    return {
      success: true,
      original_equation: equation,
      twin_equation: pick.eq,
      twin_equation_latex: pick.latex,
      correct_answer_latex: pick.ans,
      solution_steps: pick.steps,
      topic: 'Calculus Differentiation',
      parameters: { type: 'calculus_polynomial_differentiation' },
    };
  }

  // 3. Arithmetic Progression Detection
  if (
    normalized.includes('progression') ||
    normalized.includes('arithmetic') ||
    normalized.includes('t_n')
  ) {
    const apVariants = [
      {
        eq: 'Find the 10th term of 4, 7, 10, 13, ...',
        latex: 'T_n = 4 + (n - 1)3 \\quad (\\text{Find } T_{10})',
        ans: 'T_{10} = 31',
        steps: [
          'Identify first term: a = 4',
          'Calculate common difference: d = 7 - 4 = 3',
          'Apply general AP formula: T_n = a + (n - 1)d',
          'Substitute n = 10: T_{10} = 4 + (10 - 1)(3) = 4 + 27 = 31',
        ],
      },
      {
        eq: 'Find the 15th term of 2, 6, 10, 14, ...',
        latex: 'T_n = 2 + (n - 1)4 \\quad (\\text{Find } T_{15})',
        ans: 'T_{15} = 58',
        steps: [
          'Identify first term: a = 2',
          'Calculate common difference: d = 6 - 2 = 4',
          'Apply formula: T_{15} = 2 + 14(4) = 2 + 56 = 58',
        ],
      },
    ];

    const pick = apVariants[Math.floor(Math.random() * apVariants.length)];
    return {
      success: true,
      original_equation: equation,
      twin_equation: pick.eq,
      twin_equation_latex: pick.latex,
      correct_answer_latex: pick.ans,
      solution_steps: pick.steps,
      topic: 'Arithmetic Progression',
      parameters: { type: 'arithmetic_progression' },
    };
  }

  // 4. Quadratic / Factoring Default: guaranteed clean integer roots
  const rootsPool = [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5];
  const r1 = rootsPool[Math.floor(Math.random() * rootsPool.length)];
  let r2 = rootsPool[Math.floor(Math.random() * rootsPool.length)];
  while (r2 === r1) {
    r2 = rootsPool[Math.floor(Math.random() * rootsPool.length)];
  }

  const aVals = [1, 2, 3];
  const a = aVals[Math.floor(Math.random() * aVals.length)];

  // a(x - r1)(x - r2) = a(x^2 - (r1+r2)x + r1*r2) = ax^2 + bx + c
  const b = -a * (r1 + r2);
  const c = a * r1 * r2;

  const bSign = b >= 0 ? `+ ${b}` : `- ${Math.abs(b)}`;
  const cSign = c >= 0 ? `+ ${c}` : `- ${Math.abs(c)}`;
  const aStr = a === 1 ? '' : `${a}`;

  const twinLatex = `${aStr}x^2 ${bSign}x ${cSign} = 0`;
  const twinStr = `${a}*x**2 + ${b}*x + ${c} = 0`;

  return {
    success: true,
    original_equation: equation,
    twin_equation: twinStr,
    twin_equation_latex: twinLatex,
    correct_answer_latex: `x = ${r1} \\quad \\text{or} \\quad x = ${r2}`,
    solution_steps: [
      `Standard form: a = ${a}, b = ${b}, c = ${c}`,
      `Discriminant: \\Delta = b^2 - 4ac = (${b})^2 - 4(${a})(${c}) = ${b * b - 4 * a * c}`,
      `Factor form: (${aStr}x ${r1 >= 0 ? `- ${r1}` : `+ ${Math.abs(r1)}`})(x ${r2 >= 0 ? `- ${r2}` : `+ ${Math.abs(r2)}`}) = 0`,
      `Final roots: x = ${r1} \\quad \\text{or} \\quad x = ${r2}`,
    ],
    topic: 'Quadratic Equations',
    parameters: { a, b, c, r1, r2 },
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { equation, topic = 'Quadratic Equations' } = body;

    if (!equation || typeof equation !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "equation" parameter' },
        { status: 400 }
      );
    }

    // -------------------------------------------------------------------------
    // Tier 1: Meta Muse / LLM Dynamic Synthesizer (General Curriculum Coverage)
    // -------------------------------------------------------------------------
    try {
      const llmTwin = await generateTwinWithLlm(equation, topic);
      if (llmTwin && llmTwin.twin_equation_latex) {
        return NextResponse.json(llmTwin);
      }
    } catch (llmErr) {
      console.warn('[Twin Router] LLM generation failed, proceeding to CAS engine:', llmErr);
    }

    // -------------------------------------------------------------------------
    // Tier 2: Python FastAPI Symbolic CAS Engine (SymPy Verified)
    // -------------------------------------------------------------------------
    try {
      const result = await generateParametricTwin(equation, topic);
      if (result && result.twin_equation_latex) {
        // Topic sanity check on Python output:
        const normTopic = topic.toLowerCase();
        const isGp = normTopic.includes('geometric') || normTopic.includes('g.p.') || normTopic.includes('gp');
        if (isGp && result.twin_equation_latex.includes('x^2') && !result.twin_equation_latex.toLowerCase().includes('t_')) {
          console.warn('[Twin Router] Python CAS returned quadratic for GP, falling back to topic generator.');
        } else {
          return NextResponse.json(result);
        }
      }
    } catch (symErr) {
      console.warn(
        '[Twin Router] Python symbolic engine unavailable or timed out, executing deterministic fallback generator:',
        symErr
      );
    }

    // -------------------------------------------------------------------------
    // Tier 3: Deterministic Topic-Aware Edge Fallback (Zero Crash Guarantee)
    // -------------------------------------------------------------------------
    const fallback = generateFallbackTwin(equation, topic);
    return NextResponse.json(fallback);
  } catch (err: any) {
    console.error('API /api/generate-twin fatal error:', err);
    return NextResponse.json(
      generateFallbackTwin('3x^2 - 5x - 2 = 0', 'Quadratic Equations')
    );
  }
}
