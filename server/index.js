const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

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
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost:5173',
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// Auth Middleware to verify Supabase JWT
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication token is missing' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  } catch (err) {
    console.error('JWT Verification Error:', err);
    res.status(500).json({ error: 'Internal server error during authentication' });
  }
};

const { handleChat } = require('./ai');

function cleanJsonResponse(text) {
  // Find the first occurrence of '{' and the last occurrence of '}'
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  
  if (firstBrace === -1 || lastBrace === -1) {
    return text.trim();
  }
  
  return text.substring(firstBrace, lastBrace + 1);
}

app.get('/', (req, res) => {
  res.send('Quiz Maker Backend is running!');
});

app.post('/api/chat', limiter, verifyToken, async (req, res) => {
  console.log(`--- New Chat Request from User: ${req.user.id} ---`);
  
  try {
    const { message, history } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    const aiResponse = await handleChat(message, history || []);
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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
