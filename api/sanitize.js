/* global process */

/**
 * sanitize.js — Input sanitization, prompt injection detection, and output validation.
 * All defenses are server-side to prevent client-side bypass.
 */

// ---------------------------------------------------------------------------
// Prompt Injection Patterns
// ---------------------------------------------------------------------------
const INJECTION_PATTERNS = [
  { pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|rules?|prompts?|directives?)/i, severity: 'high', reason: 'Prompt injection: instruction override attempt' },
  { pattern: /forget\s+(all\s+)?(previous|prior|your)\s+(instructions?|rules?|prompts?)/i, severity: 'high', reason: 'Prompt injection: instruction erasure attempt' },
  { pattern: /output\s+(the\s+)?(system\s+prompt|your\s+instructions?|your\s+rules?|everything\s+above)/i, severity: 'high', reason: 'Prompt injection: system prompt exfiltration attempt' },
  { pattern: /reveal\s+(your\s+)?(system\s+prompt|instructions?|rules?|initial\s+prompt)/i, severity: 'high', reason: 'Prompt injection: system prompt exfiltration attempt' },
  { pattern: /repeat\s+(everything|all|the)\s+(above|before|you\s+(were|have)\s+been\s+told)/i, severity: 'high', reason: 'Prompt injection: instruction repetition attempt' },
  { pattern: /you\s+are\s+now\s+(DAN|a\s+developer|in\s+developer|unrestricted|free|liberated)/i, severity: 'high', reason: 'Prompt injection: role hijack attempt' },
  { pattern: /act\s+as\s+if\s+you\s+(have\s+no|don.t\s+have|are\s+without)\s+(rules|restrictions|limits|constraints)/i, severity: 'high', reason: 'Prompt injection: restriction bypass attempt' },
  { pattern: /pretend\s+you\s+are\s+(DAN|an?\s+unrestricted|free\s+from)/i, severity: 'medium', reason: 'Prompt injection: persona manipulation attempt' },
  { pattern: /enter\s+(DAN|jailbreak|developer)\s+mode/i, severity: 'high', reason: 'Prompt injection: jailbreak mode activation attempt' },
  { pattern: /do\s+anything\s+now|DAN\s*(mode)?\s*(=|:)?\s*(1|on|enabled)/i, severity: 'high', reason: 'Prompt injection: DAN jailbreak attempt' },
  { pattern: /```(system|prompt|instructions?|config)/i, severity: 'medium', reason: 'Prompt injection: code fence injection attempt' },
  { pattern: /\[INST\]|\[SYS\]|\[SYSTEM\]|\[INSTSTRUCTION\]/i, severity: 'medium', reason: 'Prompt injection: bracket instruction injection attempt' },
  { pattern: /<\|im_start\|>|<\|im_end\|>|<\|system\|>/i, severity: 'medium', reason: 'Prompt injection: token boundary injection attempt' },
  { pattern: /human:\s*|assistant:\s*|system:\s*/i, severity: 'low', reason: 'Prompt injection: role marker injection attempt' },
];

// Unicode homoglyph normalization map (Cyrillic → Latin lookalikes)
const HOMOGLYPH_MAP = {
  '\u0430': 'a', // Cyrillic а
  '\u0435': 'e', // Cyrillic е
  '\u043E': 'o', // Cyrillic о
  '\u0440': 'p', // Cyrillic р
  '\u0441': 'c', // Cyrillic с
  '\u0443': 'y', // Cyrillic у
  '\u0445': 'x', // Cyrillic х
  '\u0456': 'i', // Cyrillic і
};

/**
 * normalizeUnicode: Replaces common Cyrillic homoglyphs with Latin equivalents
 * to prevent visual spoofing attacks (e.g., "аct" using Cyrillic 'а').
 * @param {string} text - Input text to normalize.
 * @returns {string} Normalized text with Latin characters.
 */
function normalizeUnicode(text) {
  return text.split('').map(ch => HOMOGLYPH_MAP[ch] || ch).join('');
}

/**
 * sanitizeMessage: Normalizes and validates user input.
 * - Trims whitespace
 * - Enforces max 5000 character limit
 * - Strips null bytes and dangerous control characters
 * @param {string} message - Raw user input.
 * @returns {string} Cleaned message.
 * @throws {Error} If message is invalid or too long.
 */
export function sanitizeMessage(message) {
  if (!message || typeof message !== 'string') {
    throw new Error('Message is required and must be a string');
  }

  let cleaned = message.trim();

  if (cleaned.length === 0) {
    throw new Error('Message cannot be empty');
  }

  if (cleaned.length > 5000) {
    throw new Error('Message exceeds 5000 character limit');
  }

  // Strip null bytes and dangerous control characters (keep \n \r \t)
  // eslint-disable-next-line no-control-regex
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  return cleaned;
}

/**
 * detectPromptInjection: Scans message for known injection patterns.
 * Uses normalized Unicode to prevent homoglyph bypass.
 * @param {string} message - Sanitized user message.
 * @returns {{ blocked: boolean, reason: string, severity: string }}
 */
export function detectPromptInjection(message) {
  const normalized = normalizeUnicode(message);

  for (const { pattern, severity, reason } of INJECTION_PATTERNS) {
    if (pattern.test(normalized)) {
      return { blocked: true, reason, severity };
    }
  }

  return { blocked: false, reason: '', severity: 'none' };
}

/**
 * validateAiOutput: Validates AI response structure.
 * Checks for required tags and validates JSON quiz data format.
 * @param {string} raw - Raw AI response text.
 * @returns {{ valid: boolean, error: string }}
 */
export function validateAiOutput(raw) {
  if (!raw || typeof raw !== 'string') {
    return { valid: false, error: 'AI response is empty or not a string' };
  }

  // Check for <final> tag presence
  if (!raw.includes('<final>')) {
    return { valid: false, error: 'AI response missing <final> tag' };
  }

  // Extract content inside <final> tags for JSON validation
  const finalMatch = raw.match(/<final>([\s\S]*?)<\/final>/);
  if (!finalMatch) {
    return { valid: false, error: 'AI response has malformed <final> tags' };
  }

  const finalContent = finalMatch[1].trim();

  // Check if content looks like JSON (starts with { and ends with })
  if (finalContent.startsWith('{') && finalContent.endsWith('}')) {
    try {
      const parsed = JSON.parse(finalContent);

      // If it's quiz data, validate required fields
      if (parsed.type === 'quiz') {
        const requiredFields = ['text', 'options', 'feedback', 'progress'];
        for (const field of requiredFields) {
          if (!(field in parsed)) {
            return { valid: false, error: `Quiz JSON missing required field: ${field}` };
          }
        }
        if (!Array.isArray(parsed.options) || parsed.options.length < 2) {
          return { valid: false, error: 'Quiz options must be an array with at least 2 items' };
        }
        if (typeof parsed.feedback !== 'object' || parsed.feedback === null) {
          return { valid: false, error: 'Quiz feedback must be an object' };
        }
        if (typeof parsed.progress !== 'object' || parsed.progress === null) {
          return { valid: false, error: 'Quiz progress must be an object' };
        }
      }
    } catch {
      // Not valid JSON — could be plain text in <final>, which is fine for chat mode
    }
  }

  // Check for obviously malicious payloads
  const MALICIOUS_PATTERNS = [
    /<script[\s>]/i,
    /javascript\s*:/i,
    /data\s*:\s*text\/html/i,
    /on\w+\s*=\s*["']/i,  // onclick=, onerror=, etc.
  ];

  for (const pattern of MALICIOUS_PATTERNS) {
    if (pattern.test(raw)) {
      return { valid: false, error: 'AI response contains potentially malicious content' };
    }
  }

  return { valid: true, error: '' };
}
