import { NextRequest, NextResponse } from 'next/server';
import { parseArithmeticProgression, safeEvaluateArithmetic, ParsedAP } from '@/lib/math/apUtils';

export type StepHintStage = 'not_started' | 'on_track' | 'needs_correction' | 'completed';

export interface StepHintResponse {
  success: boolean;
  stage: StepHintStage;
  progressPercent: number; // 0 to 100
  headline: string;
  hintText: string;
  nextActionPrompt: string;
  targetLineIndex: number | null; // 0-indexed line
  model?: string;
}

interface RequestPayload {
  originalProblem: string;
  studentSteps?: string[];
  canvasImageBase64?: string | null;
  inputMode?: 'keyboard' | 'pen' | 'split';
}

const MAX_IMAGE_CHARS = 5_000_000;

/**
 * Normalizes an algebraic expression string by removing whitespace, LaTeX formatting, and asterisks.
 */
function cleanExpr(expr: string): string {
  return expr
    .replace(/\\left|\\right/g, '')
    .replace(/\s+/g, '')
    .replace(/\\cdot|\*/g, '')
    .toLowerCase();
}

/**
 * Parses simple linear equations of the form "ax + b = c" or "ax - b = c" or "x + b = c"
 */
function parseLinearEquation(prob: string): { a: number; b: number; c: number; varName: string } | null {
  const clean = prob.replace(/\s+/g, '').replace(/\\frac|\\cdot/g, '');
  // Matches e.g. 4x+10=16 or 4x-10=16 or x+5=12
  const match = clean.match(/^([+-]?\d*)([a-zA-Z])([+-]\d+)=([+-]?\d+)$/);
  if (!match) return null;

  let aStr = match[1];
  const varName = match[2];
  const bStr = match[3];
  const cStr = match[4];

  let a = 1;
  if (aStr === '' || aStr === '+') a = 1;
  else if (aStr === '-') a = -1;
  else a = parseInt(aStr, 10);

  const b = parseInt(bStr, 10);
  const c = parseInt(cStr, 10);

  if (isNaN(a) || isNaN(b) || isNaN(c)) return null;
  return { a, b, c, varName };
}

/**
 * Evaluates progress and hints deterministically for a linear equation: ax + b = c
 */
