/**
 * Math-to-Speech Normalization Utility for SolvAm
 * Converts raw LaTeX and mathematical notation into natural spoken language
 * for Web Speech API and Meta Muse Voice TTS.
 *
 * Production Safeguards:
 * - Safe regex parsing with no catastrophic backtracking
 * - Supports both Standard English and Nigerian Pidgin phonetic pronunciation
 * - Handles complex fractions, exponents, radicals, and systems of equations
 * - Fallback stripping for unhandled LaTeX control sequences
 */

export interface MathSpeechOptions {
  language?: 'standard' | 'pidgin';
}

/**
 * Normalizes a mixed text/LaTeX string into natural spoken English or Nigerian Pidgin.
 */
export function normalizeMathForSpeech(text: string, options: MathSpeechOptions = {}): string {
  if (!text || typeof text !== 'string') return '';

  const { language = 'standard' } = options;
  const isPidgin = language === 'pidgin';

  let s = text.trim();

  // Strip Markdown bold/italic
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1');
  s = s.replace(/\*([^*]+)\*/g, '$1');
  s = s.replace(/__([^_]+)__/g, '$1');
  s = s.replace(/_([^_]+)_/g, '$1');

  // Strip KaTeX delimiters
  s = s.replace(/\$\$([\s\S]*?)\$\$/g, '$1');
  s = s.replace(/\\\[([\s\S]*?)\\\]/g, '$1');
  s = s.replace(/\\\(([\s\S]*?)\\\)/g, '$1');
  s = s.replace(/\$([^\$]+?)\$/g, '$1');

  // Handle Systems of Equations
  s = s.replace(/\\begin\{cases\}([\s\S]*?)\\end\{cases\}/g, (match, body) => {
    const lines = body.split('\\\\').map((l: string) => l.trim()).filter(Boolean);
    if (isPidgin) {
      return `Pair of two equations wey go solve together: equation one na ${lines[0] || ''}, and equation two na ${lines[1] || ''}.`;
    }
    return `System of simultaneous equations: First equation, ${lines[0] || ''}; second equation, ${lines[1] || ''}.`;
  });

  // Handle Common Fractions: \frac{a}{b}
  s = s.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, (match, num, den) => {
    if (num === '1' && den === '2') return isPidgin ? 'half' : 'one half';
    if (num === '1' && den === '3') return isPidgin ? 'one third' : 'one third';
    if (num === '1' && den === '4') return isPidgin ? 'one quarter' : 'one quarter';
    if (num === '3' && den === '4') return isPidgin ? 'three quarters' : 'three quarters';
    if (isPidgin) {
      return `${num} over ${den}`;
    }
    return `${num} divided by ${den}`;
  });

  // Handle Radicals: \sqrt{x} or \sqrt[n]{x}
  s = s.replace(/\\sqrt\{([^}]+)\}/g, 'square root of $1');
  s = s.replace(/\\sqrt\[([^\]]+)\]\{([^}]+)\}/g, '$1-th root of $2');

  // Handle Exponents: x^2 -> x squared, x^3 -> x cubed, x^{exp} -> x to the power of exp
  s = s.replace(/([a-zA-Z0-9]+)\^2\b/g, '$1 squared');
  s = s.replace(/([a-zA-Z0-9]+)²/g, '$1 squared');
  s = s.replace(/([a-zA-Z0-9]+)\^3\b/g, '$1 cubed');
  s = s.replace(/([a-zA-Z0-9]+)³/g, '$1 cubed');
  s = s.replace(/([a-zA-Z0-9]+)\^{([^}]+)}/g, '$1 to the power of $2');
  s = s.replace(/([a-zA-Z0-9]+)\^([a-zA-Z0-9]+)/g, '$1 to the power of $2');

  // Handle Greek Letters & Math Symbols
  s = s.replace(/\\Delta\b/g, 'Delta');
  s = s.replace(/\\theta\b/g, 'theta');
  s = s.replace(/\\pi\b/g, 'pie');
  s = s.replace(/\\alpha\b/g, 'alpha');
  s = s.replace(/\\beta\b/g, 'beta');
  s = s.replace(/\\pm\b/g, isPidgin ? 'plus or minus' : 'plus or minus');
  s = s.replace(/\\times\b/g, isPidgin ? 'times' : 'multiplied by');
  s = s.replace(/\\cdot\b/g, 'times');
  s = s.replace(/\\div\b/g, isPidgin ? 'divided by' : 'divided by');
  s = s.replace(/\\approx\b/g, 'is approximately equal to');
  s = s.replace(/\\neq\b/g, 'is not equal to');
  s = s.replace(/\\le\b|\\leq\b/g, 'is less than or equal to');
  s = s.replace(/\\ge\b|\\geq\b/g, 'is greater than or equal to');
  s = s.replace(/\\implies\b/g, isPidgin ? 'which means say' : 'which implies that');

  // Currency & Localized Units
  s = s.replace(/₦\s*([0-9,]+)/g, '$1 Naira');
  s = s.replace(/\\text\{\s*cm\s*\}/g, 'centimeters');
  s = s.replace(/\\text\{\s*m\s*\}/g, 'meters');
  s = s.replace(/\\text\{\s*([^}]+)\s*\}/g, '$1');

  // Relational signs with spacing
  s = s.replace(/=/g, isPidgin ? ' equal ' : ' equals ');
  s = s.replace(/\+/g, ' plus ');
  s = s.replace(/-/g, ' minus ');

  // Strip lingering LaTeX commands like \quad, \;, \left, \right
  s = s.replace(/\\[a-zA-Z]+/g, ' ');
  s = s.replace(/[{}]/g, '');

  // Compress whitespace
  s = s.replace(/\s+/g, ' ').trim();

  return s;
}

/**
 * Speech Synthesis Helper that wraps window.speechSynthesis with speed and cancel controls.
 */
export function playSpokenMath(
  text: string,
  options: {
    rate?: number;
    pitch?: number;
    language?: 'standard' | 'pidgin';
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: any) => void;
  } = {}
): () => void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('Speech synthesis is not supported on this platform.');
    return () => {};
  }

  const {
    rate = 1.0,
    pitch = 1.0,
    language = 'standard',
    onStart,
    onEnd,
    onError,
  } = options;

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const spokenText = normalizeMathForSpeech(text, { language });
  const utterance = new SpeechSynthesisUtterance(spokenText);

  utterance.rate = Math.max(0.7, Math.min(1.5, rate));
  utterance.pitch = pitch;

  // Look for British or Nigerian English voice if available
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find(
    (v) => v.lang === 'en-NG' || v.lang === 'en-GB' || v.lang.startsWith('en')
  );
  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  if (onStart) utterance.onstart = onStart;
  if (onEnd) utterance.onend = onEnd;
  if (onError) utterance.onerror = onError;

  window.speechSynthesis.speak(utterance);

  // Return cancel function
  return () => {
    window.speechSynthesis.cancel();
  };
}
