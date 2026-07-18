import { useState, useCallback } from "react";
import { parseAIResponse, streamingVisibleText } from "../utils/aiParser";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

export function useChat({
  selectedModel,
  getCustomModelConfig,
  fetchSessions,
  saveSessionToDb,
  currentSessionId,
  setCurrentSessionId,
  sessions,
  setSaveStatus,
}) {
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [abortController, setAbortController] = useState(null);
  const [view, setView] = useState("chat");
  const [quizData, setQuizData] = useState(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizParams, setQuizParams] = useState({
    itemCount: 5,
    difficulty: "Normal",
  });
  const [wrongAnswers, setWrongAnswers] = useState([]);

  const startQuiz = useCallback(
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

      setWrongAnswers([]);

      const controller = new AbortController();
      setAbortController(controller);

      try {
        const response = await fetch(`${API_BASE_URL}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
          { role: "user", parts: [{ text: prompt }] },
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
          // User cancelled — silently handled
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
      history,
      sessions,
      currentSessionId,
      saveSessionToDb,
      selectedModel,
      getCustomModelConfig,
      setSaveStatus,
      quizParams,
    ],
  );

  const sendMessage = useCallback(
    async (text) => {
      setView("chat");
      let sessionId = currentSessionId;

      const userMsg = { role: "user", text: text, type: "text" };
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
            setCurrentSessionId(sessionId);
            await fetchSessions();
          } catch (error) {
            console.error("Error creating initial session:", error);
          }
        }

        // STREAMING PATH
        const token = document.cookie
          .split("; ")
          .find((row) => row.startsWith("token="))
          ?.split("=")[1];

        const response = await fetch(
          `${API_BASE_URL}/chat/stream?token=${encodeURIComponent(token || "")}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            signal: controller.signal,
            body: JSON.stringify({
              message: text,
              history: history,
              model: selectedModel,
              customModelConfig: getCustomModelConfig(selectedModel),
            }),
          },
        );

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || `Server responded with ${response.status}`);
        }

        // Create placeholder streaming message
        setMessages((prev) => [
          ...prev,
          { role: "model", text: "", type: "text", isStreaming: true },
        ]);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          accumulatedText += chunk;

          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              text: streamingVisibleText(accumulatedText),
              isStreaming: true,
            };
            return updated;
          });
        }

        // Stream ended — parse full response
        const { title, thought, final, fallbackTitle, structured } =
          parseAIResponse(accumulatedText);
        const displayText = structured.text || final;

        if (structured.type === "quiz") {
          setMessages((prev) => prev.slice(0, -1));
          setQuizData(structured);
          setView("quiz");

          const updatedHistory = [
            ...history,
            { role: "user", parts: [{ text }] },
            { role: "model", parts: [{ text: accumulatedText }] },
          ];
          setHistory(updatedHistory);

          const existingQuizSession = currentSessionId
            ? sessions.find((s) => s.id === currentSessionId)
            : null;
          const hasRealQuizTitle = existingQuizSession &&
            existingQuizSession.topic &&
            existingQuizSession.topic !== "New Chat";

          const topic = !currentSessionId
            ? title ||
              fallbackTitle ||
              (text.length > 30 ? text.substring(0, 30) + "..." : text)
            : hasRealQuizTitle
              ? existingQuizSession.topic
              : title || existingQuizSession?.topic || "Chat";

          saveSessionToDb(updatedHistory, topic, sessionId).catch(() => {
            setSaveStatus("error");
          });
          return;
        }

        // Finalize the streaming message
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "model",
            raw: accumulatedText,
            text: displayText,
            thought: thought,
            isStreaming: false,
            ...structured,
          };
          return updated;
        });

        const updatedHistory = [
          ...history,
          { role: "user", parts: [{ text }] },
          { role: "model", parts: [{ text: accumulatedText }] },
        ];
        setHistory(updatedHistory);

        const existingChatSession = currentSessionId
          ? sessions.find((s) => s.id === currentSessionId)
          : null;
        const hasRealChatTitle = existingChatSession &&
          existingChatSession.topic &&
          existingChatSession.topic !== "New Chat";

        const topic = !currentSessionId
          ? title ||
            fallbackTitle ||
            (text.length > 30 ? text.substring(0, 30) + "..." : text)
          : hasRealChatTitle
            ? existingChatSession.topic
            : title || existingChatSession?.topic || "Chat";

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
      history,
      sessions,
      currentSessionId,
      saveSessionToDb,
      fetchSessions,
      setCurrentSessionId,
      selectedModel,
      startQuiz,
      getCustomModelConfig,
      setSaveStatus,
    ],
  );

  const stopGenerating = useCallback(() => {
    if (abortController) {
      abortController.abort();
      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.isStreaming) {
          updated[updated.length - 1] = { ...last, isStreaming: false };
        }
        return updated;
      });
      setIsLoading(false);
      setAbortController(null);
    }
  }, [abortController, setMessages]);

  const newChat = useCallback(() => {
    setMessages([]);
    setHistory([]);
    setCurrentSessionId(null);
    setView("chat");
  }, [setCurrentSessionId]);

  const resetToChat = useCallback(() => {
    setView("chat");
    setQuizData(null);
    setQuizScore(0);
    setQuizParams({ itemCount: 5, difficulty: "Normal" });
    setWrongAnswers([]);
  }, []);

  const quizAnswer = useCallback(
    async (option) => {
      setIsLoading(true);

      try {
        const response = await fetch(`${API_BASE_URL}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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

        const updatedHistory = [
          ...history,
          { role: "user", parts: [{ text: option }] },
          { role: "model", parts: [{ text: rawResponse }] },
        ];
        setHistory(updatedHistory);

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
      history,
      sessions,
      currentSessionId,
      saveSessionToDb,
      selectedModel,
      getCustomModelConfig,
      quizData,
      setSaveStatus,
    ],
  );

  const loadSessionData = useCallback((session) => {
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
  }, []);

  const reset = useCallback(() => {
    setMessages([]);
    setHistory([]);
    setView("chat");
    setQuizData(null);
    setQuizScore(0);
    setQuizParams({ itemCount: 5, difficulty: "Normal" });
    setWrongAnswers([]);
  }, []);

  return {
    messages,
    history,
    isLoading,
    view,
    setView,
    quizData,
    quizScore,
    quizParams,
    wrongAnswers,
    sendMessage,
    startQuiz,
    quizAnswer,
    stopGenerating,
    newChat,
    resetToChat,
    loadSessionData,
    reset,
  };
}
