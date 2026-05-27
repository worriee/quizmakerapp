import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleSendMessage = async (text) => {
    // Add user message to UI
    const userMsg = { role: 'user', text, type: 'text' };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          message: text,
          history: history,
        }),
      });
      
      const data = await response.json();
      
      // Add AI response to UI
      setMessages(prev => [...prev, { 
        role: 'model', 
        ...data 
      }]);

      // Update history for the AI SDK
      setHistory(prev => [
        ...prev,
        { role: 'user', parts: [{ text }] },
        { role: 'model', parts: [{ text: JSON.stringify(data) }] },
      ]);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, { 
        role: 'model', 
        text: 'Sorry, I encountered an error. Please make sure the server is running.', 
        type: 'text' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartQuiz = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          message: 'Now, start a mock quiz based on the notes provided above.',
          history: history
        }),
      });
      
      const data = await response.json();
      
      setMessages(prev => [...prev, { 
        role: 'model', 
        ...data 
      }]);

      setHistory(prev => [
        ...prev,
        { role: 'user', parts: [{ text: 'Start a mock quiz based on the notes provided above.' }] },
        { role: 'model', parts: [{ text: JSON.stringify(data) }] },
      ]);
    } catch (error) {
      console.error('Error starting quiz:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setHistory([]);
  };

  return (
    <>
      {!session ? (
        <Login />
      ) : (
        <MainLayout onNewChat={handleNewChat} onLogout={handleLogout}>
          <ChatInterface
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            onStartQuiz={handleStartQuiz}
          />
        </MainLayout>
      )}
    </>
  );
}

export default App;
