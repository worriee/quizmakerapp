import { useState, useEffect, useCallback } from "react";
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
  const [user, setUser] = useState(null);
  const [bootStatus, setBootStatus] = useState('INITIALIZING');
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
  const [view, setView] = useState('chat');
  const [quizData, setQuizData] = useState(null);
  const [quizScore, setQuizScore] = useState(0);
  const [saveStatus, setSaveStatus] = useState('synced');

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
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      setUser(null);
      setSessions([]);
      updateCurrentSessionId(null);
      setMessages([]);
      setHistory([]);
      setBootStatus('UNAUTHENTICATED');
    }
  }, [updateCurrentSessionId]);

  const saveSessionToDb = useCallback(
    async (updatedHistory, topic, sessionId) => {
      if (!user) {
        console.warn("[Debug] saveSessionToDb called without user");
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
          await fetchSessions(user.id);
        } else {
          const { data, error } = await supabase
            .from("chat_sessions")
            .insert([
              {
                user_id: user.id,
                topic: topic || "New Chat",
                history: updatedHistory,
              },
            ])
            .select();
          
          if (error) throw error;
          updateCurrentSessionId(data[0].id);
          await fetchSessions(user.id);
        }
        setSaveStatus('synced');
      } catch (error) {
        console.error("Error saving session:", error);
        setSaveStatus('error');
      }
    },
    [user, currentSessionId, fetchSessions, updateCurrentSessionId],
  );

  const handleSendMessage = useCallback(
    async (text) => {
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

      try {
        if (!sessionId) {
          const initialTopic = text.length > 30 ? text.substring(0, 30) + "..." : text;
          const { data: sessionData, error: sessionError } = await supabase
            .from("chat_sessions")
            .insert([
              {
                user_id: user.id,
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
            await fetchSessions(user.id);
          }
        }

        const response = await fetch(`${API_BASE_URL}/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: 'include',
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
          const errorData = JSON.parse(errorText);
          errorMsg = errorData.error || errorMsg;
          throw new Error(errorMsg);
        }

        const data = await response.json();
        const rawResponse = data.raw || "";

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
    [user, history, sessions, currentSessionId, saveSessionToDb, fetchSessions, updateCurrentSessionId],
  );

  const handleStartQuiz = useCallback(async () => {
    setIsLoading(true);

    const controller = new AbortController();
    setAbortController(controller);

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: 'include',
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
  }, [user, history, sessions, currentSessionId, saveSessionToDb]);

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

  const handleLoadSession = useCallback(async (sessionId) => {
    try {
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
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: 'include',
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
  }, [user, history]);

  useEffect(() => {
    let isSubscribed = true;

    const withTimeout = (promise, ms, taskName) => {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${taskName} timed out after ${ms}ms`)), ms)
      );
      return Promise.race([promise, timeout]);
    };

    const bootSequence = async () => {
      try {
        // 1. Auth Resolution via custom endpoint (with 5s timeout)
        const response = await withTimeout(
          fetch(`${API_BASE_URL}/auth/me`, {
            method: 'GET',
            credentials: 'include',
          }),
          5000,
          "Auth session check"
        );

        if (!response.ok) {
          if (isSubscribed) setBootStatus('UNAUTHENTICATED');
          return;
        }

        const data = await response.json();

        if (!isSubscribed) return;

        setUser(data.user);
        setBootStatus('AUTHENTICATING');

        // 2. Context Restoration
        await Promise.all([
          withTimeout(fetchSessions(data.user.id), 7000, "Fetch sessions")
            .catch(e => console.warn("[Boot] fetchSessions failed/timed out, continuing...", e)),
          (async () => {
            const savedSessionId = localStorage.getItem(SESSION_STORAGE_KEY);
            if (savedSessionId) {
              try {
                await withTimeout(handleLoadSession(savedSessionId), 7000, "Load active session");
              } catch (e) {
                console.warn("[Boot] handleLoadSession failed/timed out, continuing...", e);
              }
            }
          })()
        ]);

        if (isSubscribed) setBootStatus('READY');
      } catch (error) {
        console.error("Critical boot sequence failure:", error);
        if (isSubscribed) {
          setBootStatus('UNAUTHENTICATED');
        }
      }
    };

    // Global watchdog
    const bootWatchdog = setTimeout(() => {
      if (isSubscribed && (bootStatus === 'INITIALIZING' || bootStatus === 'AUTHENTICATING')) {
        console.error("[Boot] Global watchdog triggered: boot sequence took too long. Forcing READY state.");
        setBootStatus('READY');
      }
    }, 15000);

    bootSequence();

    return () => {
      isSubscribed = false;
      clearTimeout(bootWatchdog);
    };
  }, [fetchSessions, handleLoadSession]);

  return (
    <>
      {bootStatus === 'INITIALIZING' || bootStatus === 'AUTHENTICATING' ? (
        <div className="flex items-center justify-center h-screen w-full bg-[#FCF6F5] text-[#7b9acc]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#7b9acc] mx-auto mb-4"></div>
            <p className="text-xl font-bold text-[#7b9acc]">Preparing TUON AI</p>
          </div>
        </div>
      ) : !user ? (
        <Login />
      ) : (
        <MainLayout
          user={user}
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
