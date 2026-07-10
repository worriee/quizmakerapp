function stripThinkingText(text) {
  if (!text) return text;

  let cleaned = text;

  cleaned = cleaned.replace(/^`+\s*/m, "");

  cleaned = cleaned.replace(/^[\s\S]*?AI Learning Assistant Setup\s*/i, "");

  const markerParts = cleaned.split(/\b(?:Final|Response|Answer)\s*:\s*/i);
  if (markerParts.length > 1) {
    let afterMarker = markerParts[markerParts.length - 1].trim();
    const labelMatch = afterMarker.match(/^([A-Za-z ]{1,30}\.)\s*/);
    if (labelMatch) {
      afterMarker = afterMarker.slice(labelMatch[1].length).trim();
    }
    cleaned = afterMarker;
  } else {
    const greetingPatterns =
      /\b(?:Hello|Hi there|Hey|Welcome|I can help|I'm here|What would|Here is|Sure|Of course|Absolutely|Certainly|Hi!|Hello!)/i;
    const greetingMatch = cleaned.match(greetingPatterns);
    if (greetingMatch && greetingMatch.index > 0) {
      cleaned = cleaned.slice(greetingMatch.index);
    }
  }

  if (isMostlyThinking(cleaned)) {
    const paragraphs = cleaned.split(/\n\s*\n/);
    if (paragraphs.length > 1) {
      const nonThinking = paragraphs.filter((p) => !isMostlyThinking(p));
      if (nonThinking.length > 0) {
        cleaned = nonThinking.join("\n\n");
      } else {
        cleaned = paragraphs[paragraphs.length - 1];
      }
    } else {
      const sentences = cleaned.match(/[^.!]+[.!]+/g) || [];
      if (sentences.length > 1) {
        const thinkingPrefixes = /^\s*(I need|I will|I should|I must|I can|Let me|The user|First,|Step \d|Since|Based on|As an|Here is|This is|To |In order|My role|I'm |I am )/i;
        const nonThinking = sentences.filter((s) => !thinkingPrefixes.test(s));
        if (nonThinking.length > 0) {
          cleaned = nonThinking.join(" ");
        } else {
          cleaned = sentences.slice(-2).join(" ");
        }
      }
    }
  }

  cleaned = cleaned.replace(/^[.\s]+/, "").trim();

  return cleaned;
}

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
    /^I(?:'m| am) an? (?:AI|assistant|language model)/i,
    /^As an? (?:AI|assistant)/i,
    /^I (?:must|can|cannot|don't|do not)/i,
    /^(?:Here is|This is|Let me|First,? |Step \d+:)/i,
    /^(?:I'll|I will) generate/i,
    /^(?:I'm |I am )?(?:going to|about to)/i,
    /^(?:Since|Because|Based on) (?:no|the|your|my)/i,
    /^(?:To |In order to |For this)/i,
    /The user (?:is asking|wants|provided|sent|said)/i,
    /I should (?:provide|give|respond|answer|explain)/i,
    /Let me (?:explain|break down|think|analyze|consider)/i,
  ];

  let matchCount = 0;
  for (const pattern of thinkingIndicators) {
    if (pattern.test(text)) matchCount++;
  }

  const firstLine = text.split("\n")[0];
  if (firstLine.length > 50 && /^[\w\s,;:.!?]+$/.test(firstLine)) matchCount++;

  return matchCount >= 2;
}

function trimTitle(title) {
  if (!title) return "";
  let trimmed = title.replace(/^(The|A|An)\s+/i, "").trim();
  if (trimmed.length > 30) {
    trimmed = trimmed.substring(0, 30);
    const lastSpace = trimmed.lastIndexOf(" ");
    if (lastSpace > 10) trimmed = trimmed.substring(0, lastSpace);
  }
  trimmed = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return trimmed.length >= 3 ? trimmed : "";
}

export function generateTitle(message) {
  if (!message || message.trim().length < 3) return "New Chat";

  let title = message.trim();

  const fillerPatterns = [
    /^(can you|please|could you|i want to|i need to|help me (?:with|understand)|tell me about|explain|what is|what are|how do|how does|give me|show me|teach me|i'd like to learn|i'm curious about|what do you know about|write|create|make)\s+/i,
  ];
  for (const pattern of fillerPatterns) {
    const cleaned = title.replace(pattern, "");
    if (cleaned !== title && cleaned.length >= 3) {
      title = cleaned;
      break;
    }
  }

  if (/\b(quiz|test|exam|assess)\b/i.test(title)) {
    title = title.replace(/\b(quiz|test|exam|assess)\b/gi, "").trim();
    title += " Quiz";
  }

  title = title.replace(/[.!?]+$/, "").trim();

  title = title.charAt(0).toUpperCase() + title.slice(1);

  if (title.length > 35) {
    title = title.substring(0, 35);
    const lastSpace = title.lastIndexOf(" ");
    if (lastSpace > 10) title = title.substring(0, lastSpace);
    title += "...";
  }

  return title.length >= 3 ? title : "New Chat";
}

function normalizeOutput(text) {
  if (!text) return "";

  text = text
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "");

  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  text = text.replace(/([^\n])\n(#{1,6}\s)/g, "$1\n\n$2");

  text = text.replace(/(#{1,6})([^\s#])/g, "$1 $2");

  text = text.replace(/([^\n])\n(- )/g, "$1\n\n$2");

  text = text.replace(/\n{3,}/g, "\n\n");

  text = text.replace(/[ \t]+$/gm, "");

  return text.trim();
}

function extractAllTags(raw) {
  const tags = [];
  const anyTagRegex =
    /<\s*([a-zA-Z_][\w-]*)\s*>([\s\S]*?)<\s*\/\s*\1\s*>/gi;
  let match;
  while ((match = anyTagRegex.exec(raw)) !== null) {
    tags.push({
      name: match[1].toLowerCase(),
      content: match[2].trim(),
      fullMatch: match[0],
    });
  }
  return tags;
}

function classifyTag(name) {
  if (name === "title") return "title";
  if (name === "final" || name === "output" || name === "response" || name === "answer")
    return "final";
  if (
    /^(think|though|reason|analysis|scratchpad|internal|reflection|meta|chain_of_thought|cot)$/i.test(
      name,
    ) ||
    /think|thought|reason/i.test(name)
  )
    return "thought";
  return "other";
}

function selectContent(tags, rawText) {
  let title = "";
  let thought = "";
  let final = "";

  for (const tag of tags) {
    const type = classifyTag(tag.name);
    if (type === "title" && !title) {
      title = tag.content;
    } else if (type === "thought" && !thought) {
      thought = tag.content;
    } else if (type === "final" && !final) {
      final = tag.content;
    }
  }

  if (!final && tags.length > 0) {
    let remaining = rawText;
    for (const tag of tags) {
      remaining = remaining.replace(tag.fullMatch, "");
    }
    remaining = remaining.replace(/\s*<\s*\/?\s*[a-zA-Z_][\w-]*\s*[^>]*>\s*/g, "");
    final = remaining.trim();
  }

  return { title, thought, final };
}

function stripAllHtmlTags(text) {
  if (!text) return "";
  return text.replace(
    /<\s*\/?\s*[a-zA-Z_][a-zA-Z0-9_-]*\s*[^>]*>/g,
    "",
  );
}

/**
 * streamingVisibleText: Extracts only the displayable content from
 * partially-accumulated streaming text. Runs on every chunk to determine
 * what the user should see DURING streaming (before full parse).
 *
 * Tag mode (Gemini): strips <thought>/<title>, shows content after <final>
 *   plus extracts text/content from JSON inside <final> if present
 * JSON mode (NVIDIA): extracts "text" (notes/quiz) or "content" (chat)
 *   field value from partial JSON
 * Plain text: shows everything
 */
export function streamingVisibleText(accumulated) {
  if (!accumulated) return "";

  // Extract content after <final> (tag mode) or use full text
  let visible;
  const finalStart = accumulated.lastIndexOf("<final>");
  if (finalStart !== -1) {
    visible = accumulated.slice(finalStart + 7).replace(/<\/?final>/g, "").trim();
  } else {
    // No <final> yet — strip visible structural tags
    visible = stripAllHtmlTags(accumulated).trim();
    if (!visible) return "";
  }

  // JSON content inside <final> (Gemini notes/quiz) or raw JSON (NVIDIA)
  if (visible.startsWith("{")) {
    // Try "text" first (notes/quiz format), then "content" (chat format)
    const textMatch = visible.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)/);
    if (textMatch) {
      return textMatch[1]
        .replace(/\\n/g, "\n")
        .replace(/\\t/g, "\t")
        .replace(/^#{1,6}\s+/gm, "");
    }
    const contentMatch = visible.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)/);
    if (contentMatch) {
      return contentMatch[1]
        .replace(/\\n/g, "\n")
        .replace(/\\t/g, "\t")
        .replace(/^#{1,6}\s+/gm, "");
    }
    // JSON but can't extract displayable field yet — show nothing
    return "";
  }

  // Plain text — strip any remaining tags and markdown markers
  return stripAllHtmlTags(visible).replace(/^#{1,6}\s+/gm, "");
}

export function parseAIResponse(raw) {
  if (!raw) {
    return {
      thought: "",
      final: "",
      structured: {},
    };
  }

  // JSON mode first — models that support response_format output
  // pure JSON with no tags. Check before tag parsing for O(1) fast path.
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      // Chat response from JSON mode: { title, thought, content }
      if (typeof parsed.content === "string") {
        return {
          title: parsed.title ? trimTitle(parsed.title) : "",
          thought: parsed.thought || "",
          final: normalizeOutput(parsed.content),
          fallbackTitle: "",
          structured: {},
        };
      }
      // Quiz/notes response from JSON mode: { type, text, options, ... }
      if (parsed.type === "quiz" || parsed.type === "notes") {
        return {
          title: parsed.title ? trimTitle(parsed.title) : "",
          thought: parsed.thought || "",
          final: parsed.text || "",
          fallbackTitle: "",
          structured: parsed,
        };
      }
    }
  } catch {
    // Not valid JSON — continue to tag-based parser
  }

  // Extract tags from raw text BEFORE normalizeOutput (which would
  // corrupt escape sequences like \n inside JSON strings inside tags)
  const tags = extractAllTags(raw);

  let title = "";
  let thought = "";
  let final = "";
  let structured;
  let jsonParsed = false;

  if (tags.length > 0) {
    const selected = selectContent(tags, raw);
    title = trimTitle(selected.title);
    thought = selected.thought;
    final = selected.final;

    // Try parsing final as JSON first — avoid normalizeOutput corrupting
    // escape sequences like \n inside JSON strings
    try {
      const parsed = JSON.parse(final);
      if (parsed && typeof parsed === "object") {
        structured = parsed;
        final = parsed.content || parsed.text || final;
        jsonParsed = true;
      }
    } catch {
      // not JSON — run text cleanup instead
    }

    if (!jsonParsed) {
      final = stripAllHtmlTags(final);
      final = normalizeOutput(final);
    }
  }

  if (!final) {
    const remainingText = stripAllHtmlTags(normalizeOutput(raw)).trim();

    const jsonMatch = remainingText.match(
      /\{[\s\S]*?"type"\s*:\s*"(notes|quiz)"[\s\S]*?\}/,
    );
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed && typeof parsed === "object") {
          if (parsed.type === "quiz" || parsed.type === "notes") {
            final = jsonMatch[0];
          }
        }
      } catch {
        // not valid JSON
      }
    }

    if (!final) {
      final = remainingText;
    }
  }

  if (!title) {
    const tagTitleMatch = tags.find((t) => t.name === "title");
    if (tagTitleMatch) {
      title = trimTitle(tagTitleMatch.content);
    }
  }

  if (!title) {
    const titleLineMatch = normalizeOutput(raw).match(/Title\s*:\s*([^\n]+)/i);
    if (titleLineMatch) {
      title = trimTitle(titleLineMatch[1]);
    }
  }

  if (!tags.length && !tags.some((t) => classifyTag(t.name) === "thought") && isMostlyThinking(final)) {
    const stripped = stripThinkingText(final);
    final = normalizeOutput(stripped);
  }

  if (!tags.length && title && isMostlyThinking(title)) {
    title = "";
  }

  let fallbackTitle = "";
  if (!title && final.length > 15) {
    const sentences = final.match(/[^.!?]+[.!?]+/g) || [];
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length > 15) {
        fallbackTitle =
          trimmed.length > 30 ? trimmed.substring(0, 30) + "..." : trimmed;
        break;
      }
    }
  }

  if (!jsonParsed) {
    structured = {};
    try {
      const parsed = JSON.parse(final);
      if (parsed && typeof parsed === "object") {
        structured = parsed;
      }
    } catch {
      // not JSON
    }
  }

  if (!structured) structured = {};

  return {
    title,
    thought,
    final,
    fallbackTitle,
    structured,
  };
}
