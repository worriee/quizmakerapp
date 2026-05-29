import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import { handleChat } from './ai.js';

const app = express();

// Trust the first proxy (Vercel) to get the correct client IP for rate limiting
app.set('trust proxy', 1);

// Initialize Supabase client for server-side JWT verification
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Rate Limiting: Prevent API abuse by limiting requests per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per window
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// CORS Configuration: Restrict API access to the trusted frontend domain
const corsOptions = {
  origin: process.env.ALLOWED_ORIGIN || '*', // Use environment variable for production URL
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// Middleware: Validates the Supabase JWT provided in the Authorization header
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication token is missing' });
  }

  const token = authHeader.split(' ')[1];
  try {
    // Verify the token with Supabase to ensure the user is authenticated
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      console.error('Supabase getUser error:', error);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    // Attach the verified user to the request object for later use
    req.user = user;
    next();
  } catch (err) {
    console.error('JWT Verification Exception:', err);
    res.status(500).json({ error: 'Internal server error during authentication' });
  }
};

// Utility: Extracts JSON content from AI responses, handling potential markdown blocks or reasoning text
function cleanJsonResponse(text) {
  // 1. Try to extract content from a ```json block (Highest priority)
  const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch) {
    return jsonBlockMatch[1].trim();
  }

  // 2. Try to extract content from any generic ``` block
  const genericBlockMatch = text.match(/```\s*([\s\S]*?)\s*```/);
  if (genericBlockMatch) {
    return genericBlockMatch[1].trim();
  }

  // 3. Advanced Extraction for Reasoning Models:
  // Reasoning models often output multiple JSON blocks (e.g., {thought: ...} {type: ...}).
  // We look for the LAST valid JSON object in the text.
  const braceMatches = [];
  let stack = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      stack.push(i);
    } else if (text[i] === '}' && stack.length > 0) {
      const start = stack.pop();
      braceMatches.push({ start, end: i + 1 });
    }
  }

  if (braceMatches.length > 0) {
    // Sort by start position descending to check the last object first
    braceMatches.sort((a, b) => b.start - a.start);
    
    for (const match of braceMatches) {
      const candidate = text.substring(match.start, match.end);
      try {
        JSON.parse(candidate);
        return candidate; // Return the first valid JSON object found starting from the end
      } catch (e) {
        // Not valid JSON, try the next one
      }
    }
  }

  // 4. Fallback: Final attempt using first/last brace
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1) return text.trim();
  return text.substring(firstBrace, lastBrace + 1);
}
 
// Root endpoint for health check
app.get('/', (req, res) => {

  res.send('AI Tutor API is running on Vercel!');
});

// Main Chat Endpoint: Handles user messages and generates AI responses
app.post(['/api/chat', '/chat'], limiter, verifyToken, async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Process the request using the AI logic defined in ai.js
    const aiResponse = await handleChat(message, history || []);
    
    // Clean the AI response to ensure it's a valid JSON string
    const cleanedResponse = cleanJsonResponse(aiResponse);
    
    try {
      const parsed = JSON.parse(cleanedResponse);
      res.json(parsed);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      res.status(500).json({ error: 'AI response format error' });
    }
  } catch (error) {
    console.error('General Error in /api/chat:', error);
    res.status(500).json({ error: 'An internal server error occurred' });
  }
});

export default app;
