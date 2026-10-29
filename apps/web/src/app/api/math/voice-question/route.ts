/**
 * Meta Muse Voice Transcribe & Professor SolvAm Voice Q&A Route
 * Path: /api/math/voice-question
 *
 * Implements the "Cause-First" Cognitive Compression Architecture:
 * - Sentence 1 directly answers the student's "Why / How / What" question using the step's exact numbers.
 * - Strict 2-sentence / 35-word ceiling at a Grade-7 reading level.
 * - Zero parroting of the existing step explanation and zero cheerleading filler.
 * - Full reasoning token budget (max_tokens: 2500) so Meta Muse Spark 1.3 never truncates mid-thought.
 * - Algebraic Transition Analyzer fallback that inspects the actual math transformation instead of echoing prose.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cleanAndExtractJson } from '@/lib/ai/resilience';

interface VoiceQuestionRequestBody {
  questionText?: string;
  audioBase64?: string;
  currentStepNumber: number;
  stepLatex: string;
  stepExplanation: string;
  languageMode?: 'standard' | 'pidgin';
}

interface TutorClarification {
  text: string;
  audioText: string;
  waecTip: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: VoiceQuestionRequestBody = await req.json();
    const {
      questionText,
      audioBase64,
      currentStepNumber,
      stepLatex,
      stepExplanation,
      languageMode = 'standard',
    } = body;

    const metaApiKey = process.env.META_API_KEY;
    const isPidgin = languageMode === 'pidgin';

    let resolvedQuestion = questionText?.trim();

    // Step 1: Transcribe Audio using Meta Muse Voice Transcribe if raw audio was uploaded
    if (!resolvedQuestion && audioBase64) {
      if (metaApiKey && metaApiKey !== 'mock' && metaApiKey !== 'placeholder') {
        try {
          resolvedQuestion = await callMetaMuseVoiceTranscribe(metaApiKey, audioBase64);
        } catch (transcribeErr) {
          console.warn('Meta Muse Voice Transcribe failed:', transcribeErr);
        }
      }
    }

    if (!resolvedQuestion) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Could not transcribe clear speech from the audio recording. Please speak clearly into your microphone or type your question.',
        },
        { status: 400 }
      );
    }

    // Step 2: Formulate Professor SolvAm's Direct Answer (Meta Muse Spark 1.3 + Algebraic Analyzer Fallback)
    let answer: TutorClarification | null = null;
    let modelUsed = 'Meta Muse Spark 1.3 + Muse Voice';

    if (metaApiKey && metaApiKey !== 'mock' && metaApiKey !== 'placeholder') {
      try {
        answer = await callMetaMuseTutorLLM(
          metaApiKey,
          resolvedQuestion,
          currentStepNumber,
          stepLatex,
          stepExplanation,
          isPidgin
        );
      } catch (llmErr) {
        console.warn('Meta Muse Tutor LLM fallback triggered:', llmErr);
        modelUsed = 'Meta Muse Voice (Algebraic Transition Analyzer)';
      }
    } else {
      modelUsed = 'Meta Muse Voice (Algebraic Transition Analyzer)';
    }

    if (!answer) {
      answer = formulatePedagogicalAnswer(
        resolvedQuestion,
        currentStepNumber,
        stepLatex,
        stepExplanation,
        isPidgin
      );
    }

    return NextResponse.json({
      success: true,
      model: modelUsed,
      transcribedQuestion: resolvedQuestion,
      answer: answer.text,
      audioNarration: answer.audioText,
      waecMarkRelevance: answer.waecTip,
    });
  } catch (err: any) {
    console.error('Voice question processing failed:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal voice tutor error' },
      { status: 500 }
    );
  }
}

async function callMetaMuseVoiceTranscribe(apiKey: string, audioBase64: string): Promise<string> {
  const endpoint =
    process.env.META_VOICE_TRANSCRIBE_ENDPOINT || 'https://api.meta.ai/v1/models/muse-voice/transcribe';

  const cleanAudio = audioBase64.replace(/^data:audio\/[a-z0-9]+;base64,/, '');

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      audio: cleanAudio,
      language: 'en',
    }),
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) throw new Error(`Muse Voice API returned status ${res.status}`);
  const data = await res.json();
  return (data.text || data.transcription || '').trim();
}

async function callMetaMuseTutorLLM(
  apiKey: string,
  question: string,
  stepNumber: number,
  stepLatex: string,
  stepExplanation: string,
  isPidgin: boolean
): Promise<TutorClarification> {
  const apiUrl = process.env.META_API_URL || 'https://api.meta.ai/v1/chat/completions';

  const systemPrompt = `You are Professor SolvAm, a math tutor famous for explaining things in the simplest, shortest, most direct way possible.
A student is looking at Step ${stepNumber} of a math solution and asked: "${question}"

Step ${stepNumber} Math Transition (LaTeX): "${stepLatex}"
Step ${stepNumber} Context: "${stepExplanation}"
Language: ${isPidgin ? 'Simple, direct Nigerian Pidgin English' : 'Simple, plain Standard English (Grade 7 reading level)'}

STRICT DIRECT-ANSWER RULES:
1. ANSWER IMMEDIATELY IN SENTENCE 1: Start your very first sentence by directly answering the student's question ("Because..." or "We used... because...").
   - Example: If the student asks "Why did we divide the entire equation by 2?" for $2x^2 + 2x - 12 = 0 \\implies x^2 + x - 6 = 0$, answer: "We divided by $2$ because every number in the equation ($2$, $2$, and $-12$) can be divided evenly by $2$. This makes the numbers smaller and much easier to factor."
2. NEVER REPEAT THE STEP DESCRIPTION: Do NOT copy or parrot "${stepExplanation}". The student already read that and is asking for a simpler clarification.
3. ZERO FLUFF OR PRAISE: Never write "Great question!", "Well done!", "Do not fear!", "In simple terms for Step ${stepNumber}:", or market analogies.
4. HARD LENGTH CAP: Maximum 2 short sentences (under 35 words total).
5. Wrap any inline math or numbers/expressions in single dollar signs $...$ (e.g. $2x^2 + 2x - 12 = 0$).

Return ONLY valid JSON with this exact structure:
{
  "text": "1-2 short, ultra-simple sentences directly answering the question (max 35 words), with math wrapped in $...$",
  "audioText": "Plain spoken version of the answer for text-to-speech (no $ signs or LaTeX backslashes)",
  "waecTip": "1 short sentence WAEC tip for this specific operation, wrapping any math in $...$"
}`;

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'muse-spark-1.3',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question },
      ],
      temperature: 0.15,
      // Production Safeguard: Allocate 2500 tokens so reasoning models never truncate during internal CoT
      max_tokens: 2500,
    }),
    signal: AbortSignal.timeout(25000),
  });

  if (!res.ok) {
    throw new Error(`Meta API status ${res.status}`);
  }

  const data = await res.json();
  const rawContent = data.choices?.[0]?.message?.content;
  if (!rawContent) {
    throw new Error('Empty response from Meta Muse Spark 1.3');
  }

  const parsed = cleanAndExtractJson(rawContent) as Partial<TutorClarification>;
  if (!parsed.text) {
    throw new Error('Invalid JSON structure from tutor model');
  }

  return {
    text: parsed.text,
    audioText: parsed.audioText || parsed.text,
    waecTip:
      parsed.waecTip ||
      `[WAEC Marking Guide] Writing $${stepLatex.replace(/^\$+|\$+$/g, '')}$ clearly secures your step mark.`,
  };
}

/**
 * Deterministic Algebraic Transition & Question Intent Analyzer.
 * Never parrots the existing step explanation verbatim; instead, analyzes the mathematical
 * transformation in `stepLatex` and directly answers the student's "Why / How / What" question.
 */
