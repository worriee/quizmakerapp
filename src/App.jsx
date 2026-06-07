import React, { useState, useEffect, useCallback } from "react";
import MainLayout from "./components/MainLayout";
import ChatInterface from "./components/ChatInterface";
import Login from "./components/Login";
import QuizInterface from "./components/QuizInterface";
import QuizSummary from "./components/QuizSummary";
import { supabase } from "./supabaseClient";
import { parseAIResponse } from "./utils/aiParser";

const API_BASE_URL = "/api";
const SESSION_STORAGE_KEY = 'quizmaker_current_session_id';
const SESSIONS_CACHE_KEY = 'quizmaker_sessions_cache';

function App() {
  const [session, setSession] = useState(null);
  const [bootStatus, setBootStatus] = useState('INITIALIZING'); // 'INITIALIZING', 'AUTHENTICATING', 'READY', 'UNAUTHENTICATED'
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessions, setSessions] = useState(() => {
    const cached = localStorage.getItem(SESSIONS_CACHE_KEY);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.error("[Debug] Failed to parse sessions cache:", e);
        return [];
      }
    }
    return [];
  });
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [abortController, setAbortController] = useState(null);
  const isRestoringSessionRef = React.useRef(false);
  const [view, setView] = useState('chat'); // 'chat', 'quiz', 'summary'
  const [quizData, setQuizData] = useState(null);
  const [quizScore, setQuizScore] = useState(0);
  const [saveStatus, setSaveStatus] = useState('synced'); // 'synced', 'saving', 'error'

  const updateCurrentSessionId = useCallback((id) => {
    setCurrentSessionId(id);
    if (id) {
      localStorage.setItem(SESSION_STORAGE_KEY, id);
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, []);


  const fetchSessions = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from("chat_sessions")
        .select("*")
        .eq("user_id", userId);

      if (error) throw error;

      const sortedData = (data || []).sort((a, b) => {
        if (a.pinned !== b.pinned) {
          return b.pinned ? 1 : -1;
        }
        return new Date(b.created_at) - new Date(a.created_at);
      });

      setSessions(sortedData);
      localStorage.setItem(SESSIONS_CACHE_KEY, JSON.stringify(sortedData));
    } catch (error) {
      console.error("Error fetching sessions:", error);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    await supabase.auth.signOut();
  }, []);

  const saveSessionToDb = useCallback(
    async (updatedHistory, topic, sessionId) => {
      if (!session) {
        console.warn("[Debug] saveSessionToDb called without session");
        return;
      }

      setSaveStatus('saving');
      try {
        const targetId = sessionId || currentSessionId;
        if (targetId) {
          await supabase
            .from("chat_sessions")
            .update({ history: updatedHistory, topic })
            .eq("id", targetId);
          await fetchSessions(session.user.id);
        } else {
          const { data, error } = await supabase
            .from("chat_sessions")
            .insert([
              {
                user_id: session.user.id,
                topic: topic || "New Chat",
                history: updatedHistory,
              },
            ])
            .select();
          
          if (error) throw error;
          updateCurrentSessionId(data[0].id);
          await fetchSessions(session.user.id);
        }
        setSaveStatus('synced');
      } catch (error) {
        console.error("Error saving session:", error);
        setSaveStatus('error');
      }
    },
    [session, currentSessionId, fetchSessions],
  );

  const handleSendMessage = useCallback(
    async (text) => {
      // Ensure we are in chat view when sending messages
      setView('chat');
      
      let sessionId = currentSessionId;

      const userMsg = {
        role: "user",
        text: text,
        type: "text",
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      const controller = new AbortController();
      setAbortController(controller);

      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 45000);

      try {
        let currentSession = session;

        if (!currentSession) {
          const getSessionWithTimeout = async (timeoutMs = 5000) => {
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error("SUPABASE_SESSION_TIMEOUT")), timeoutMs)
            );
            return Promise.race([
              supabase.auth.getSession(),
              timeoutPromise
            ]);
          };

          try {
            const { data: { session: fetchedSession } } = await getSessionWithTimeout();
            currentSession = fetchedSession;
          } catch (e) {
            console.error("Session retrieval failed or timed out:", e);
            throw e;
          }
        }

        if (!currentSession) {
          throw new Error("Your session has expired. Please log in again.");
        }

        // Create session immediately if this is a new chat
        if (!sessionId) {
          const initialTopic = text.length > 30 ? text.substring(0, 30) + "..." : text;
          const { data: sessionData, error: sessionError } = await supabase
            .from("chat_sessions")
            .insert([
              {
                user_id: currentSession.user.id,
                topic: initialTopic,
                history: [],
              },
            ])
            .select();

          if (sessionError) {
            console.error("Error creating initial session:", sessionError);
          } else if (sessionData && sessionData.length > 0) {
            sessionId = sessionData[0].id;
            updateCurrentSessionId(sessionId);
            await fetchSessions(currentSession.user.id);
          }
        }

        const response = await fetch(`${API_BASE_URL}/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentSession.access_token}`,
          },
          signal: controller.signal,
          body: JSON.stringify({
            message: text,
            history: history,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Server Error ${response.status}:`, errorText);
          let errorMsg = `Server responded with ${response.status}`;
          try {
            const errorData = JSON.parse(errorText);
            errorMsg = errorData.error || errorMsg;
          } catch (e) {}
          throw new Error(errorMsg);
        }

        const data = await response.json();
        const rawResponse = data.raw || "";

        // Use centralized parser for consistent results
        const { title, thought, final, structured } = parseAIResponse(rawResponse);
        const displayText = structured.text || final;

        setMessages((prev) => [
          ...prev,
          {
            role: "model",
            raw: rawResponse,
            text: structured.text || displayText,
            thought: thought,
            ...structured,
            ...data,
          },
        ]);

        const updatedHistory = [
          ...history,
          { role: "user", parts: [{ text }] },
          { role: "model", parts: [{ text: rawResponse }] },
        ];
        setHistory(updatedHistory);

        const topic =
          !currentSessionId
            ? (title || (text.length > 30 ? text.substring(0, 30) + "..." : text))
            : sessions.find((s) => s.id === currentSessionId)?.topic || "Chat";
        
        // Save to DB in the background without blocking the UI
        saveSessionToDb(updatedHistory, topic, sessionId).catch((e) => {
          console.error("[Debug] Background save failed:", e);
          setSaveStatus('error');
        });
      } catch (error) {
        if (error.name === "AbortError") {
          console.log("Request aborted by user");
        } else {
          console.error("Error sending message:", error);
          setMessages((prev) => [
            ...prev,
            {
              role: "model",
              text: `Error: ${error.message}`,
              type: "text",
            },
          ]);
        }
      } finally {
        setIsLoading(false);
        setAbortController(null);
      }
    },
    [session, history, messages, sessions, currentSessionId, saveSessionToDb],
  );

  const handleStartQuiz = useCallback(async () => {
    setIsLoading(true);

    const controller = new AbortController();
    setAbortController(controller);

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 45000);

    try {
      let currentSession = session;

      if (!currentSession) {
        const getSessionWithTimeout = async (timeoutMs = 5000) => {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("SUPABASE_SESSION_TIMEOUT")), timeoutMs)
          );
          return Promise.race([
            supabase.auth.getSession(),
            timeoutPromise
          ]);
        };

        try {
          const { data: { session: fetchedSession } } = await getSessionWithTimeout();
          currentSession = fetchedSession;
        } catch (e) {
          console.error("Session retrieval failed in handleStartQuiz:", e);
          throw e;
        }
      }

      if (!currentSession) {
        const { data: recovery } = await supabase.auth.getSession();
        currentSession = recovery?.session;
      }

      if (!currentSession) {
        setSession(null);
        throw new Error("Your session has expired. Please log in again.");
      }

      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentSession.access_token}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          message: "Now, start a mock quiz based on the notes provided above.",
          history: history,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Server responded with ${response.status}`,
        );
      }

      const data = await response.json();
      const rawResponse = data.raw || "";

      // Use centralized parser for consistent results
      const { thought, final, structured } = parseAIResponse(rawResponse);
      const displayText = structured.text || final;

      if (structured.type === "quiz") {
        setQuizData(structured);
        setView('quiz');
        setQuizScore(0);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "model",
            raw: rawResponse,
            text: structured.text || displayText,
            thought: thought,
            ...structured,
            ...data,
          },
        ]);
      }

      // Immediately stop loading
      setIsLoading(false);
      setAbortController(null);

      const updatedHistory = [
        ...history,
        {
          role: "user",
          parts: [
            { text: "Start a mock quiz based on the notes provided above." },
          ],
        },
        { role: "model", parts: [{ text: rawResponse }] },
      ];
      setHistory(updatedHistory);

      const topic =
        sessions.find((s) => s.id === currentSessionId)?.topic ||
        "Quiz Session";
      // Save to DB in the background
      saveSessionToDb(updatedHistory, topic, currentSessionId).catch((e) => {
        console.error("Background save failed:", e);
        setSaveStatus('error');
      });
    } catch (error) {
      if (error.name === "AbortError") {
        console.log("Request aborted by user");
      } else {
        console.error("Error starting quiz:", error);
        setMessages((prev) => [
          ...prev,
          {
            role: "model",
            text: `Error: ${error.message}`,
            type: "text",
          },
        ]);
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
    updateCurrentSessionId(null);
    setView('chat');
  }, [updateCurrentSessionId]);

  const handleLoadSession = useCallback(async (sessionId, providedSession = null) => {
    try {
      // Auth Guard: Verify current authentication state
      let authSession = providedSession;
      if (!authSession) {
        const { data: { session: fetchedSession } } = await supabase.auth.getSession();
        authSession = fetchedSession;
      }
      
      if (!authSession) {
        console.warn("No active session found during load. Redirecting to login.");
        setSession(null);
        return;
      }

      const { data, error } = await supabase
        .from("chat_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (error) throw error;

      updateCurrentSessionId(sessionId);
      const historyData = data.history || [];
      setHistory(historyData);
      setView('chat');

      const loadedMessages = historyData.map((item) => {
        if (item.role === "model") {
          const { thought, final, structured } = parseAIResponse(item.parts[0].text);
          return {
            role: "model",
            raw: item.parts[0].text,
            text: structured.text || final,
            thought: thought,
            ...structured,
          };
        }
        return { role: "user", text: item.parts[0].text, type: "text" };
      });

      setMessages(loadedMessages);
    } catch (error) {
      console.error("Error loading session:", error);
      // Avoid logging user out on every load error; only if it's an auth error
      if (error.message?.includes("auth") || error.status === 401) {
        setSession(null);
      }
    }
  }, [updateCurrentSessionId]);

  const handleDeleteSession = useCallback(async (sessionId) => {
    try {
      const { error } = await supabase
        .from("chat_sessions")
        .delete()
        .eq("id", sessionId);

      if (error) throw error;

      if (currentSessionId === sessionId) {
        handleNewChat();
      }

      setSessions((prev) => {
        const filtered = prev.filter((s) => s.id !== sessionId);
        localStorage.setItem(SESSIONS_CACHE_KEY, JSON.stringify(filtered));
        return filtered;
      });
    } catch (error) {
      console.error("Error deleting session:", error);
    }
  }, [currentSessionId, handleNewChat]);

  const handleRenameSession = useCallback(async (sessionId, newTitle) => {
    try {
      const { error } = await supabase
        .from("chat_sessions")
        .update({ topic: newTitle })
        .eq("id", sessionId);

      if (error) throw error;

      setSessions((prev) => {
        const updated = prev.map((s) => (s.id === sessionId ? { ...s, topic: newTitle } : s));
        localStorage.setItem(SESSIONS_CACHE_KEY, JSON.stringify(updated));
        return updated;
      });
    } catch (error) {
      console.error("Error renaming session:", error);
    }
  }, []);

  const handleTogglePin = useCallback(async (sessionId, currentPinStatus) => {
    try {
      const { error } = await supabase
        .from("chat_sessions")
        .update({ pinned: !currentPinStatus })
        .eq("id", sessionId);

      if (error) throw error;

      setSessions((prev) => {
        const updated = prev.map((s) => (s.id === sessionId ? { ...s, pinned: !currentPinStatus } : s));
        localStorage.setItem(SESSIONS_CACHE_KEY, JSON.stringify(updated));
        return updated;
      });
    } catch (error) {
      console.error("Error toggling pin:", error);
    }
  }, []);

  const handleQuizAnswer = useCallback(async (option) => {
    setIsLoading(true);
    
    try {
      // Send the answer to the AI to get feedback and the next question
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          message: option,
          history: history,
        }),
      });

      if (!response.ok) throw new Error("Failed to get quiz feedback");

      const data = await response.json();
      const { structured } = parseAIResponse(data.raw || "");

      if (structured.type === "quiz") {
        if (structured.feedback?.isCorrect) {
          setQuizScore((prev) => prev + 1);
        }
        
        if (structured.isFinished) {
          setView('summary');
        } else {
          setQuizData(structured);
        }
      }
    } catch (error) {
      console.error("Error handling quiz answer:", error);
    } finally {
      setIsLoading(false);
    }
  }, [session, history]);

  useEffect(() => {
    let isSubscribed = true;

    const bootSequence = async () => {
      try {
        // 1. Auth Resolution
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (!initialSession) {
          if (isSubscribed) setBootStatus('UNAUTHENTICATED');
          return;
        }

        if (isSubscribed) {
          setSession(initialSession);
          setBootStatus('AUTHENTICATING');
        }

        // 2. Context Restoration (Parallel)
        await Promise.all([
          fetchSessions(initialSession.user.id),
          (async () => {
            const savedSessionId = localStorage.getItem(SESSION_STORAGE_KEY);
            if (savedSessionId) {
              await handleLoadSession(savedSessionId, initialSession);
            }
          })()
        ]);

        if (isSubscribed) setBootStatus('READY');
      } catch (error) {
        console.error("Boot sequence failed:", error);
        if (isSubscribed) setBootStatus('UNAUTHENTICATED');
      }
    };

    bootSequence();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isSubscribed) return;
      
      // Only allow auth listener to affect state after the boot sequence is READY
      if (bootStatus !== 'READY') return;
      
      setSession(session);
      
      if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        try {
          await fetchSessions(session.user.id);
        } catch (e) {
          console.error("Auth change session fetch error:", e);
        }
      } else if (!session) {
        setSessions([]);
        updateCurrentSessionId(null);
      }
    });

    return () => {
      isSubscribed = false;
      subscription.unsubscribe();
    };
  }, [handleLoadSession, fetchSessions, updateCurrentSessionId]);

  return (
    <>
      {bootStatus === 'INITIALIZING' || bootStatus === 'AUTHENTICATING' ? (
        <div className="flex items-center justify-center h-screen w-full bg-slate-900 text-white">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-lg font-medium">Preparing your workspace...</p>
          </div>
        </div>
      ) : !session ? (
        <Login />
      ) : (
        <MainLayout
          user={session?.user}
          onNewChat={handleNewChat}
          onLogout={handleLogout}
          sessions={sessions}
          onLoadSession={handleLoadSession}
          currentSessionId={currentSessionId}
          onDeleteSession={handleDeleteSession}
          onRenameSession={handleRenameSession}
          onTogglePin={handleTogglePin}
          saveStatus={saveStatus}
          onRetrySave={() => {
            const currentTopic = sessions.find(s => s.id === currentSessionId)?.topic || "Chat";
            saveSessionToDb(history, currentTopic, currentSessionId);
          }}
        >
          {view === 'chat' && (
            <ChatInterface
              messages={messages}
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              onStartQuiz={handleStartQuiz}
              onStopGenerating={stopGenerating}
            />
          )}
          {view === 'quiz' && (
            <QuizInterface 
              quizData={quizData} 
              onAnswer={handleQuizAnswer} 
              onExit={() => setView('chat')} 
            />
          )}
          {view === 'summary' && (
            <QuizSummary 
              summary={quizData?.summary} 
              score={quizScore} 
              total={quizData?.progress?.total} 
              onReset={handleNewChat} 
            />
          )}
        </MainLayout>
      )}
    </>
  );
}

export default App;
