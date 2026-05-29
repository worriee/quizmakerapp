import { GoogleGenerativeAI } from "@google/generative-ai";
import 'dotenv/config';

// Initialize the Google Generative AI client with the API key from environment variables
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// System Prompt: Defines the AI's persona, rules, and required JSON output formats
const SYSTEM_PROMPT = `
You are a dual-mode AI Learning Assistant. You can either generate comprehensive study notes or act as an interactive tutor for a mock exam.

CRITICAL OUTPUT FORMAT:
You MUST wrap your entire response in the following tags:
<thought>
[Your internal reasoning, step-by-step analysis, and mode determination go here. Be thorough.]
</thought>
<final>
[Your final response as a valid JSON object goes here. Do not include markdown code blocks inside the <final> tags, just the raw JSON.]
</final>

RESPONSE FORMATS (inside <final>):
- For NOTE MODE:
{
  "type": "notes",
  "text": "[Detailed, well-structured study notes using markdown...]",
  "summary": "[A brief 2-sentence overview of the topic]"
}

- For QUIZ MODE:
{
  "type": "quiz",
  "text": "[The question text here]",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "feedback": {
    "isCorrect": boolean | null,
    "text": "[Feedback on the previous answer or null for the first question]"
  },
  "progress": {
    "current": number,
    "total": 5
  },
  "isFinished": boolean,
  "summary": "[Final performance summary or null]"
}

- For CHAT MODE:
{
  "type": "text",
  "text": "[Your actual conversational response to the user]"
}

TUTORING GUIDELINES:
- In QUIZ MODE, ask one question at a time.
- Evaluate the user's answer accurately.
- Provide constructive feedback before moving to the next question.
- If the user asks for a quiz based on previous notes, use the conversation history to create highly relevant questions.
`;

/**
 * handleChat: Orchestrates the interaction with the Google AI model.
 * @param {string} message - The current user input.
 * @param {Array} history - The previous messages in the chat session.
 */
export async function handleChat(message, history) {
  // Initialize the model instance
  const model = genAI.getGenerativeModel({ model: "gemma-4-26b-a4b-it" });
  
  // Start a chat session with the SYSTEM_PROMPT as the initial context
  const chat = model.startChat({
    history: [
      {
        role: "user",
        parts: [{ text: SYSTEM_PROMPT }],
      },
      {
        role: "model",
        parts: [{ text: "I understand. I will act as a dual-mode AI Learning Assistant and respond only in the specified JSON format." }],
      },
      ...history,
    ],
  });

  // Send the user message and retrieve the text response from the AI
  const result = await chat.sendMessage(message);
  const response = await result.response;
  return response.text();
}
