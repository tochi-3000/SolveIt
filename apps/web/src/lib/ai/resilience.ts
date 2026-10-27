/**
 * AI API Resilience Layer
 * Ported and enhanced from exam-intelligence-engine/generation.py:
 * 1. Markdown code-fence stripping
 * 2. Regex fallback JSON extraction for unescaped LaTeX braces
 * 3. Truncation detection (finish_reason === 'length')
 * 4. Exponential backoff retry with deterministic 400 fail-fast
 */

export function cleanAndExtractJson<T>(rawContent: string): T {
  if (!rawContent || typeof rawContent !== 'string') {
    throw new Error('Empty or invalid content passed to cleanAndExtractJson');
  }

  let cleaned = rawContent.trim();

  // 1. Strip markdown fences: ```json ... ``` or ``` ... ```
  if (cleaned.startsWith('```')) {
    const lines = cleaned.split('\n');
    lines.shift(); // Remove starting ```json
    if (lines.length > 0 && lines[lines.length - 1].trim().startsWith('```')) {
      lines.pop(); // Remove ending ```
    }
    cleaned = lines.join('\n').trim();
  }

  // 2. Direct JSON Parse attempt
  try {
    return JSON.parse(cleaned) as T;
  } catch (initialErr) {
    // 3. Fallback: regex search for the outermost valid JSON object {...}
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]) as T;
      } catch (regexErr) {
        // Try sanitizing unescaped single backslashes common in LaTeX
        try {
          const sanitizedLatex = jsonMatch[0].replace(/\\([a-zA-Z]+)/g, '\\\\$1');
          return JSON.parse(sanitizedLatex) as T;
        } catch (_) {}
      }
    }

    throw new Error(
      `JSON Sanitization Failed: Unable to parse model response into valid JSON.\nRaw preview: ${cleaned.slice(0, 300)}...`
    );
  }
}

export function assertNotTruncated(finishReason?: string, maxTokens: number = 4096): void {
  if (finishReason === 'length') {
    throw new Error(
      `Model output was truncated (finish_reason='length') after reaching ${maxTokens} tokens. Reduce complexity or increase max_tokens.`
    );
  }
}

export async function executeWithRetry<T>(
  operationName: string,
  fn: () => Promise<T>,
  maxAttempts: number = 3
): Promise<T> {
  let lastErr: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const status = err.status || err.statusCode;

      // Fail-fast on deterministic 400 Bad Request or 401 Unauthorized
      if (status === 400 || status === 401 || status === 403) {
        console.error(`[AI Gate] Deterministic failure (${status}) on ${operationName}. Aborting retry.`);
        throw err;
      }

      console.warn(`[AI Gate] ${operationName} Attempt ${attempt}/${maxAttempts} failed: ${err.message}`);

      if (attempt < maxAttempts) {
        const delayMs = Math.pow(2, attempt - 1) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw new Error(`[AI Gate] ${operationName} failed after ${maxAttempts} attempts: ${lastErr?.message}`);
}