function evaluateLinearHint(
  linear: { a: number; b: number; c: number; varName: string },
  steps: string[]
): StepHintResponse {
  const { a, b, c, varName } = linear;
  const targetCMinusB = c - b; // e.g. 16 - 10 = 6
  const targetX = targetCMinusB / a; // e.g. 6 / 4 = 1.5

  if (steps.length === 0) {
    const bAbs = Math.abs(b);
    const bSignWord = b > 0 ? 'subtracting' : 'adding';
    const oppSign = b > 0 ? '-' : '+';
    return {
      success: true,
      stage: 'not_started',
      progressPercent: 0,
      headline: `Step 1: Isolate the ${varName} term`,
      hintText: `Move $${b > 0 ? `+${b}` : b}$ to the other side of the equals sign by ${bSignWord} $${bAbs}$ from both sides.`,
      nextActionPrompt: `Write $${a === 1 ? varName : `${a}${varName}`} = ${c} ${oppSign} ${bAbs}$ on Line 1.`,
      targetLineIndex: null,
    };
  }

  // Check each step sequentially
  for (let idx = 0; idx < steps.length; idx++) {
    const rawStep = steps[idx].trim();
    const clean = cleanExpr(rawStep);

    // Check for common sign error: e.g. 4x = 16 + 10 when equation was 4x + 10 = 16
    if (b > 0 && (clean.includes(`${c}+${b}`) || clean === `${a}${varName}=${c + b}` || clean === `${a}${varName}=${c + b}`)) {
      return {
        success: true,
        stage: 'needs_correction',
        progressPercent: 25,
        headline: `Sign Error on Line ${idx + 1}`,
        hintText: `When $+${b}$ crosses the equals sign, its sign must flip to $-${b}$. You added it instead of subtracting.`,
        nextActionPrompt: `Correct Line ${idx + 1} to $${a === 1 ? varName : `${a}${varName}`} = ${c} - ${b}$.`,
        targetLineIndex: idx,
      };
    }
    if (b < 0 && (clean.includes(`${c}-${Math.abs(b)}`) || clean === `${a}${varName}=${c - Math.abs(b)}`)) {
      return {
        success: true,
        stage: 'needs_correction',
        progressPercent: 25,
        headline: `Sign Error on Line ${idx + 1}`,
        hintText: `When $-${Math.abs(b)}$ crosses the equals sign, its sign must become $+${Math.abs(b)}$.`,
        nextActionPrompt: `Correct Line ${idx + 1} to $${a === 1 ? varName : `${a}${varName}`} = ${c} + ${Math.abs(b)}$.`,
        targetLineIndex: idx,
      };
    }
  }

  const lastStep = cleanExpr(steps[steps.length - 1]);

  // Stage: Final solution reached?
  const isFinalSolved =
    lastStep === `${varName}=${targetX}` ||
    lastStep === `${varName}=${targetCMinusB}/${a}` ||
    (a !== 1 && lastStep === `${varName}=\\frac{${targetCMinusB}}{${a}}`);

  if (isFinalSolved) {
    return {
      success: true,
      stage: 'completed',
      progressPercent: 100,
      headline: 'Excellent! Solution Complete',
      hintText: `You have successfully solved for $${varName} = ${targetX}$.`,
      nextActionPrompt: 'Click "Grade My Working (WAEC M1/A1 Verifier)" below to record your official marks!',
      targetLineIndex: steps.length - 1,
    };
  }

  // Stage: Intermediate step 1: e.g. 4x = 16 - 10
  const isMovedB =
    lastStep.includes(`${c}-${b}`) ||
    lastStep.includes(`${c}+${-b}`) ||
    lastStep === `${a}${varName}=${targetCMinusB}` ||
    lastStep === `${varName}=${targetCMinusB}/${a}`;

  if (isMovedB) {
    if (lastStep === `${a}${varName}=${targetCMinusB}`) {
      return {
        success: true,
        stage: 'on_track',
        progressPercent: 70,
        headline: `Next Step: Isolate ${varName}`,
        hintText: `You simplified to $${a}${varName} = ${targetCMinusB}$. Now divide both sides by the coefficient of $${varName}$ ($${a}$).`,
        nextActionPrompt: `Write $${varName} = \\frac{${targetCMinusB}}{${a}}$ on the next line.`,
        targetLineIndex: steps.length,
      };
    }

    return {
      success: true,
      stage: 'on_track',
      progressPercent: 45,
      headline: `Good First Step! Now Simplify`,
      hintText: `You transferred the constant term correctly. Now evaluate the right-hand side ($${c} - ${b} = ${targetCMinusB}$).`,
      nextActionPrompt: `Write $${a === 1 ? varName : `${a}${varName}`} = ${targetCMinusB}$ on the next line.`,
      targetLineIndex: steps.length,
    };
  }

  // Fallback for general linear progress
  return {
    success: true,
    stage: 'on_track',
    progressPercent: Math.min(80, steps.length * 35),
    headline: 'Keep Going! Isolate the Unknown',
    hintText: `Keep working towards getting $${varName}$ completely by itself on the left side.`,
    nextActionPrompt: `Simplify your terms and divide by $${a}$ to find $${varName}$.`,
    targetLineIndex: steps.length,
  };
}

/**
 * Evaluates progress and hints deterministically for an Arithmetic Progression problem.
 */
