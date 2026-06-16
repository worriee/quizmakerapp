/* global process */
import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";

// Initialize the Google Generative AI client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

const MODEL_CONFIGS = {
  'gemini-3.1-flash-lite': {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    apiKeyEnv: 'GOOGLE_API_KEY',
    modelId: 'gemini-3.1-flash-lite',
  },
  'step-3.7-flash': {
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    apiKeyEnv: 'NVIDIA_API_KEY',
    modelId: 'stepfun-ai/step-3.7-flash',
  },
  'glm-5.1': {
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    apiKeyEnv: 'NVIDIA_API_KEY',
    modelId: 'z-ai/glm-5.1',
  },
};

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
- Always provide feedback on the previous answer using the \`feedback\` object before moving to the next question.
- CRITICAL: The \`text\` field in the quiz JSON must contain ONLY the new question text. Do NOT include feedback or conversational filler in the \`text\` field.
- Ensure the <final> tag contains ONLY the response (plain text or JSON), no extra chatter outside the tags.
`;

/**
 * timeoutPromise: Rejects after ms to prevent Vercel timeouts.
 */
const timeoutPromise = (ms) =>
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error("AI_TIMEOUT")), ms)
  );

/**
 * callOpenAICompatibleAPI: Helper to call OpenAI-compatible endpoints.
 * @param {Object} config - Model configuration.
 * @param {string} message - Current user message.
 * @param {Array} history - Chat history in SDK format.
 * @returns {Promise<string>} - The raw text response.
 */
async function callOpenAICompatibleAPI(config, message, history) {
  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey) {
    throw new Error(`API key not found ${config.apiKeyEnv}`);
  }

  // Convert SDK history format [{role, parts: [{text}]}] to OpenAI format [{role, content}]
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map(msg => ({
      role: msg.role === "model" ? "assistant" : "user",
      content: msg.parts?.[0]?.text || "",
    })),
    { role: "user", content: message },
  ];

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: config.modelId,
      messages: messages,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`API Error (${response.status}): ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

/**
 * handleChat: Manages the interaction with the AI model.
 * @param {string} message - User input.
 * @param {Array} history - Chat history.
 * @param {string} [modelId] - Optional model identifier.
 * @returns {Promise<string>} - The raw text response from the AI.
 */
export async function handleChat(message, history, modelId) {
  // Default to gemini-3.1-flash-lite if no modelId is provided
  const effectiveModelId = modelId || 'gemini-3.1-flash-lite';
  
  const config = MODEL_CONFIGS[effectiveModelId];
  if (!config) {
    throw new Error(`Unsupported model ID: ${effectiveModelId}`);
  }

  try {
    const responseText = await Promise.race([
      callOpenAICompatibleAPI(config, message, history),
      timeoutPromise(30000),
    ]);

    if (!responseText || responseText.trim().length === 0) {
      return "<thought>The AI returned an empty response.</thought><final>I'm sorry, I encountered an issue generating a response.</final>";
    }

    return responseText;
  } catch (error) {
    console.error(`[AI] Provider Error (${effectiveModelId}):`, error);
    if (error.message === "AI_TIMEOUT") {
      const timeoutError = new Error("The AI is taking too long to respond. Please try again.");
      timeoutError.cause = error;
      throw timeoutError;
    }
    throw error;
  }
}

