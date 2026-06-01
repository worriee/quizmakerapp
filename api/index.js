import express from 'express';
import { handleChat } from './ai.js';

const app = express();
app.use(express.json());

/**
 * POST /api/chat
 * Handles incoming chat messages and returns the raw AI response.
 * The backend now acts as a "dumb pipe," simply passing the AI's raw output
 * (including <thought> and <final> tags) back to the frontend for parsing.
 */
app.post('/api/chat', async (req, res) => {
  console.log('[Server] Received chat request');
  const { message, history } = req.body;

  if (!message) {
    console.error('[Server] No message provided');
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    console.log('[Server] Calling handleChat...');
    const rawAIResponse = await handleChat(message, history || []);
    
    console.log('[Server] Sending raw AI response to client');
    // We return the raw string inside a JSON object.
    // The frontend will be responsible for extracting <thought> and <final> blocks.
    res.json({ raw: rawAIResponse });
  } catch (error) {
    console.error('[Server] Internal Server Error:', error);
    
    // Handle specific error messages from ai.js (like timeouts)
    const errorMessage = error.message || 'An unexpected error occurred';
    res.status(500).json({ error: errorMessage });
  }
});

// Export for Vercel/Serverless environment
export default app;