function evaluateAPHINT(problem: string, ap: ParsedAP, steps: string[]): StepHintResponse {
  const pLower = problem.toLowerCase();
  const isFindD = pLower.includes('find the common difference') || pLower.includes('find d');
  const targetK = ap.targetK;
  const targetVal = ap.expectedTk ?? ap.expectedTLast;

  // 1. Student has not started yet
  if (steps.length === 0) {
    if (ap.isSequence) {
      const secondNum = ap.rawSequence?.[1] ?? (ap.a + ap.d);
      return {
        success: true,
        stage: 'not_started',
        progressPercent: 0,
        headline: 'Step 1: Identify Parameters from Sequence',
        hintText: `Identify the first term $a = ${ap.a}$ and common difference $d = ${secondNum} - ${ap.a} = ${ap.d}$. Write down the WAEC AP formula $T_n = a + (n - 1)d$.`,
        nextActionPrompt: `Write $a = ${ap.a}, d = ${ap.d}$ and $T_n = a + (n - 1)d$ on Line 1.`,
        targetLineIndex: null,
      };
    }

    if (isFindD) {
      return {
        success: true,
        stage: 'not_started',
        progressPercent: 0,
        headline: 'How to Begin: State Given Values & Formula',
        hintText: `Write down what the question gave you: $a = ${ap.a}$, and the WAEC formula $T_n = a + (n - 1)d$.`,
        nextActionPrompt: `Write $a = ${ap.a}$ and $T_n = a + (n - 1)d$ on Line 1.`,
        targetLineIndex: null,
      };
    }

    return {
      success: true,
      stage: 'not_started',
      progressPercent: 0,
      headline: 'How to Begin: List AP Parameters',
      hintText: `Extract $a = ${ap.a}$, $d = ${ap.d}$, and state the general formula $T_n = a + (n - 1)d$.`,
      nextActionPrompt: `Write $a = ${ap.a}, d = ${ap.d}$ and $T_n = a + (n - 1)d$ on Line 1.`,
      targetLineIndex: null,
    };
  }

  // 2. Scan for specific formula mistake: e.g. using n*d instead of (n-1)*d
  for (let idx = 0; idx < steps.length; idx++) {
    const s = cleanExpr(steps[idx]);
    if (targetK && s.includes(`${targetK}d`) && !s.includes(`(${targetK}-1)d`) && !s.includes(`${targetK - 1}d`)) {
      return {
        success: true,
        stage: 'needs_correction',
        progressPercent: 35,
        headline: `Formula Check on Line ${idx + 1}`,
        hintText: `The AP formula is $T_n = a + (n - 1)d$, not $a + nd$. For the ${targetK}th term ($n = ${targetK}$), the multiplier is $(${targetK} - 1)d = ${targetK - 1}d$.`,
        nextActionPrompt: `Replace $${targetK}d$ with $${targetK - 1}d$ on Line ${idx + 1}.`,
        targetLineIndex: idx,
      };
    }
  }

  // 3. Check if final answer has been reached on the latest line
  const lastStep = steps[steps.length - 1];
  const lastClean = cleanExpr(lastStep);
  const lastVal = safeEvaluateArithmetic(lastStep);

  const reachedTargetTerm =
    targetVal !== null &&
    (lastVal === targetVal ||
      (targetK !== null &&
        (lastClean.includes(`${targetK}thterm=${targetVal}`) ||
          lastClean.includes(`t_${targetK}=${targetVal}`) ||
          lastClean.includes(`t${targetK}=${targetVal}`))));

  const reachedCommonDiff = isFindD && (lastClean.includes(`d=${ap.d}`) || lastVal === ap.d);

  if (reachedTargetTerm || reachedCommonDiff) {
    return {
      success: true,
      stage: 'completed',
      progressPercent: 100,
      headline: 'Excellent! Solution Complete',
      hintText: isFindD
        ? `You successfully found the common difference $d = ${ap.d}$.`
        : `You successfully computed the ${targetK ? `${targetK}th ` : ''}term as $${targetVal}$.`,
      nextActionPrompt: 'Click "Grade My Working (WAEC M1/A1 Verifier)" below to claim your official marks!',
      targetLineIndex: steps.length - 1,
    };
  }

  // 4. Check intermediate progress:
  // a) Intermediate evaluation like 3 + 56
  const kMinus1TimesD = targetK ? (targetK - 1) * ap.d : null;
  if (kMinus1TimesD !== null) {
    const hasIntermediateSum = steps.some((step) => {
      const clean = cleanExpr(step);
      const val = safeEvaluateArithmetic(step);
      return clean.includes(`${ap.a}+${kMinus1TimesD}`) || val === targetVal;
    });

    if (hasIntermediateSum) {
      return {
        success: true,
        stage: 'on_track',
        progressPercent: 85,
        headline: 'Almost Done! Add the Terms',
        hintText: `Now add the first term $${ap.a}$ to the product $${kMinus1TimesD}$ to find the final ${targetK ? `${targetK}th ` : ''}term.`,
        nextActionPrompt: `Write $${targetK ? `T_{${targetK}} = ` : ''}${targetVal}$ on the next line.`,
        targetLineIndex: steps.length,
      };
    }
  }

  // b) Substitution step like 3 + (15 - 1)*4
  const hasSubstituted = steps.some((step) => {
    const clean = cleanExpr(step);
    return (
      clean.includes(`${ap.a}+(${targetK ?? 'n'}-1)`) ||
      clean.includes(`${ap.a}+${targetK ? targetK - 1 : 'n-1'}x${ap.d}`) ||
      clean.includes(`${ap.a}+${targetK ? targetK - 1 : 'n-1'}*${ap.d}`) ||
      (targetK !== null && clean.includes(`(${targetK}-1)`))
    );
  });

  if (hasSubstituted) {
    return {
      success: true,
      stage: 'on_track',
      progressPercent: 65,
      headline: 'Good Substitution! Simplify the Product',
      hintText: targetK
        ? `Calculate the multiplication: $(${targetK} - 1) \\times ${ap.d} = ${targetK - 1} \\times ${ap.d} = ${(targetK - 1) * ap.d}$.`
        : `Multiply $(n - 1)$ by the common difference $d = ${ap.d}$.`,
      nextActionPrompt: targetK
        ? `Write $${ap.a} + ${(targetK - 1) * ap.d}$ on the next line.`
        : `Simplify the expression on the next line.`,
      targetLineIndex: steps.length,
    };
  }

  // c) Stating parameters: a = 3, d = 4
  const allText = steps.map(cleanExpr).join(' ');
  const hasA = allText.includes(`a=${ap.a}`);
  const hasD = allText.includes(`d=${ap.d}`);

  if (hasA || hasD) {
    return {
      success: true,
      stage: 'on_track',
      progressPercent: 35,
      headline: 'Parameters Identified! Next: Formula',
      hintText: `You identified the parameters. Now write down $T_n = a + (n - 1)d$ and substitute $a = ${ap.a}, d = ${ap.d}${targetK ? `, n = ${targetK}` : ''}$.`,
      nextActionPrompt: `Write $${targetK ? `T_{${targetK}}` : 'T_n'} = ${ap.a} + (${targetK ?? 'n'} - 1)(${ap.d})$ on the next line.`,
      targetLineIndex: steps.length,
    };
  }

  // Generic on-track fallback
  return {
    success: true,
    stage: 'on_track',
    progressPercent: 25,
    headline: 'Next: Substitute into the AP Formula',
    hintText: `Use the formula $T_n = a + (n - 1)d$ with first term $a = ${ap.a}$ and common difference $d = ${ap.d}$.`,
    nextActionPrompt: `Write the formula substitution on Line ${steps.length + 1}.`,
    targetLineIndex: steps.length,
  };
}

