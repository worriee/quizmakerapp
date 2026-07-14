import { useCallback } from "react";
import MainLayout from "./components/MainLayout";
import ChatInterface from "./components/ChatInterface";
import Login from "./components/Login";
import QuizInterface from "./components/QuizInterface";
import QuizSummary from "./components/QuizSummary";
import QuizSetup from "./components/QuizSetup";
import VerifyEmail from "./components/VerifyEmail";
import ForgotPassword from "./components/ForgotPassword";
import ResetPassword from "./components/ResetPassword";
import { useTheme } from "./hooks/useTheme";
import { useCustomModels } from "./hooks/useCustomModels";
import { useSessions } from "./hooks/useSessions";
import { useChat } from "./hooks/useChat";
import { useAuth } from "./hooks/useAuth";

function App() {
  // 1. Theme
  const { theme, toggleTheme } = useTheme();

  // 2. Custom Models
  const {
    selectedModel,
    setSelectedModel,
    customModels,
    addCustomModel,
    deleteCustomModel,
    getCustomModelConfig,
  } = useCustomModels();

  // 3. Sessions
  const {
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
    reset: resetSessions,
  } = useSessions();

  // 4. Chat (all messages, history, quiz state, and handlers)
  const {
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
    reset: resetChat,
  } = useChat({
    selectedModel,
    getCustomModelConfig,
    fetchSessions,
    saveSessionToDb,
    currentSessionId,
    setCurrentSessionId,
    sessions,
    setSaveStatus,
  });

  // 5. Restore active session (for boot + sidebar clicks)
  const restoreActiveSession = useCallback(
    async (sessionId) => {
      const savedId =
        sessionId || localStorage.getItem("quizmaker_current_session_id");
      if (!savedId) return;
      const session = await loadSession(savedId);
      if (session) loadSessionData(session);
    },
    [loadSession, loadSessionData],
  );

  // 6. Auth (boot sequence runs on mount)
  const { user, bootStatus, logout, retryBoot } = useAuth({
    fetchSessions,
    restoreActiveSession,
  });

  // 7. Logout handler (calls hook logout + resets sessions + chat)
  const handleLogout = useCallback(async () => {
    await logout();
    resetSessions();
    resetChat();
  }, [logout, resetSessions, resetChat]);

  // 8. Delete session handler (passes newChat as callback for active session)
  const handleDeleteSession = useCallback(
    (sessionId) => deleteSession(sessionId, newChat),
    [deleteSession, newChat],
  );

  // Simple path-based routing for auth pages (no React Router needed)
  // Must be AFTER all hooks to satisfy React Hooks rules
  const path = window.location.pathname;
  if (path === "/verify-email") return <VerifyEmail />;
  if (path === "/forgot-password") return <ForgotPassword />;
  if (path === "/reset-password") return <ResetPassword />;

  return (
    <>
      {bootStatus === "CONNECTION_ERROR" ? (
        <div className="flex items-center justify-center h-screen w-full bg-app">
          <div className="text-center max-w-sm mx-auto px-4">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-warning flex items-center justify-center">
              <span className="text-2xl font-bold text-warning">!</span>
            </div>
            <p className="text-xl font-bold text-app mb-2">
              Connection Lost
            </p>
            <p className="text-sm text-app-secondary mb-6">
              Unable to reach the server. Check your internet connection and
              try again.
            </p>
            <button
              onClick={retryBoot}
              className="px-6 py-2.5 bg-[#7b9acc] text-white rounded-lg font-medium hover:opacity-90 transition-all cursor-pointer"
            >
              Retry
            </button>
          </div>
        </div>
      ) : bootStatus === "INITIALIZING" || bootStatus === "AUTHENTICATING" ? (
        <div className="flex items-center justify-center h-screen w-full bg-app text-[#7b9acc]">
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
          onNewChat={newChat}
          onLogout={handleLogout}
          sessions={sessions}
          onLoadSession={restoreActiveSession}
          currentSessionId={currentSessionId}
          onDeleteSession={handleDeleteSession}
          onRenameSession={renameSession}
          onTogglePin={togglePin}
          saveStatus={saveStatus}
          onRetrySave={() => {
            const currentTopic =
              sessions.find((s) => s.id === currentSessionId)?.topic || "Chat";
            saveSessionToDb(history, currentTopic, currentSessionId);
          }}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          customModels={customModels}
          onSaveCustomModel={addCustomModel}
          onDeleteCustomModel={deleteCustomModel}
          theme={theme}
          onToggleTheme={toggleTheme}
          onSearchSessions={searchSessions}
        >
          {view === "chat" && (
            <ChatInterface
              messages={messages}
              onSendMessage={sendMessage}
              isLoading={isLoading}
              onStartQuiz={() => {
                if (messages.length === 0) return;
                setView("quizSetup");
              }}
              onStopGenerating={stopGenerating}
            />
          )}
          {view === "quizSetup" && (
            <QuizSetup onStart={startQuiz} onExit={() => setView("chat")} />
          )}
          {view === "quiz" && (
            <QuizInterface
              key={quizData?.progress?.current || 1}
              quizData={quizData}
              onAnswer={quizAnswer}
              onExit={() => setView("chat")}
            />
          )}
          {view === "summary" && (
            <QuizSummary
              summary={quizData?.summary}
              score={quizScore}
              total={quizData?.progress?.total}
              onResetToChat={resetToChat}
              onGrowthRetry={() =>
                startQuiz({ ...quizParams, growthAreas: wrongAnswers })
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