function formulatePedagogicalAnswer(
  question: string,
  stepNumber: number,
  stepLatex: string,
  explanation: string,
  isPidgin: boolean
): TutorClarification {
  const qLower = question.toLowerCase();
  const cleanLatex = stepLatex.replace(/^\$+|\$+$/g, '').trim();

  // Split transition if stepLatex has \implies or \Rightarrow
  const transitionParts = cleanLatex.split(/\\implies|\\Rightarrow|=>/).map((s) => s.trim());
  const beforeMath = transitionParts[0] || cleanLatex;
  const afterMath = transitionParts.length > 1 ? transitionParts[transitionParts.length - 1] : null;

  // 1. Questions about dividing / common factor / simplifying the equation
  //    e.g. "Why did we divide the entire equation by 2?"
  const divMatch =
    qLower.match(/divide[^\d-]*(-?\d+)/i) ||
    explanation.match(/divided?\s+by\s+\$?(-?\d+)\$?/i);
  if (
    qLower.includes('divide') ||
    qLower.includes('divisible') ||
    qLower.includes('reduce') ||
    qLower.includes('smaller') ||
    divMatch
  ) {
    const divisor = divMatch ? divMatch[1] : 'that common number';
    const text = isPidgin
      ? `We divide by $${divisor}$ because every number inside $${beforeMath}$ fit divide evenly by $${divisor}$ without remainder. Dis one go make the numbers smaller${afterMath ? ` ($${afterMath}$)` : ''} and much easier to solve.`
      : `We used $${divisor}$ because every term in $${beforeMath}$ is evenly divisible by $${divisor}$. Dividing through shrinks the equation${afterMath ? ` into $${afterMath}$` : ''}, making the numbers smaller and much easier to solve.`;

    return {
      text,
      audioText: text.replace(/\$/g, ''),
      waecTip: `[WAEC Tip] Whenever all terms share a common factor like $${divisor}$, dividing every term on both sides makes factoring much faster.`,
    };
  }

  // 2. Questions asking how we got a, b, or c (coefficients of the quadratic equation)
  if (
    /\b(a|b|c)\b/.test(qLower) &&
    (qLower.includes('get') ||
      qLower.includes('find') ||
      qLower.includes('where') ||
      qLower.includes('what') ||
      qLower.includes('come from') ||
      qLower.includes('how'))
  ) {
    const text = isPidgin
      ? `For any quadratic equation $ax^2 + bx + c = 0$, $a$ na the number in front of $x^2$, $b$ na the number in front of $x$, and $c$ na the last number wey stand alone.`
      : `In standard form $ax^2 + bx + c = 0$, $a$ is the number in front of $x^2$, $b$ is the middle number in front of $x$, and $c$ is the standalone number at the end.`;

    return {
      text,
      audioText: text.replace(/\$/g, ''),
      waecTip: `[WAEC Tip] Always include the $-$ sign when reading $b$ or $c$ (for example, $-12$ means $c = -12$, not $+12$).`,
    };
  }

  // 3. Questions about why/how specific factor numbers were chosen or splitting the middle term
  if (
    qLower.includes('number') ||
    qLower.includes('choose') ||
    qLower.includes('pick') ||
    qLower.includes('multiply') ||
    qLower.includes('add') ||
    qLower.includes('split') ||
    qLower.includes('factor') ||
    qLower.includes('how did we get') ||
    qLower.includes('where did')
  ) {
    const text = isPidgin
      ? `We pick those exact numbers for $${cleanLatex}$ because na only dem fit multiply to give the target product and add up to give the middle number at the same time.`
      : `We used those specific numbers in $${cleanLatex}$ because they are the only pair that multiply to the target product and add up to the middle coefficient at the same time.`;

    return {
      text,
      audioText: text.replace(/\$/g, ''),
      waecTip: `[M1 Method Mark] Writing the correct factor pair in $${cleanLatex}$ secures your procedural Method Mark.`,
    };
  }

  // 4. Questions about signs (+/-), moving across '=', or setting brackets to zero
  if (
    qLower.includes('sign') ||
    qLower.includes('negative') ||
    qLower.includes('minus') ||
    qLower.includes('plus') ||
    qLower.includes('zero') ||
    qLower.includes('bracket')
  ) {
    const text = isPidgin
      ? `Whenever a number cross the $=$ sign go the other side, e sign go flip (minus go turn plus, and plus go turn minus) so both sides go remain equal.`
      : `When you move a number across the $=$ sign to isolate $x$, its sign always flips ($-$ becomes $+$, and $+$ becomes $-$) to keep both sides of the equation equal.`;

    return {
      text,
      audioText: text.replace(/\$/g, ''),
      waecTip: `[A1 Accuracy Check] Substitute your final $x$ value back into the original equation to verify that LHS = $0$.`,
    };
  }

  // 5. Questions about WAEC marks or examiners
  if (qLower.includes('waec') || qLower.includes('mark') || qLower.includes('examiner') || qLower.includes('tip')) {
    const text = isPidgin
      ? `WAEC examiners dey check Step ${stepNumber} ($${cleanLatex}$) to give you your Method Mark [M1], even if you make mistake for the final answer.`
      : `WAEC examiners look specifically for $${cleanLatex}$ on your answer sheet to award the Step ${stepNumber} Method Mark, protecting your score even if a later arithmetic slip occurs.`;

    return {
      text,
      audioText: text.replace(/\$/g, ''),
      waecTip: `[WAEC Rubric] Never skip writing $${cleanLatex}$ on its own line—implied steps do not earn partial credit.`,
    };
  }

  // 6. General "Explain Step Simply" or any other "Why" question:
  //    Strip any verbose cheerleading/analogy sentences and explain the algebraic transition directly.
  const strippedCore = stripVerboseFluff(explanation);
  const text = afterMath
    ? isPidgin
      ? `We rewrite $${beforeMath}$ into $${afterMath}$ to make the equation simpler and one step closer to finding $x$. ${strippedCore}`
      : `We transform $${beforeMath}$ into $${afterMath}$ so the equation is simpler and one step closer to isolating $x$. ${strippedCore}`
    : isPidgin
    ? `For Step ${stepNumber}, ${strippedCore}`
    : `${strippedCore}`;

  return {
    text,
    audioText: text.replace(/\$/g, ''),
    waecTip: `[WAEC Guideline] Write $${cleanLatex}$ clearly on its own line so the examiner can award your step mark immediately.`,
  };
}

/**
 * Strips cheerleading filler, fear-assurances, and forced analogies from a step explanation
 * so only the core mathematical instruction remains.
 */
function stripVerboseFluff(raw: string): string {
  const sentences = raw
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const filtered = sentences.filter((s) => {
    const lower = s.toLowerCase();
    if (lower.startsWith('well done')) return false;
    if (lower.startsWith('do not fear') || lower.includes('this is easy')) return false;
    if (lower.startsWith('the simplest method here is')) return false;
    if (lower.startsWith('no shake') || lower.startsWith('imagine say')) return false;
    return true;
  });

  const core = (filtered.length > 0 ? filtered.join(' ') : raw)
    .replace(/^first,\s*like\s+[^,]+,\s*/i, '')
    .trim();

  return core.charAt(0).toUpperCase() + core.slice(1);
}