/**
 * Evaluates progress and hints deterministically for a Quadratic Factoring equation: ax^2 + bx + c = 0
 */
function evaluateQuadraticHint(problem: string, steps: string[]): StepHintResponse {
  const clean = cleanExpr(problem);
  // Match standard non-monic 3x^2 - 5x - 2 = 0
  const isWaecNonMonic = clean.includes('3x^2-5x-2=0');

  if (steps.length === 0) {
    if (isWaecNonMonic) {
      return {
        success: true,
        stage: 'not_started',
        progressPercent: 0,
        headline: 'How to Begin: Split the Middle Term',
        hintText: 'Find two numbers whose product is $a \\times c = 3 \\times (-2) = -6$ and whose sum is $b = -5$. (Hint: $-6$ and $+1$).',
        nextActionPrompt: 'Write $3x^2 - 6x + 1x - 2 = 0$ on Line 1.',
        targetLineIndex: null,
      };
    }
    return {
      success: true,
      stage: 'not_started',
      progressPercent: 0,
      headline: 'How to Begin: Identify Factor Pairs',
      hintText: 'Identify $a$, $b$, and $c$. Look for two factors of $a \\times c$ that sum up to $b$ to split your middle term.',
      nextActionPrompt: 'Rewrite the equation by splitting the middle term on Line 1.',
      targetLineIndex: null,
    };
  }

  // Check for common sign mistake: 3x^2 + 6x - x - 2 = 0
  for (let idx = 0; idx < steps.length; idx++) {
    const s = cleanExpr(steps[idx]);
    if (isWaecNonMonic && (s.includes('+6x-x') || s.includes('+6x-1x'))) {
      return {
        success: true,
        stage: 'needs_correction',
        progressPercent: 30,
        headline: `Middle Term Sign Error on Line ${idx + 1}`,
        hintText: `Notice that $+6x - 1x = +5x$, but the equation has $-5x$. The factors must be $-6$ and $+1$, not $+6$ and $-1$.`,
        nextActionPrompt: `Change Line ${idx + 1} to $3x^2 - 6x + x - 2 = 0$.`,
        targetLineIndex: idx,
      };
    }
  }

  const allText = steps.map(cleanExpr).join(' ');

  if (allText.includes('x=2') && (allText.includes('x=-1/3') || allText.includes('x=-\\frac{1}{3}'))) {
    return {
      success: true,
      stage: 'completed',
      progressPercent: 100,
      headline: 'Roots Completely Solved!',
      hintText: 'You factored and solved for both roots: $x = 2$ or $x = -\\frac{1}{3}$.',
      nextActionPrompt: 'Click "Grade My Working (WAEC M1/A1 Verifier)" to lock in your full marks!',
      targetLineIndex: steps.length - 1,
    };
  }

  if (allText.includes('(3x+1)(x-2)=0') || allText.includes('(x-2)(3x+1)=0')) {
    return {
      success: true,
      stage: 'on_track',
      progressPercent: 85,
      headline: 'Next: Apply Zero Product Rule',
      hintText: 'You factored cleanly into $(3x + 1)(x - 2) = 0$. Set each bracket equal to zero to find the roots.',
      nextActionPrompt: 'Write $3x + 1 = 0 \\implies x = -\\frac{1}{3}$ and $x - 2 = 0 \\implies x = 2$.',
      targetLineIndex: steps.length,
    };
  }

  if (allText.includes('3x(x-2)+1(x-2)=0') || allText.includes('3x(x-2)+(x-2)=0')) {
    return {
      success: true,
      stage: 'on_track',
      progressPercent: 65,
      headline: 'Next: Factor Out the Common Bracket',
      hintText: 'Notice both terms have $(x - 2)$. Factor $(x - 2)$ out to get two linear factors.',
      nextActionPrompt: 'Write $(3x + 1)(x - 2) = 0$ on the next line.',
      targetLineIndex: steps.length,
    };
  }

  if (allText.includes('3x^2-6x+x-2=0') || allText.includes('3x^2-6x+1x-2=0')) {
    return {
      success: true,
      stage: 'on_track',
      progressPercent: 40,
      headline: 'Next: Factor by Grouping in Pairs',
      hintText: 'Group $(3x^2 - 6x) + (x - 2) = 0$ and factor $3x$ from the first pair and $1$ from the second pair.',
      nextActionPrompt: 'Write $3x(x - 2) + 1(x - 2) = 0$ on the next line.',
      targetLineIndex: steps.length,
    };
  }

  return {
    success: true,
    stage: 'on_track',
    progressPercent: Math.min(85, steps.length * 28),
    headline: 'Keep Going with Factoring',
    hintText: 'Group your split terms and factor common expressions from each group.',
    nextActionPrompt: 'Extract common terms from each pair of terms.',
    targetLineIndex: steps.length,
  };
}

