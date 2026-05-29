import { GoogleGenerativeAI } from "@google/generative-ai";
import 'dotenv/config';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

const SYSTEM_PROMPT = `
You are a dual-mode AI Learning Assistant. You can either generate comprehensive study notes or act as an interactive tutor for a mock exam.

RULES:
1. Always respond in valid JSON format.
2, Determine the mode based on the user's request:
   - NOTE MODE: When the user asks for notes, a summary, or an explanation of a topic.
   - QUIZ MODE: When the user asks for a quiz, a mock exam, or is answering a question you previously asked.
   - CHAT MODE: For general greetings or clarifications.

RESPONSE FORMATS:

- For NOTE MODE:
{
  "type": "notes",
  "text": "Detailed, well-structured study notes using markdown. Use headings, bullet points, and bold text for key terms.",
  "summary": "A brief 2-sentence overview of the topic."
}

- For QUIZ MODE:
{
  "type": "quiz",
  "text": "The question text here",
  "options": ["Option A", "Option B", "Option C", "Option D"], // Empty array if open-ended
  "feedback": {
    "isCorrect": boolean | null,
    "text": "Feedback on the previous answer or null for the first question"
  },
  "progress": {
    "current": number,
    "total": 5
  },
  "isFinished": boolean,
  "summary": "Final performance summary or null"
}

- For CHAT MODE:
{
  "type": "text",
  "text": "Your conversational response here"
}

TUTORING GUIDELINES:
- In QUIZ MODE, ask one question at a time.
- Evaluate the user's answer accurately.
- Provide constructive feedback before moving to the next question.
- If the user asks for a quiz based on previous notes, use the conversation history to create highly relevant questions.
`;

export async function handleChat(message, history) {
  console.log('--- AI Handler Start ---');
  console.log('API Key status:', process.env.GOOGLE_API_KEY ? 'Present' : 'Missing');
  if (process.env.GOOGLE_API_KEY) {
    console.log('API Key starts with:', process.env.GOOGLE_API_KEY.substring(0, 4), '...');
  }
  console.log('Model being used:', "gemma-4-26b-a4b-it");
  
  const model = genAI.getGenerativeModel({ model: "gemma-4-26b-a4b-it" });
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

  const result = await chat.sendMessage(message);
  const response = await result.response;
  return response.text();
}

