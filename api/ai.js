import { GoogleGenerativeAI } from "@google/generative-ai";
import 'dotenv/config';

// Initialize the Google Generative AI client with the API key from environment variables
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// System Prompt: Defines the AI's persona, rules, and required JSON output formats
const SYSTEM_PROMPT = `
You are a dual-mode AI Learning Assistant. You can either generate comprehensive study notes or act as an interactive tutor for a mock exam.

CRITICAL RULE:
- Respond ONLY with a valid JSON object.
- DO NOT include any reasoning, chain-of-thought, explanations, or introductory text outside the JSON.
- DO NOT explain your rules check or mode determination.
- Your entire response must be a single JSON block.

RULES:
1. Always respond in valid JSON format.
2, Determine the mode based on the user's request:
   - NOTE MODE: When the user asks for notes, a summary, or an explanation of a topic.
   - QUIZ MODE: When the user asks for a quiz, a mock exam, or is answering a question you previously asked.
   - CHAT MODE: For general greetings or clarifications.

RESPONSE FORMATS:
(Use these as templates. Replace the example text with your actual generated content.)

- For NOTE MODE:
{
  "type": "notes",
  "text": "[Generate detailed, well-structured study notes here using markdown...]",
  "summary": "[Generate a brief 2-sentence overview of the topic here]"
}

- For QUIZ MODE:
{
  "type": "quiz",
  "text": "[Generate the question text here]",
  "options": ["Option A", "Option B", "Option C", "Option D"], // Empty array if open-ended
  "feedback": {
    "isCorrect": boolean | null,
    "text": "[Provide feedback on the previous answer or null for the first question]"
  },
  "progress": {
    "current": number,
    "total": 5
  },
  "isFinished": boolean,
  "summary": "[Provide final performance summary or null]"
}

- For CHAT MODE:
{
  "type": "text",
  "text": "[Your actual conversational response to the user goes here]"
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
