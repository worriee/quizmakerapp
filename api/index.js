/* global process */
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { handleChat } from './ai.js';
import { authRouter, supabaseService } from './auth.js';

const app = express();

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRouter);

// Session management routes (bypass RLS via supabaseService)
const sessionRouter = express.Router();
sessionRouter.use(cookieParser());

// Reuse authenticate middleware inline to avoid circular deps
const authenticateSession = async (req, res, next) => {
  try {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const jwt = (await import('jsonwebtoken')).default;
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// GET /api/sessions - list all sessions for current user
sessionRouter.get('/', authenticateSession, async (req, res) => {
  try {
    const token = req.cookies.token;
    const jwt = (await import('jsonwebtoken')).default;
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
    const decoded = jwt.verify(token, JWT_SECRET);

    const { data, error } = await supabaseService
      .from('chat_sessions')
      .select('*')
      .eq('user_id', decoded.id)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ sessions: data || [] });
  } catch (error) {
    console.error('[Session] List error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch sessions' });
  }
});

// GET /api/session/:id - get a single session
sessionRouter.get('/:id', authenticateSession, async (req, res) => {
  try {
    const token = req.cookies.token;
    const jwt = (await import('jsonwebtoken')).default;
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
    const decoded = jwt.verify(token, JWT_SECRET);

    const { data, error } = await supabaseService
      .from('chat_sessions')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', decoded.id)
      .single();

    if (error) throw error;
    res.json({ session: data });
  } catch (error) {
    console.error('[Session] Get error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch session' });
  }
});

// POST /api/session/create - create a new session
sessionRouter.post('/create', authenticateSession, async (req, res) => {
  try {
    const token = req.cookies.token;
    const jwt = (await import('jsonwebtoken')).default;
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
    const decoded = jwt.verify(token, JWT_SECRET);

    const { topic, history } = req.body;

    const { data, error } = await supabaseService
      .from('chat_sessions')
      .insert([
        {
          user_id: decoded.id,
          topic: topic || 'New Chat',
          history: history || [],
        },
      ])
      .select();

    if (error) throw error;
    res.status(201).json({ session: data[0] });
  } catch (error) {
    console.error('[Session] Create error:', error);
    res.status(500).json({ error: error.message || 'Failed to create session' });
  }
});

// POST /api/session/:id/update - update session history/topic
sessionRouter.post('/:id/update', authenticateSession, async (req, res) => {
  try {
    const token = req.cookies.token;
    const jwt = (await import('jsonwebtoken')).default;
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
    const decoded = jwt.verify(token, JWT_SECRET);

    const { history, topic } = req.body;

    const { data, error } = await supabaseService
      .from('chat_sessions')
      .update({ history, topic })
      .eq('id', req.params.id)
      .eq('user_id', decoded.id)
      .select();

    if (error) throw error;
    res.json({ session: data[0] });
  } catch (error) {
    console.error('[Session] Update error:', error);
    res.status(500).json({ error: error.message || 'Failed to update session' });
  }
});

// POST /api/session/:id/rename - rename a session
sessionRouter.post('/:id/rename', authenticateSession, async (req, res) => {
  try {
    const token = req.cookies.token;
    const jwt = (await import('jsonwebtoken')).default;
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
    const decoded = jwt.verify(token, JWT_SECRET);

    const { topic } = req.body;

    const { data, error } = await supabaseService
      .from('chat_sessions')
      .update({ topic })
      .eq('id', req.params.id)
      .eq('user_id', decoded.id)
      .select();

    if (error) throw error;
    res.json({ session: data[0] });
  } catch (error) {
    console.error('[Session] Rename error:', error);
    res.status(500).json({ error: error.message || 'Failed to rename session' });
  }
});

// POST /api/session/:id/pin - toggle pin
sessionRouter.post('/:id/pin', authenticateSession, async (req, res) => {
  try {
    const token = req.cookies.token;
    const jwt = (await import('jsonwebtoken')).default;
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
    const decoded = jwt.verify(token, JWT_SECRET);

    // Fetch current pin state first
    const { data: existing, error: fetchError } = await supabaseService
      .from('chat_sessions')
      .select('pinned')
      .eq('id', req.params.id)
      .eq('user_id', decoded.id)
      .single();

    if (fetchError) throw fetchError;

    const { data, error } = await supabaseService
      .from('chat_sessions')
      .update({ pinned: !existing.pinned })
      .eq('id', req.params.id)
      .eq('user_id', decoded.id)
      .select();

    if (error) throw error;
    res.json({ session: data[0] });
  } catch (error) {
    console.error('[Session] Pin error:', error);
    res.status(500).json({ error: error.message || 'Failed to toggle pin' });
  }
});

// DELETE /api/session/:id - delete a session
sessionRouter.delete('/:id', authenticateSession, async (req, res) => {
  try {
    const token = req.cookies.token;
    const jwt = (await import('jsonwebtoken')).default;
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
    const decoded = jwt.verify(token, JWT_SECRET);

    const { error } = await supabaseService
      .from('chat_sessions')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', decoded.id);

    if (error) throw error;
    res.json({ ok: true });
  } catch (error) {
    console.error('[Session] Delete error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete session' });
  }
});

app.use('/api/session', sessionRouter);
app.use('/api/sessions', sessionRouter);

// Health check (no auth required)

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

    const { message, history, model } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const rawAIResponse = await handleChat(message, history || [], model);
    res.json({ raw: rawAIResponse });
  } catch (error) {
    console.error('[Server] Internal Server Error:', error);
    const errorMessage = error.message || 'An unexpected error occurred';
    res.status(500).json({ error: errorMessage });
  }
});

// Export for Vercel/Serverless environment
export default app;
