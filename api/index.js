import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { handleChat } from './ai.js';
import { authRouter, supabaseService, authenticate } from './auth.js';
import { sanitizeMessage, detectPromptInjection, validateAiOutput } from './sanitize.js';

const app = express();

const PRODUCTION_ORIGIN = process.env.CORS_ORIGIN || 'https://quizmakerapp.vercel.app';

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? PRODUCTION_ORIGIN : true,
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const MODEL_RPM_LIMITS = {
  'gemini-3.1-flash-lite': 15,
  'step-3.7-flash': 40,
  'glm-5.1': 40,
};
const DEFAULT_RPM = 20;

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: (req) => {
    const model = req.body?.model || 'default';
    return MODEL_RPM_LIMITS[model] || DEFAULT_RPM;
  },
  keyGenerator: (req) => {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const model = req.body?.model || 'default';
    return `${ip}:${model}`;
  },
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth', authLimiter, authRouter);

// Session management routes (bypass RLS via supabaseService)
const sessionRouter = express.Router();
sessionRouter.use(cookieParser());

// GET /api/sessions - list all sessions for current user
sessionRouter.get('/', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseService
      .from('chat_sessions')
      .select('*')
      .eq('user_id', req.user.id)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ sessions: data || [] });
  } catch (error) {
    console.error('[Session] List error:', error.message || error);
    res.status(500).json({ error: error.message || 'Failed to fetch sessions' });
  }
});

// GET /api/session/:id - get a single session
sessionRouter.get('/:id', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseService
      .from('chat_sessions')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error) throw error;
    res.json({ session: data });
  } catch (error) {
    console.error('[Session] Get error:', error.message || error);
    res.status(500).json({ error: error.message || 'Failed to fetch session' });
  }
});

// POST /api/session/create - create a new session
sessionRouter.post('/create', authenticate, async (req, res) => {
  try {
    const { topic, history } = req.body;

    if (!topic && !history) {
      return res.status(400).json({ error: 'Topic or history is required' });
    }

    const { data, error } = await supabaseService
      .from('chat_sessions')
      .insert([
        {
          user_id: req.user.id,
          topic: topic || 'New Chat',
          history: history || [],
        },
      ])
      .select();

    if (error) throw error;
    res.status(201).json({ session: data[0] });
  } catch (error) {
    console.error('[Session] Create error:', error.message || error);
    res.status(500).json({ error: error.message || 'Failed to create session' });
  }
});

// POST /api/session/:id/update - update session history/topic
sessionRouter.post('/:id/update', authenticate, async (req, res) => {
  try {
    const { history, topic } = req.body;

    const { data, error } = await supabaseService
      .from('chat_sessions')
      .update({ history, topic })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select();

    if (error) throw error;
    res.json({ session: data[0] });
  } catch (error) {
    console.error('[Session] Update error:', error.message || error);
    res.status(500).json({ error: error.message || 'Failed to update session' });
  }
});

// POST /api/session/:id/rename - rename a session
sessionRouter.post('/:id/rename', authenticate, async (req, res) => {
  try {
    const { topic } = req.body;

    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    const { data, error } = await supabaseService
      .from('chat_sessions')
      .update({ topic: topic.trim() })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select();

    if (error) throw error;
    res.json({ session: data[0] });
  } catch (error) {
    console.error('[Session] Rename error:', error.message || error);
    res.status(500).json({ error: error.message || 'Failed to rename session' });
  }
});

// POST /api/session/:id/pin - toggle pin
sessionRouter.post('/:id/pin', authenticate, async (req, res) => {
  try {
    const { data: existing, error: fetchError } = await supabaseService
      .from('chat_sessions')
      .select('pinned')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (fetchError) throw fetchError;

    const { data, error } = await supabaseService
      .from('chat_sessions')
      .update({ pinned: !existing.pinned })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select();

    if (error) throw error;
    res.json({ session: data[0] });
  } catch (error) {
    console.error('[Session] Pin error:', error.message || error);
    res.status(500).json({ error: error.message || 'Failed to toggle pin' });
  }
});

// DELETE /api/session/:id - delete a session
sessionRouter.delete('/:id', authenticate, async (req, res) => {
  try {
    const { error } = await supabaseService
      .from('chat_sessions')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json({ ok: true });
  } catch (error) {
    console.error('[Session] Delete error:', error.message || error);
    res.status(500).json({ error: error.message || 'Failed to delete session' });
  }
});

app.use('/api/session', sessionRouter);
app.use('/api/sessions', sessionRouter);

/**
 * POST /api/chat
 * Protected route - requires valid JWT cookie
 */
app.post('/api/chat', chatLimiter, authenticate, async (req, res) => {
  try {
    const { message, history, model, customModelConfig } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required and must be a non-empty string' });
    }

    if (!Array.isArray(history) || history.length > 100) {
      return res.status(400).json({ error: 'History must be an array with at most 100 entries' });
    }

    // Layer 1: Sanitize input — strip control chars, enforce length limit
    let cleanedMessage;
    try {
      cleanedMessage = sanitizeMessage(message);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    // Layer 1b: Detect prompt injection patterns
    const injectionCheck = detectPromptInjection(cleanedMessage);
    if (injectionCheck.blocked) {
      console.warn(`[Sanitize] Blocked ${injectionCheck.severity} injection: ${injectionCheck.reason}`);
      return res.status(400).json({ error: 'Your message was blocked by our content policy.' });
    }

    const rawAIResponse = await handleChat(cleanedMessage, history || [], model, customModelConfig);

    // Layer 3: Validate AI output structure
    const outputCheck = validateAiOutput(rawAIResponse);
    if (!outputCheck.valid) {
      console.warn(`[Sanitize] AI output warning: ${outputCheck.error}`);
    }

    res.json({ raw: rawAIResponse });
  } catch (error) {
    console.error('[Server] Internal Server Error:', error.message || error);
    const errorMessage = error.message || 'An unexpected error occurred';
    res.status(500).json({ error: errorMessage });
  }
});

export default app;
