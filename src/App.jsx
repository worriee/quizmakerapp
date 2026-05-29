import React, { useState, useEffect } from 'react';
import MainLayout from './components/MainLayout';
import ChatInterface from './components/ChatInterface';
import Login from './components/Login';
import { supabase } from './supabaseClient';

// Base URL for backend serverless functions
const API_BASE_URL = '/api';

/**
 * App Component: The root of the application.
 * Manages authentication state, session persistence, and the core chat logic.
 */
function App() {
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [abortController, setAbortController] = useState(null);

  useEffect(() => {

    // Initial session check on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Listen for auth state changes (Sign in, Sign out, Token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
        await fetchSessions(session.user.id);
      } else {
        setSessions([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Retrieves a list of previous chat sessions for the current user
  const fetchSessions = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
  };

  // Handles user logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Persists chat history to the Supabase database
  const saveSessionToDb = async (updatedHistory, topic) => {
    if (!session) return;

    try {
      if (currentSessionId) {
        // Update existing record if a session is already active
        await supabase
          .from('chat_sessions')
          .update({ history: updatedHistory, topic })
          .eq('id', currentSessionId);
      } else {
        // Create a new record for a brand new chat
        const { data, error } = await supabase
          .from('chat_sessions')
          .insert([
            {
              user_id: session.user.id,
              topic: topic || 'New Chat',
              history: updatedHistory
            }
          ])
          .select();

        if (error) throw error;
        setCurrentSessionId(data[0].id);
        // Refresh list to show the new session in sidebar
        await fetchSessions(session.user.id);
      }
    } catch (error) {
      console.error('Error saving session:', error);
    }
  };

  // Main function to send a message to the AI backend
  const handleSendMessage = async (text) => {
    const userMsg = { role: 'user', text, type: 'text' };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    const controller = new AbortController();
    setAbortController(controller);

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        signal: controller.signal,
        body: JSON.stringify({
          message: text,
          history: history,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with ${response.status}`);
      }

      const data = await response.json();
      
      setMessages(prev => [...prev, { 
        role: 'model', 
        ...data 
      }]);

      const updatedHistory = [
        ...history,
        { role: 'user', parts: [{ text }] },
        { role: 'model', parts: [{ text: JSON.stringify(data) }] },
      ];
      setHistory(updatedHistory);
      
      const topic = messages.length === 0 ? text : sessions.find(s => s.id === currentSessionId)?.topic || 'Chat';
      await saveSessionToDb(updatedHistory, topic);
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Request aborted by user');
      } else {
        console.error('Error sending message:', error);
        setMessages(prev => [...prev, { 
          role: 'model', 
          text: `Error: ${error.message}`, 
          type: 'text' 
        }]);
      }
    } finally {
      setIsLoading(false);
      setAbortController(null);
    }
  };

  const handleStartQuiz = async () => {
    setIsLoading(true);
    
    const controller = new AbortController();
    setAbortController(controller);

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        signal: controller.signal,
        body: JSON.stringify({
          message: 'Now, start a mock quiz based on the notes provided above.',
          history: history
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with ${response.status}`);
      }

      const data = await response.json();
      
      setMessages(prev => [...prev, { 
        role: 'model', 
        ...data 
      }]);

      const updatedHistory = [
        ...history,
        { role: 'user', parts: [{ text: 'Start a mock quiz based on the notes provided above.' }] },
        { role: 'model', parts: [{ text: JSON.stringify(data) }] },
      ];
      setHistory(updatedHistory);
      
      const topic = sessions.find(s => s.id === currentSessionId)?.topic || 'Quiz Session';
      await saveSessionToDb(updatedHistory, topic);
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Request aborted by user');
      } else {
        console.error('Error starting quiz:', error);
        setMessages(prev => [...prev, { 
          role: 'model', 
          text: `Error: ${error.message}`, 
          type: 'text' 
        }]);
      }
    } finally {
      setIsLoading(false);
      setAbortController(null);
    }
  };

  const stopGenerating = () => {
    if (abortController) {
      abortController.abort();
      setIsLoading(false);
      setAbortController(null);
    }
  };

  const handleNewChat = () => {

    setMessages([]);
    setHistory([]);
    setCurrentSessionId(null);
  };

  // Loads a specific session's history from the database
  const handleLoadSession = async (sessionId) => {
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) throw error;

      setCurrentSessionId(sessionId);
      setHistory(data.history);
      
      // Transform stored AI history (JSON strings) back into UI message objects
      const loadedMessages = data.history.map(item => {
        if (item.role === 'model') {
          try {
            const parsed = JSON.parse(item.parts[0].text);
            return {
              role: 'model',
              ...parsed,
              text: parsed.text || parsed.question?.text || 'AI Response'
            };
          } catch {
            return { role: 'model', text: item.parts[0].text, type: 'text' };
          }
        }
        return { role: 'user', text: item.parts[0].text, type: 'text' };
      });
      
      setMessages(loadedMessages);
    } catch (error) {
      console.error('Error loading session:', error);
    }
  };

  return (
    <>
      {!session ? (
        <Login />
      ) : (
        <MainLayout
          onNewChat={handleNewChat}
          onLogout={handleLogout}
          sessions={sessions}
          onLoadSession={handleLoadSession}
        >
          <ChatInterface
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            onStartQuiz={handleStartQuiz}
            onStopGenerating={stopGenerating}
          />
        </MainLayout>
      )}
    </>
  );
}

export default App;
