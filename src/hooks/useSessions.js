import { useState, useCallback } from "react";

const API_BASE_URL = "/api";
const SESSION_STORAGE_KEY = "quizmaker_current_session_id";
const SESSIONS_CACHE_KEY = "quizmaker_sessions_cache";

export function useSessions() {
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
  const [currentSessionId, setCurrentSessionIdState] = useState(null);
  const [saveStatus, setSaveStatus] = useState("synced");

  const setCurrentSessionId = useCallback((id) => {
    setCurrentSessionIdState(id);
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

  const saveSessionToDb = useCallback(
    async (updatedHistory, topic, sessionId) => {
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
          setCurrentSessionId(session.id);
          await fetchSessions();
        }
        setSaveStatus("synced");
      } catch (error) {
        console.error("Error saving session:", error);
        setSaveStatus("error");
      }
    },
    [currentSessionId, fetchSessions, setCurrentSessionId],
  );

  const loadSession = useCallback(
    async (sessionId) => {
      try {
        const response = await fetch(`${API_BASE_URL}/session/${sessionId}`, {
          method: "GET",
          credentials: "include",
        });
        if (!response.ok) throw new Error("Failed to load session");
        const { session } = await response.json();
        setCurrentSessionId(sessionId);
        return session;
      } catch (error) {
        console.error("Error loading session:", error);
        return null;
      }
    },
    [setCurrentSessionId],
  );

  const deleteSession = useCallback(
    async (sessionId, onActiveDeleted) => {
      try {
        const response = await fetch(`${API_BASE_URL}/session/${sessionId}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!response.ok) throw new Error("Failed to delete session");

        if (currentSessionId === sessionId && onActiveDeleted) {
          onActiveDeleted();
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
    [currentSessionId],
  );

  const renameSession = useCallback(async (sessionId, newTitle) => {
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

  const togglePin = useCallback(async (sessionId, currentPinStatus) => {
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

  const searchSessions = useCallback(async (query) => {
    if (!query || query.trim().length < 2) {
      return { titleMatches: [], contentMatches: [] };
    }
    try {
      const response = await fetch(
        `${API_BASE_URL}/sessions/search?q=${encodeURIComponent(query.trim())}`,
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Search failed");
      return await response.json();
    } catch (error) {
      console.error("Error searching sessions:", error);
      return { titleMatches: [], contentMatches: [] };
    }
  }, []);

  const reset = useCallback(() => {
    setSessions([]);
    localStorage.removeItem(SESSIONS_CACHE_KEY);
    setCurrentSessionIdState(null);
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setSaveStatus("synced");
  }, []);

  return {
    sessions,
    currentSessionId,
    setCurrentSessionId,
    saveStatus,
    setSaveStatus,
    fetchSessions,
    saveSessionToDb,
    loadSession,
    deleteSession,
    renameSession,
    togglePin,
    searchSessions,
    reset,
  };
}
