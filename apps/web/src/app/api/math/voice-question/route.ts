/**
 * Meta Muse Voice Transcribe & Professor SolvAm Voice Q&A Route
 * Path: /api/math/voice-question
 *
 * Allows students to ask contextual voice or typed questions on any specific solution step.
 * Uses Meta Muse Voice Transcribe for raw audio payloads and Meta Muse Spark 1.3
 * to generate dynamic pedagogical answers tailored to the student's exact question and active step.
 *
 * Production Safeguards:
 * - Strict input validation (never substitutes fake questions when speech capture is silent)
 * - Dynamic LLM synthesis via Meta Muse Spark 1.3 with step-aware offline fallback
 * - Returns clean inline-LaTeX ($...$) answers and plain-text audio narration for TTS
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

    // Step 2: Formulate Professor SolvAm's Answer (Live Meta Muse Spark 1.3 with dynamic step-aware fallback)
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
        modelUsed = 'Meta Muse Voice (Local Step-Aware Fallback)';
      }
    } else {
      modelUsed = 'Meta Muse Voice (Local Step-Aware Fallback)';
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

  const systemPrompt = `You are Professor SolvAm, a warm, crystal-clear WAEC Mathematics Tutor.
A student is looking at Step ${stepNumber} of a worked math solution and just asked you a specific question.
Active Step Explanation: "${stepExplanation}"
Active Step Equation (LaTeX): "${stepLatex}"
Language Mode: ${isPidgin ? 'Friendly Nigerian Pidgin English' : 'Clear, conversational Standard English'}

RULES:
1. Directly and specifically answer the student's exact question ("${question}") using the numbers and math from Step ${stepNumber}.
2. Keep your answer concise (2 to 3 sentences) and easy to understand.
3. Wrap any inline math formulas or equations in single dollar signs $...$ (e.g. $2 \\times 3 = 6$ or $(x + 2)(x + 3) = 0$).
4. Return ONLY valid JSON with this exact structure:
{
  "text": "2-3 sentence direct answer to the student's question with inline math wrapped in $...$",
  "audioText": "Plain spoken version of the answer for text-to-speech (no $ signs or LaTeX backslashes)",
  "waecTip": "1-sentence WAEC Examiner tip relevant to this step, wrapping any math in $...$"
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
      temperature: 0.2,
      max_tokens: 600,
    }),
    signal: AbortSignal.timeout(20000),
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
      `[WAEC Marking Guide] Showing Step ${stepNumber} ($${stepLatex}$) clearly secures your procedural mark.`,
  };
}

function formulatePedagogicalAnswer(
  question: string,
  stepNumber: number,
  stepLatex: string,
  explanation: string,
  isPidgin: boolean
): TutorClarification {
  const qLower = question.toLowerCase();
  const cleanLatex = stepLatex.replace(/^\$+|\$+$/g, '').trim();

  // 1. Questions specifically asking how we got a, b, or c (coefficients of the quadratic equation)
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
      ? `Every quadratic equation dey follow the standard pattern $ax^2 + bx + c = 0$. Look the original equation: $a$ na the number in front of $x^2$, $b$ na the middle number in front of $x$, and $c$ na the last constant number wey stand alone. For this step ($${cleanLatex}$), we just pick $a$ and $c$ directly from the question and multiply them!`
      : `Every quadratic equation follows the standard form $ax^2 + bx + c = 0$: $a$ is the coefficient in front of $x^2$, $b$ is the middle coefficient in front of $x$, and $c$ is the constant number at the end (including its $+$ or $-$ sign). In Step ${stepNumber} ($${cleanLatex}$), we take $a$ and $c$ directly from those positions in the original equation and multiply them together.`;

    return {
      text,
      audioText: text,
      waecTip: `[M1 Method Mark] Always include the negative sign when reading $b$ or $c$ from $ax^2 + bx + c = 0$ (for example, $-2$ means $c = -2$, not $+2$).`,
    };
  }

  // 2. Questions about why/how specific factor numbers were chosen
  if (
    qLower.includes('number') ||
    qLower.includes('choose') ||
    qLower.includes('pick') ||
    qLower.includes('multiply') ||
    qLower.includes('add') ||
    qLower.includes('how did we get') ||
    qLower.includes('where did')
  ) {
    const text = isPidgin
      ? `For Step ${stepNumber} ($${cleanLatex}$), we dey find two numbers wey satisfy two rules at the same time: when you multiply them, dem go give $a \\times c$, and when you add them, dem go give the middle number $b$. Only one pair of numbers fit work for both rules!`
      : `In Step ${stepNumber} ($${cleanLatex}$), we test factor pairs of $a \\times c$ until we find the unique pair that adds up to the middle coefficient $b$. That is why these specific numbers work—they satisfy both the multiplication rule and the addition rule simultaneously.`;

    return {
      text,
      audioText: text,
      waecTip: `[M1 Method Mark] Finding the correct factor pair in $${cleanLatex}$ secures the first procedural Method Mark on WAEC Paper 2.`,
    };
  }

  // 3. Questions about signs (+/-) or brackets
  if (
    qLower.includes('sign') ||
    qLower.includes('negative') ||
    qLower.includes('minus') ||
    qLower.includes('plus') ||
    qLower.includes('bracket')
  ) {
    const text = isPidgin
      ? `Sharp question about the signs! For Step ${stepNumber} ($${cleanLatex}$), the signs must match both the multiplication and addition rules. Also remember say when you set a bracket to zero and move a number across $=$, plus go turn minus and minus go turn plus!`
      : `Great question regarding signs in Step ${stepNumber} ($${cleanLatex}$)! Inside the factored brackets, the signs come directly from the factor pair you found, whereas when you set each factor equal to $0$ and isolate $x$, moving a term across the $=$ sign flips its sign.`;

    return {
      text,
      audioText: text,
      waecTip: `[M1/A1 Sign Check] Always double-check that multiplying the two signs gives the constant term's sign and adding them gives the middle term's sign.`,
    };
  }

  // 4. Questions about WAEC marks or examiners
  if (qLower.includes('waec') || qLower.includes('mark') || qLower.includes('examiner') || qLower.includes('grade')) {
    const text = isPidgin
      ? `For WAEC Theory Paper 2, examiners dey mark Step ${stepNumber} ($${cleanLatex}$) to see whether your method correct. Even if you make small mistake later, writing this step clearly go lock your Method Mark!`
      : `On WAEC Theory Paper 2, examiners inspect Step ${stepNumber} ($${cleanLatex}$) to verify your algebraic method. Writing this transition explicitly locks in your partial credit even if a slip occurs later.`;

    return {
      text,
      audioText: text,
      waecTip: `[WAEC Rubric Insight] Never skip writing $${cleanLatex}$ on paper—implied steps do not earn standalone Method Marks if your final answer is wrong.`,
    };
  }

  // 5. General / "Explain simply" questions tailored to the current step
  const text = isPidgin
    ? `Make we break Step ${stepNumber} down well-well: ${explanation} We write $${cleanLatex}$ so both sides of the equation go stay balanced while we move closer to the final answer.`
    : `In simple terms for Step ${stepNumber}: ${explanation} Writing the milestone as $${cleanLatex}$ keeps the equation balanced and sets up the next step cleanly.`;

  return {
    text,
    audioText: text,
    waecTip: `[WAEC Guideline] Always write $${cleanLatex}$ on its own line so the examiner can award your step mark immediately.`,
  };
}
