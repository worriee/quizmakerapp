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
 
  const title = titleMatch ? titleMatch[1].trim() : '';
  const thought = thoughtMatch ? thoughtMatch[1].trim() : '';
  let final = finalMatch ? finalMatch[1].trim() : '';
 
  // Fallback: If <final> tags are missing, check if the remaining content is JSON
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
      } catch (e) {
        // Not valid JSON, treat as plain text
      }
    }
    
    if (!final) {
      final = remainingText;
    }
  }
 
  // Attempt to parse the final content as JSON for structured data
  let structured = {};
  try {
    const parsed = JSON.parse(final);
    if (parsed && typeof parsed === 'object') {
      structured = parsed;
    }
  } catch (e) {
    // Not JSON, structured remains empty
  }
 
  return {
    title,
    thought,
    final,
    structured,
  };
}
