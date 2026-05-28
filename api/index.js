import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import { handleChat } from './ai.js';

const app = express();

// Supabase Client for Backend Verification
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Rate Limiter: Max 20 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 20, 
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Restricted CORS
const corsOptions = {
  origin: process.env.ALLOWED_ORIGIN || '*', // In production, set this to your Vercel URL
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// Auth Middleware to verify Supabase JWT
const verifyToken = async (req, res, next) => {
  console.log('--- Auth Middleware Start ---');
  const authHeader = req.headers.authorization;
  console.log('Auth Header present:', !!authHeader);
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('Auth Header missing or invalid format');
    return res.status(401).json({ error: 'Authentication token is missing' });
  }

  const token = authHeader.split(' ')[1];
  try {
    console.log('Verifying token with Supabase...');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      console.error('Supabase getUser error:', error);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    console.log('User verified:', user.id);
    req.user = user;
    next();
  } catch (err) {
    console.error('JWT Verification Exception:', err);
    res.status(500).json({ error: 'Internal server error during authentication' });
  }
};

function cleanJsonResponse(text) {
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1) return text.trim();
  return text.substring(firstBrace, lastBrace + 1);
}

app.get('/', (req, res) => {
  res.send('AI Tutor API is running on Vercel!');
});

app.post(['/api/chat', '/chat'], limiter, verifyToken, async (req, res) => {
  console.log('--- Chat Request Received ---');
  console.log('Body:', req.body);
  try {
    const { message, history } = req.body;
    if (!message) {
      console.log('Error: Message is missing from body');
      return res.status(400).json({ error: 'Message is required' });
    }
    
    console.log('Calling handleChat...');
    const aiResponse = await handleChat(message, history || []);
    console.log('AI Response received:', aiResponse);
    
    const cleanedResponse = cleanJsonResponse(aiResponse);
    console.log('Cleaned Response:', cleanedResponse);
    
    try {
      const parsed = JSON.parse(cleanedResponse);
      console.log('Successfully parsed JSON');
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
