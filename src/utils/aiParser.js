export function parseAIResponse(raw) {
  if (!raw) {
    return {
      thought: '',
      final: { type: 'text', content: '' },
    };
  }

  const thoughtMatch = raw.match(/<thought>([\s\S]*?)<\/thought>/);
  const finalMatch = raw.match(/<final type="([^"]*)">([\s\S]*?)<\/final>/);

  const thought = thoughtMatch ? thoughtMatch[1].trim() : '';
  
  if (finalMatch) {
    return {
      thought,
      final: {
        type: finalMatch[1],
        content: finalMatch[2].trim(),
      },
    };
  }

  // Fallback: if no <final> tag is found, use the remaining text after </thought> as the content
  const contentAfterThought = raw.replace(/<thought>[\s\S]*?<\/thought>/, '').trim();
  
  return {
    thought,
    final: {
      type: 'text',
      content: contentAfterThought || raw.trim(),
    },
  };
}