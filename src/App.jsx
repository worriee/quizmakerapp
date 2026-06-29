import { useState, useEffect, useCallback, useRef } from "react";
import MainLayout from "./components/MainLayout";
import ChatInterface from "./components/ChatInterface";
import Login from "./components/Login";
import QuizInterface from "./components/QuizInterface";
import QuizSummary from "./components/QuizSummary";
import QuizSetup from "./components/QuizSetup";
import { parseAIResponse } from "./utils/aiParser";
import {
  loadCustomModels,
  saveCustomModel,
  deleteCustomModel,
} from "./utils/customModelStorage";

const API_BASE_URL = "/api";
const SESSION_STORAGE_KEY = "quizmaker_current_session_id";
const SESSIONS_CACHE_KEY = "quizmaker_sessions_cache";
const MODEL_STORAGE_KEY = "quizmaker_selected_model";
const DEFAULT_MODEL = "gemini-3.1-flash-lite";

function App() {
  const [user, setUser] = useState(null);
  const [bootStatus, setBootStatus] = useState("INITIALIZING");
  const bootStatusRef = useRef("INITIALIZING");

  const updateBootStatus = useCallback((status) => {
    setBootStatus(status);
    bootStatusRef.current = status;
  }, []);

  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessions, setSessions] = useState(() => {
    const cached = localStorage.getItem(SESSIONS_CACHE_KEY);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.error("Failed to parse sessions cache:", e);
        return [];
      }
    }
    return [];
  });
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [abortController, setAbortController] = useState(null);
  const [view, setView] = useState("chat");
  const [quizData, setQuizData] = useState(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizParams, setQuizParams] = useState({
    itemCount: 5,
    difficulty: "Normal",
  });
  const [wrongAnswers, setWrongAnswers] = useState([]);
  const [saveStatus, setSaveStatus] = useState("synced");
  const [selectedModel, setSelectedModel] = useState(() => {
    const saved = localStorage.getItem(MODEL_STORAGE_KEY);
    return saved || DEFAULT_MODEL;
  });
  const [customModels, setCustomModels] = useState(() => loadCustomModels());

  const handleSetSelectedModel = useCallback((model) => {
    setSelectedModel(model);
    localStorage.setItem(MODEL_STORAGE_KEY, model);
  }, []);

  const handleSaveCustomModel = useCallback((modelConfig) => {
    const savedModel = saveCustomModel(modelConfig);
    setCustomModels(loadCustomModels());
    localStorage.setItem(MODEL_STORAGE_KEY, savedModel.id);
  }, []);

  const handleDeleteCustomModel = useCallback((modelId) => {
    deleteCustomModel(modelId);
    setCustomModels(loadCustomModels());
  }, []);

  const getCustomModelConfig = useCallback(
    (modelId) => {
      return customModels.find((m) => m.id === modelId) || null;
    },
    [customModels],
  );

  const updateCurrentSessionId = useCallback((id) => {
    setCurrentSessionId(id);
    if (id) {
      localStorage.setItem(SESSION_STORAGE_KEY, id);
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/sessions`, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 401) {
          setSessions([]);
          localStorage.removeItem(SESSIONS_CACHE_KEY);
          return;
        }
        throw new Error(`Failed to fetch sessions: ${response.status}`);
      }

      const { sessions } = await response.json();
      const sortedData = (sessions || []).sort((a, b) => {
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
        method: "POST",
        credentials: "include",
      });
    } catch (e) {
      console.error("Logout error:", e);
    } finally {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      setUser(null);
      setSessions([]);
      updateCurrentSessionId(null);
      setMessages([]);
      setHistory([]);
      setBootStatus("UNAUTHENTICATED");
    }
  }, [updateCurrentSessionId]);

  const saveSessionToDb = useCallback(
    async (updatedHistory, topic, sessionId) => {
      if (!user) {
        return;
      }

      setSaveStatus("saving");
      try {
        const targetId = sessionId || currentSessionId;
        if (targetId) {
          const response = await fetch(
            `${API_BASE_URL}/session/${targetId}/update`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ history: updatedHistory, topic }),
            },
          );
          if (!response.ok) throw new Error("Failed to update session");
          await fetchSessions();
        } else {
          const response = await fetch(`${API_BASE_URL}/session/create`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              topic: topic || "New Chat",
              history: updatedHistory,
            }),
          });
          if (!response.ok) throw new Error("Failed to create session");
          const { session } = await response.json();
          updateCurrentSessionId(session.id);
          await fetchSessions();
        }
        setSaveStatus("synced");
      } catch (error) {
        console.error("Error saving session:", error);
        setSaveStatus("error");
      }
    },
    [user, currentSessionId, fetchSessions, updateCurrentSessionId],
  );

  const handleStartQuiz = useCallback(
    async (
      params = null,
      overrideSessionId = null,
      initialHistoryEntries = [],
      overrideTopic = null,
    ) => {
      setIsLoading(true);

      let finalParams = { ...quizParams };
      if (params) {
        finalParams = params;
        setQuizParams(params);
      }

      // Construct dynamic prompt
      const difficultyPrompts = {
        Easy: "Generate questions strictly based on the notes provided. Focus on recall and basic understanding.",
        Normal:
          "Generate a mix of direct note-based questions and situational application questions. Require the user to apply concepts to simple scenarios.",
        Hard: "Generate primarily situational and complex scenarios. Questions should require critical thinking and synthesis of multiple concepts from the notes.",
      };

      let prompt = `Now, start a mock quiz based on the notes provided above.
  Number of items: ${finalParams.itemCount}.
  Difficulty: ${finalParams.difficulty}.
  ${difficultyPrompts[finalParams.difficulty]}`;

      if (params?.growthAreas && params.growthAreas.length > 0) {
        const missed = params.growthAreas
          .map((a) => `Q: ${a.question} (Correct: ${a.correctOption})`)
          .join("\n");
        prompt += `\n\nFocus specifically on these weak points from the previous attempt:\n${missed}`;
      }

      setWrongAnswers([]); // Reset wrong answers for new quiz

      const controller = new AbortController();
      setAbortController(controller);

      try {
        const response = await fetch(`${API_BASE_URL}/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          signal: controller.signal,
          body: JSON.stringify({
            message: prompt,
            history: history,
            model: selectedModel,
            customModelConfig: getCustomModelConfig(selectedModel),
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
          setView("quiz");
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

        const baseHistory =
          initialHistoryEntries && initialHistoryEntries.length > 0
            ? initialHistoryEntries
            : history;
        const targetSessionId = overrideSessionId || currentSessionId;

        const updatedHistory = [
          ...baseHistory,
          {
            role: "user",
            parts: [{ text: prompt }],
          },
          { role: "model", parts: [{ text: rawResponse }] },
        ];
        setHistory(updatedHistory);

        const topic =
          overrideTopic ||
          sessions.find((s) => s.id === targetSessionId)?.topic ||
          "Quiz Session";
        saveSessionToDb(updatedHistory, topic, targetSessionId).catch(() => {
          setSaveStatus("error");
        });
      } catch (error) {
        if (error.name === "AbortError") {
          console.log("Request aborted by user");
        } else {
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
    [
      user,
      history,
      sessions,
      currentSessionId,
      saveSessionToDb,
      selectedModel,
      getCustomModelConfig,
    ],
  );

  const handleSendMessage = useCallback(
    async (text) => {
      setView("chat");
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
          const initialTopic =
            text.length > 30 ? text.substring(0, 30) + "..." : text;
          try {
            const response = await fetch(`${API_BASE_URL}/session/create`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ topic: initialTopic, history: [] }),
            });
            if (!response.ok) throw new Error("Failed to create session");
            const { session } = await response.json();
            sessionId = session.id;
            updateCurrentSessionId(sessionId);
            await fetchSessions();
          } catch (error) {
            console.error("Error creating initial session:", error);
          }
        }

        const response = await fetch(`${API_BASE_URL}/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          signal: controller.signal,
          body: JSON.stringify({
            message: text,
            history: history,
            model: selectedModel,
            customModelConfig: getCustomModelConfig(selectedModel),
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

        const { title, thought, final, fallbackTitle, structured } =
          parseAIResponse(rawResponse);
        const displayText = structured.text || final;

        if (structured.type === "quiz") {
          const updatedHistory = [
            ...history,
            { role: "user", parts: [{ text }] },
            { role: "model", parts: [{ text: rawResponse }] },
          ];
          setHistory(updatedHistory);

          const topic = !currentSessionId
            ? title ||
              fallbackTitle ||
              (text.length > 30 ? text.substring(0, 30) + "..." : text)
            : sessions.find((s) => s.id === currentSessionId)?.topic || "Chat";

          saveSessionToDb(updatedHistory, topic, sessionId).catch(() => {
            setSaveStatus("error");
          });

          setView("quiz");
          handleStartQuiz({ itemCount: 5, difficulty: "Normal" });
          return;
        }

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

        const topic = !currentSessionId
          ? title ||
            fallbackTitle ||
            (text.length > 30 ? text.substring(0, 30) + "..." : text)
          : sessions.find((s) => s.id === currentSessionId)?.topic || "Chat";

        saveSessionToDb(updatedHistory, topic, sessionId).catch(() => {
          setSaveStatus("error");
        });
      } catch (error) {
        if (error.name !== "AbortError") {
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
    [
      user,
      history,
      sessions,
      currentSessionId,
      saveSessionToDb,
      fetchSessions,
      updateCurrentSessionId,
      selectedModel,
      handleStartQuiz,
      getCustomModelConfig,
    ],
  );

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
    setView("chat");
  }, [updateCurrentSessionId]);

  const handleResetToChat = useCallback(() => {
    setView("chat");
    setQuizData(null);
    setQuizScore(0);
    setQuizParams({ itemCount: 5, difficulty: "Normal" });
    setWrongAnswers([]);
  }, []);

  const handleLoadSession = useCallback(
    async (sessionId) => {
      try {
        const response = await fetch(`${API_BASE_URL}/session/${sessionId}`, {
          method: "GET",
          credentials: "include",
        });
        if (!response.ok) throw new Error("Failed to load session");

        const { session } = await response.json();

        updateCurrentSessionId(sessionId);
        const historyData = session.history || [];
        setHistory(historyData);
        setView("chat");

        const loadedMessages = historyData.map((item) => {
          if (item.role === "model") {
            const { thought, final, structured } = parseAIResponse(
              item.parts[0].text,
            );
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
    },
    [updateCurrentSessionId],
  );

  const handleDeleteSession = useCallback(
    async (sessionId) => {
      try {
        const response = await fetch(`${API_BASE_URL}/session/${sessionId}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!response.ok) throw new Error("Failed to delete session");

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
    },
    [currentSessionId, handleNewChat],
  );

  const handleRenameSession = useCallback(async (sessionId, newTitle) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/session/${sessionId}/rename`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ topic: newTitle }),
        },
      );
      if (!response.ok) throw new Error("Failed to rename session");

      setSessions((prev) => {
        const updated = prev.map((s) =>
          s.id === sessionId ? { ...s, topic: newTitle } : s,
        );
        localStorage.setItem(SESSIONS_CACHE_KEY, JSON.stringify(updated));
        return updated;
      });
    } catch (error) {
      console.error("Error renaming session:", error);
    }
  }, []);

  const handleTogglePin = useCallback(async (sessionId, currentPinStatus) => {
    try {
      const response = await fetch(`${API_BASE_URL}/session/${sessionId}/pin`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to toggle pin");

      setSessions((prev) => {
        const updated = prev.map((s) =>
          s.id === sessionId ? { ...s, pinned: !currentPinStatus } : s,
        );
        localStorage.setItem(SESSIONS_CACHE_KEY, JSON.stringify(updated));
        return updated;
      });
    } catch (error) {
      console.error("Error toggling pin:", error);
    }
  }, []);

  const handleQuizAnswer = useCallback(
    async (option) => {
      setIsLoading(true);

      try {
        const response = await fetch(`${API_BASE_URL}/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            message: option,
            history: history,
            model: selectedModel,
            customModelConfig: getCustomModelConfig(selectedModel),
          }),
        });

        if (!response.ok) throw new Error("Failed to get quiz feedback");

        const data = await response.json();
        const rawResponse = data.raw || "";
        const { structured } = parseAIResponse(rawResponse);

        if (structured.type === "quiz") {
          if (structured.feedback?.isCorrect) {
            setQuizScore((prev) => prev + 1);
          } else if (structured.feedback) {
            // Track wrong answers for growth areas
            setWrongAnswers((prev) => [
              ...prev,
              {
                question: quizData?.text || "Unknown Question",
                correctOption:
                  structured.feedback.text || "No correct answer provided",
              },
            ]);
          }

          if (structured.isFinished) {
            setView("summary");
          } else {
            setQuizData(structured);
          }
        }

        // Update history to ensure AI progresses to the next question
        const updatedHistory = [
          ...history,
          { role: "user", parts: [{ text: option }] },
          { role: "model", parts: [{ text: rawResponse }] },
        ];
        setHistory(updatedHistory);

        // Persist progress to DB
        const topic =
          sessions.find((s) => s.id === currentSessionId)?.topic ||
          "Quiz Session";
        saveSessionToDb(updatedHistory, topic, currentSessionId).catch(() => {
          setSaveStatus("error");
        });
      } catch (error) {
        console.error("Error handling quiz answer:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [
      user,
      history,
      sessions,
      currentSessionId,
      saveSessionToDb,
      selectedModel,
      getCustomModelConfig,
    ],
  );

  useEffect(() => {
    let isSubscribed = true;

    const withTimeout = (promise, ms, taskName) => {
      const timeout = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`${taskName} timed out after ${ms}ms`)),
          ms,
        ),
      );
      return Promise.race([promise, timeout]);
    };

    const bootSequence = async () => {
      try {
        // 1. Auth Resolution via custom endpoint (with 5s timeout)
        const response = await withTimeout(
          fetch(`${API_BASE_URL}/auth/me`, {
            method: "GET",
            credentials: "include",
          }),
          5000,
          "Auth session check",
        );

        if (!response.ok) {
          if (isSubscribed) updateBootStatus("UNAUTHENTICATED");
          return;
        }

        const data = await response.json();
        if (!isSubscribed) return;

        setUser(data.user);
        updateBootStatus("AUTHENTICATING");

        // 2. Context Restoration
        await Promise.all([
          withTimeout(fetchSessions(), 7000, "Fetch sessions").catch((e) =>
            console.warn(
              "[Boot] fetchSessions failed/timed out, continuing...",
              e,
            ),
          ),
          (async () => {
            const savedSessionId = localStorage.getItem(SESSION_STORAGE_KEY);
            if (savedSessionId) {
              try {
                await withTimeout(
                  handleLoadSession(savedSessionId),
                  7000,
                  "Load active session",
                );
              } catch (e) {
                console.warn(
                  "[Boot] handleLoadSession failed/timed out, continuing...",
                  e,
                );
              }
            }
          })(),
        ]);

        if (isSubscribed) updateBootStatus("READY");
      } catch (error) {
        console.error("Critical boot sequence failure:", error);
        if (isSubscribed) {
          updateBootStatus("UNAUTHENTICATED");
        }
      }
    };

    // Global watchdog
    const bootWatchdog = setTimeout(() => {
      if (
        isSubscribed &&
        (bootStatusRef.current === "INITIALIZING" ||
          bootStatusRef.current === "AUTHENTICATING")
      ) {
        console.error(
          "[Boot] Global watchdog triggered: boot sequence took too long. Forcing READY state.",
        );
        updateBootStatus("READY");
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
      {bootStatus === "INITIALIZING" || bootStatus === "AUTHENTICATING" ? (
        <div className="flex items-center justify-center h-screen w-full bg-[#FCF6F5] text-[#7b9acc]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#7b9acc] mx-auto mb-4"></div>
            <p className="text-xl font-bold text-[#7b9acc]">
              Preparing TUON AI
            </p>
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
            const currentTopic =
              sessions.find((s) => s.id === currentSessionId)?.topic || "Chat";
            saveSessionToDb(history, currentTopic, currentSessionId);
          }}
          selectedModel={selectedModel}
          setSelectedModel={handleSetSelectedModel}
          customModels={customModels}
          onSaveCustomModel={handleSaveCustomModel}
          onDeleteCustomModel={handleDeleteCustomModel}
        >
          {view === "chat" && (
            <ChatInterface
              messages={messages}
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              onStartQuiz={() => {
                if (messages.length === 0) return;
                setView("quizSetup");
              }}
              onStopGenerating={stopGenerating}
            />
          )}
          {view === "quizSetup" && (
            <QuizSetup
              onStart={handleStartQuiz}
              onExit={() => setView("chat")}
            />
          )}
          {view === "quiz" && (
            <QuizInterface
              key={quizData?.progress?.current || 1}
              quizData={quizData}
              onAnswer={handleQuizAnswer}
              onExit={() => setView("chat")}
            />
          )}
          {view === "summary" && (
            <QuizSummary
              summary={quizData?.summary}
              score={quizScore}
              total={quizData?.progress?.total}
              onResetToChat={handleResetToChat}
              onGrowthRetry={() =>
                handleStartQuiz({ ...quizParams, growthAreas: wrongAnswers })
              }
              hasWrongAnswers={wrongAnswers.length > 0}
            />
          )}
        </MainLayout>
      )}
    </>
  );
}

export default App;