/**
 * Meta Muse Spark 1.3 LLM Socratic Hint Generator (for arbitrary problems or Light Pen drawings)
 */
async function callMetaMuseForHint(
  apiKey: string,
  problem: string,
  steps: string[],
  canvasImageBase64?: string | null
): Promise<StepHintResponse> {
  const apiUrl = process.env.META_API_URL || 'https://api.meta.ai/v1/chat/completions';

  const systemPrompt = `You are Professor SolvAm, a friendly, master Socratic WAEC Mathematics Mentor.
Your role is to guide students step-by-step WITHOUT giving away the final numerical answer directly.

Pedagogical Rules:
1. If the student has NO steps (stage: "not_started"):
   - Provide a super simple, friendly first move (e.g. for "4x + 10 = 16", tell them to move +10 across by subtracting 10).
2. If the student has written steps and they are mathematically valid (stage: "on_track"):
   - Validate what they did, estimate their progress percentage (e.g. 50%), and prompt the IMMEDIATE NEXT micro-operation.
3. If the student made a mistake (stage: "needs_correction"):
   - Pinpoint the exact line index (0-indexed: targetLineIndex).
   - Point out the discrepancy gently (e.g., sign change, formula misapplication) and ask a guiding question to fix it.
4. If they have reached the final answer (stage: "completed"):
   - Set progressPercent = 100, celebrate, and encourage them to verify marks.
5. Keep explanations under 2 concise sentences. Always wrap math expressions in $...$.

Output MUST be strictly valid JSON:
{
  "stage": "not_started" | "on_track" | "needs_correction" | "completed",
  "progressPercent": number (0 to 100),
  "headline": "Short Catchy Title (max 6 words)",
  "hintText": "Socratic guidance without spoiling the final answer (max 2 sentences)",
  "nextActionPrompt": "Short action to take next",
  "targetLineIndex": number or null
}`;

  const userMessages: any[] = [];
  if (canvasImageBase64 && canvasImageBase64.startsWith('data:image/')) {
    userMessages.push({
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: canvasImageBase64 } },
        {
          type: 'text',
          text: `Problem: "${problem}". The student drew their solution on this canvas. Inspect their progress and provide a Socratic next-step hint.`,
        },
      ],
    });
  } else {
    userMessages.push({
      role: 'user',
      content: `Problem: "${problem}"\nStudent's Sequential Working Lines:\n${
        steps.length === 0 ? '(No steps written yet - canvas is empty)' : steps.map((s, i) => `Line ${i + 1}: ${s}`).join('\n')
      }\n\nProvide the appropriate Socratic hint according to your instructions.`,
    });
  }

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'muse-spark-1.3',
      messages: [{ role: 'system', content: systemPrompt }, ...userMessages],
      temperature: 0.1,
      max_tokens: 600,
    }),
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) throw new Error(`Meta Hint API HTTP ${res.status}`);
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error('Empty AI hint response');

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON object in response');
  const parsed = JSON.parse(jsonMatch[0]);

  return {
    success: true,
    stage: parsed.stage || (steps.length === 0 ? 'not_started' : 'on_track'),
    progressPercent: typeof parsed.progressPercent === 'number' ? parsed.progressPercent : steps.length === 0 ? 0 : 50,
    headline: parsed.headline || 'Helpful Step Hint',
    hintText: parsed.hintText || 'Write out your next step carefully using WAEC standard formulas.',
    nextActionPrompt: parsed.nextActionPrompt || 'Proceed to the next line.',
    targetLineIndex: typeof parsed.targetLineIndex === 'number' ? parsed.targetLineIndex : null,
    model: 'Meta Muse Spark 1.3 Socratic Tutor',
  };
}

