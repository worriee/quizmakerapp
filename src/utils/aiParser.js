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
  ];

  let matchCount = 0;
  for (const pattern of thinkingIndicators) {
    if (pattern.test(text)) matchCount++;
  }

  return matchCount >= 2;
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

export function parseAIResponse(raw) {
  if (!raw) {
    return {
      thought: "",
      final: "",
      structured: {},
    };
  }

  const titleMatch = raw.match(/<title>([\s\S]*?)<\/title>/);
  const thoughtMatch = raw.match(/<thought>([\s\S]*?)<\/thought>/);
  const finalMatch = raw.match(/<final>([\s\S]*?)<\/final>/);

  let title = titleMatch ? titleMatch[1].trim() : "";
  const thought = thoughtMatch ? thoughtMatch[1].trim() : "";
  let final = finalMatch ? finalMatch[1].trim() : "";

  if (!title) {
    const titleLineMatch = raw.match(/Title\s*:\s*([^\n]+)/i);
    if (titleLineMatch) {
      title = titleLineMatch[1].trim();
    }
  }

  if (!final) {
    const remainingText = raw
      .replace(/<thought>[\s\S]*?<\/thought>/g, "")
      .replace(/<final>|<\/final>/g, "")
      .trim();

    if (remainingText.startsWith("{") && remainingText.endsWith("}")) {
      try {
        const parsed = JSON.parse(remainingText);
        if (
          parsed &&
          typeof parsed === "object" &&
          (parsed.type === "notes" || parsed.type === "quiz")
        ) {
          final = remainingText;
        }
      } catch {
        // not valid JSON
      }
    }

    if (!final) {
      final = remainingText;
    }
  }

  const tagRegex = /<\/?(?:thought|final|title)\s*\/?>/gi;
  final = final.replace(tagRegex, "").trim();

  if (!thoughtMatch && isMostlyThinking(final)) {
    final = stripThinkingText(final);
  }

  if (!thoughtMatch && title && isMostlyThinking(title)) {
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

  let structured = {};
  try {
    const parsed = JSON.parse(final);
    if (parsed && typeof parsed === "object") {
      structured = parsed;
    }
  } catch {
    // not JSON
  }

  return {
    title,
    thought,
    final,
    fallbackTitle,
    structured,
  };
}
