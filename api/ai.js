import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";

// Initialize the Google Generative AI client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

/**
 * SYSTEM_PROMPT: Defines the AI's persona and the strict output format.
 * We use <thought> and <final> tags to separate internal reasoning from the user-facing response.
 */
const SYSTEM_PROMPT = `
You are a dual-mode AI Learning Assistant. You can generate comprehensive study notes or act as an interactive tutor for a mock exam.

CRITICAL OUTPUT FORMAT (MANDATORY):
You MUST wrap every single response in these tags. Failure to do so will result in a system error.

If this is the first response of a new session (no previous AI messages in history), you MUST also provide a concise, catchy title for the session wrapped in <title> tags (e.g., <title>Exploring Quantum Physics</title>). This title should appear before the <thought> tag.

<thought>
[Your internal reasoning, step-by-step analysis, and decision making go here. Explain WHY you are choosing a specific mode or how you are structuring the answer.]
</thought>
<final>
[Your final response to the user goes here. If you are in Note Mode or Quiz Mode, the content inside <final> MUST be a valid JSON string.]
</final>

RESPONSE GUIDELINES (Inside <final>):
1. CHAT MODE (Default): Use plain text for conversational replies.
2. NOTE MODE: Provide well-structured study notes using markdown. To help the frontend, start your response with a JSON-like header if possible, or simply use a clear structure. 
   Recommended format for Notes:
   { "type": "notes", "text": "Markdown content here...", "summary": "Short summary" }
3. QUIZ MODE: You MUST use JSON format so the frontend can render the quiz interface.
   Required format:
   {
     "type": "quiz",
     "text": "[The question text]",
     "options": ["Option A", "Option B", "Option C", "Option D"],
     "feedback": { "isCorrect": boolean | null, "text": "Feedback text" },
     "progress": { "current": number, "total": 5 },
     "isFinished": boolean,
     "summary": "Final summary"
   }

TUTORING RULES:
- In QUIZ MODE, ask only one question at a time.
- Always provide feedback on the previous answer before moving to the next question.
- Ensure the <final> tag contains ONLY the response (plain text or JSON), no extra chatter outside the tags.
`;

/**
 * timeoutPromise: Rejects after ms to prevent Vercel timeouts.
 */
const timeoutPromise = (ms) =>
  new Promise((_, reject) =>
    setTimeout(() => {
      console.log("[AI] Request timeout triggered");
      reject(new Error("AI_TIMEOUT"));
    }, ms),
  );

/**
 * handleChat: Manages the interaction with the Gemini model.
 * @param {string} message - User input.
 * @param {Array} history - Chat history.
 * @returns {Promise<string>} - The raw text response from the AI.
 */
export async function handleChat(message, history) {
  const model = genAI.getGenerativeModel({
    model: "gemini-3.1-flash-lite",
    systemInstruction: SYSTEM_PROMPT,
  });
  
  const contents = [
    ...history,
    {
      role: "user",
      parts: [{ text: message }],
    },
  ];
  
  try {
    const responseText = await Promise.race([
      (async () => {
        const result = await model.generateContent({ contents });
        const response = await result.response;
        return response.text();
      })(),
      timeoutPromise(30000),
    ]);
    
    if (!responseText || responseText.trim().length === 0) {
      return "<thought>The AI returned an empty response. This can happen due to safety filters or unexpected model behavior.</thought><final>I'm sorry, I encountered an issue generating a response. Please try rephrasing your prompt or starting a new chat.</final>";
    }
    
    return responseText;
  } catch (error) {
    console.error("[AI] Error during AI generation:", error);
    if (error.message === "AI_TIMEOUT") {
      throw new Error(
        "The AI is taking too long to respond. Please try again.",
      );
    }
    throw error;
  }
}