export async function POST(req: NextRequest) {
  try {
    const body: RequestPayload = await req.json();
    const { originalProblem, studentSteps = [], canvasImageBase64 } = body;

    if (!originalProblem || typeof originalProblem !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request: originalProblem is required.' },
        { status: 400 }
      );
    }

    if (canvasImageBase64 && canvasImageBase64.length > MAX_IMAGE_CHARS) {
      return NextResponse.json(
        { error: 'Canvas image payload too large.' },
        { status: 413 }
      );
    }

    const nonEmptySteps = studentSteps.map((s) => s.trim()).filter(Boolean);
    const hasCanvasInk = Boolean(canvasImageBase64 && canvasImageBase64.startsWith('data:image/'));

    // Check if problem matches simple linear equation (e.g. 4x + 10 = 16)
    const linear = parseLinearEquation(originalProblem);
    if (linear && !hasCanvasInk) {
      const hint = evaluateLinearHint(linear, nonEmptySteps);
      return NextResponse.json(hint);
    }

    // Check if problem is Arithmetic Progression
    const parsedAP = parseArithmeticProgression(originalProblem);
    if (parsedAP && !hasCanvasInk) {
      const hint = evaluateAPHINT(originalProblem, parsedAP, nonEmptySteps);
      return NextResponse.json(hint);
    }

    // Check if problem is Quadratic Equation
    if (
      (originalProblem.includes('^2') || originalProblem.includes('x²')) &&
      !hasCanvasInk
    ) {
      const hint = evaluateQuadraticHint(originalProblem, nonEmptySteps);
      return NextResponse.json(hint);
    }

    // LLM Fallback (or when canvas drawing is provided)
    const metaApiKey = process.env.META_API_KEY;
    if (metaApiKey && metaApiKey !== 'mock' && metaApiKey !== 'placeholder') {
      try {
        const aiHint = await callMetaMuseForHint(
          metaApiKey,
          originalProblem,
          nonEmptySteps,
          canvasImageBase64
        );
        return NextResponse.json(aiHint);
      } catch (aiErr) {
        console.warn('Meta Muse Socratic hint fallback triggered:', aiErr);
      }
    }

    // Universal Fallback if no specific pattern matched
    if (nonEmptySteps.length === 0 && !hasCanvasInk) {
      return NextResponse.json({
        success: true,
        stage: 'not_started',
        progressPercent: 0,
        headline: 'How to Begin This Problem',
        hintText: `Write down the given parameters or the fundamental formula needed to solve: "${originalProblem}".`,
        nextActionPrompt: 'Type your first step on Line 1 or sketch it with your Light Pen.',
        targetLineIndex: null,
      });
    }

    return NextResponse.json({
      success: true,
      stage: 'on_track',
      progressPercent: Math.min(80, nonEmptySteps.length * 30),
      headline: 'Next Step Guidance',
      hintText: `You have completed ${nonEmptySteps.length} step${
        nonEmptySteps.length > 1 ? 's' : ''
      }. Continue isolating your unknown variables towards the final answer.`,
      nextActionPrompt: 'Enter your next working step on the pad.',
      targetLineIndex: nonEmptySteps.length,
    });
  } catch (err: any) {
    console.error('Step hint endpoint error:', err);
    return NextResponse.json(
      {
        error: 'Failed to generate step hint. Please try again.',
        details: err?.message,
      },
      { status: 500 }
    );
  }
}
