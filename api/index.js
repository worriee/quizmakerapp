/* global process */
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { handleChat } from './ai.js';
import authRouter from './auth.js';

const app = express();

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRouter);

/**
 * POST /api/chat
 * Protected route - requires valid JWT cookie
 */
app.post('/api/chat', async (req, res) => {
  try {
    // JWT Authentication check (reuse middleware logic inline to avoid circular deps)
    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // We need jwt here for verification
    const jwt = (await import('jsonwebtoken')).default;
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

    try {
      jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { message, history } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const rawAIResponse = await handleChat(message, history || []);
    res.json({ raw: rawAIResponse });
  } catch (error) {
    console.error('[Server] Internal Server Error:', error);
    const errorMessage = error.message || 'An unexpected error occurred';
    res.status(500).json({ error: errorMessage });
  }
});

// Health check (no auth required)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Export for Vercel/Serverless environment
export default app;
