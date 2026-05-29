import React, { useState, useEffect, useCallback } from 'react';
import MainLayout from './components/MainLayout';
import ChatInterface from './components/ChatInterface';
import Login from './components/Login';
import { supabase } from './supabaseClient';

const API_BASE_URL = '/api';

function App() {
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [abortController, setAbortController] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
        // We call fetchSessions directly here to avoid dependency issues
        try {
          const { data, error } = await supabase
            .from('chat_sessions')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false });
          if (!error) setSessions(data || []);
        } catch (e) {
          console.error('Auth change session fetch error:', e);
        }
      } else {
        setSessions([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchSessions = useCallback(async (userId) => {
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
  }, []);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const saveSessionToDb = useCallback(async (updatedHistory, topic) => {
    if (!session) return;

    try {
      if (currentSessionId) {
        await supabase
          .from('chat_sessions')
          .update({ history: updatedHistory, topic })
          .eq('id', currentSessionId);
      } else {
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
        await fetchSessions(session.user.id);
      }
    } catch (error) {
      console.error('Error saving session:', error);
    }
  }, [session, currentSessionId, fetchSessions]);

  const handleSendMessage = useCallback(async (text) => {
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

      // Immediately stop loading after the response is received and added to UI
      setIsLoading(false);
      setAbortController(null);

      const updatedHistory = [
        ...history,
        { role: 'user', parts: [{ text }] },
        { role: 'model', parts: [{ text: JSON.stringify(data) }] },
      ];
      setHistory(updatedHistory);
      
      const topic = messages.length === 0 ? text : sessions.find(s => s.id === currentSessionId)?.topic || 'Chat';
      // Save to DB in the background without blocking the UI
      saveSessionToDb(updatedHistory, topic).catch(e => console.error('Background save failed:', e));
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
  }, [session, history, messages, sessions, currentSessionId, saveSessionToDb]);

  const handleStartQuiz = useCallback(async () => {
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

      // Immediately stop loading
      setIsLoading(false);
      setAbortController(null);

      const updatedHistory = [
        ...history,
        { role: 'user', parts: [{ text: 'Start a mock quiz based on the notes provided above.' }] },
        { role: 'model', parts: [{ text: JSON.stringify(data) }] },
      ];
      setHistory(updatedHistory);
      
      const topic = sessions.find(s => s.id === currentSessionId)?.topic || 'Quiz Session';
      // Save to DB in the background
      saveSessionToDb(updatedHistory, topic).catch(e => console.error('Background save failed:', e));
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
  }, [session, history, sessions, currentSessionId, saveSessionToDb]);

  const stopGenerating = useCallback(() => {
    if (abortController) {
      abortController.abort();
      setIsLoading(false);
      setAbortController(null);
    }
  }, [abortController]);

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setHistory([]);
    setCurrentSessionId(null);
  }, []);

  const handleLoadSession = useCallback(async (sessionId) => {
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) throw error;

      setCurrentSessionId(sessionId);
      setHistory(data.history);
      
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
  }, []);

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
