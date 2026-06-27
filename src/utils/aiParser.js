/**
 * Strips thinking/reasoning text that local models output without <thought> tags.
 * Handles cases where models echo system prompts or dump internal reasoning.
 */
function stripThinkingText(text) {
  if (!text) return text;

  let cleaned = text;

  // Remove leading backtick artifacts (model echoing system prompt formatting)
  cleaned = cleaned.replace(/^`+\s*/m, '');

  // Remove system prompt echo patterns
  cleaned = cleaned.replace(/^[\s\S]*?AI Learning Assistant Setup\s*/i, '');

  // Try to find response markers (Final:, Response:, Answer:) used by models
  // that output structured plain text instead of <final> tags.
  // Use the last occurrence (in case there are multiple markers in the text).
  const markerParts = cleaned.split(/\b(?:Final|Response|Answer)\s*:\s*/i);
  if (markerParts.length > 1) {
    let afterMarker = markerParts[markerParts.length - 1].trim();
    // Strip short label prefix (e.g., "Plain text explanation." — 22 chars ending with period)
    const labelMatch = afterMarker.match(/^([A-Za-z ]{1,30}\.)\s*/);
    if (labelMatch) {
      afterMarker = afterMarker.slice(labelMatch[1].length).trim();
    }
    cleaned = afterMarker;
  } else {
    // Find the first greeting phrase and strip everything before it.
    // This handles cases where thinking is dominant (>70% of text).
    const greetingPatterns = /\b(?:Hello|Hi there|Hey|Welcome|I can help|I'm here|What would|Here is|Sure|Of course|Absolutely|Certainly|Hi!|Hello!)/i;
    const greetingMatch = cleaned.match(greetingPatterns);
    if (greetingMatch && greetingMatch.index > 0) {
      cleaned = cleaned.slice(greetingMatch.index);
    }
  }

  // Clean up any remaining artifacts
  cleaned = cleaned.replace(/^[.\s]+/, '').trim();

  return cleaned;
}

/**
 * Checks if text looks like raw thinking/reasoning rather than a response.
 * Returns true if the text is mostly thinking patterns.
 */
function isMostlyThinking(text) {
  if (!text || text.length < 20) return false;

  const thinkingIndicators = [
    /^`/,
    /AI Learning Assistant/i,
    /I need to acknowledge/i,
    /I need/i,
    /I should respond/i,
    /I will/i,
    /The user (?:provided|wants|is asking|sent)/i,
    /Since no specific/i,
    /to send a friendly/i,
    /introduce my/i,
    /CHAT MODE|NOTE MODE|QUIZ MODE/i,
  ];

  let matchCount = 0;
  for (const pattern of thinkingIndicators) {
    if (pattern.test(text)) matchCount++;
  }

  return matchCount >= 2;
}

export function parseAIResponse(raw) {
  if (!raw) {
    return {
      thought: '',
      final: '',
      structured: {},
    };
  }

  const titleMatch = raw.match(/<title>([\s\S]*?)<\/title>/);
  const thoughtMatch = raw.match(/<thought>([\s\S]*?)<\/thought>/);
  const finalMatch = raw.match(/<final>([\s\S]*?)<\/final>/);

  let title = titleMatch ? titleMatch[1].trim() : '';
  const thought = thoughtMatch ? thoughtMatch[1].trim() : '';
  let final = finalMatch ? finalMatch[1].trim() : '';

  // If <title> tags are missing, try "Title:" line in plain text format
  if (!title) {
    const titleLineMatch = raw.match(/Title\s*:\s*([^\n]+)/i);
    if (titleLineMatch) {
      title = titleLineMatch[1].trim();
    }
  }

  // Fallback: If <final> tags are missing, try to extract content
  if (!final) {
    const remainingText = raw
      .replace(/<thought>[\s\S]*?<\/thought>/g, '')
      .replace(/<final>|<\/final>/g, '')
      .trim();

    if (remainingText.startsWith('{') && remainingText.endsWith('}')) {
      try {
        const parsed = JSON.parse(remainingText);
        if (parsed && typeof parsed === 'object' && (parsed.type === 'notes' || parsed.type === 'quiz')) {
          final = remainingText;
        }
      } catch {
        // Not valid JSON, treat as plain text
      }
    }

    if (!final) {
      final = remainingText;
    }
  }

  // Sanitize: strip remaining tag markup from models with incomplete tags
  const tagRegex = /<\/?(?:thought|final|title)\s*\/?>/gi;
  final = final.replace(tagRegex, '').trim();

  // If the output looks like it's mostly thinking (no proper tags used),
  // try to extract just the actual response
  if (!thoughtMatch && isMostlyThinking(final)) {
    final = stripThinkingText(final);
  }

  // Sanitize title: if no proper <thought> tags and title contains thinking patterns, clear it
  // Titles are short — if it looks like thinking, don't try to salvage it, just clear it
  if (!thoughtMatch && title && isMostlyThinking(title)) {
    title = '';
  }

  // Extract a fallback title from the cleaned AI response for session naming
  // Uses the first substantive sentence (skip short greetings, etc.)
  let fallbackTitle = '';
  if (!title && final.length > 15) {
    const sentences = final.match(/[^.!?]+[.!?]+/g) || [];
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length > 15) {
        fallbackTitle = trimmed.length > 30 ? trimmed.substring(0, 30) + '...' : trimmed;
        break;
      }
    }
  }

  // Attempt to parse the final content as JSON for structured data
  let structured = {};
  try {
    const parsed = JSON.parse(final);
    if (parsed && typeof parsed === 'object') {
      structured = parsed;
    }
  } catch {
    // Not JSON, structured remains empty
  }

  return {
    title,
    thought,
    final,
    fallbackTitle,
    structured,
  };
}
