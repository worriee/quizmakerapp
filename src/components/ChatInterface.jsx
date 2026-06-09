import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Helper to render the AI raw output with separators for <final> tags.
 * Defined outside the component to prevent unnecessary re-creations.
 */
const renderRawAIOutput = (text) => {
  if (!text) return null;

  const processedText = text
    .replace(/<thought>/g, "**Reasoning:**\n")
    .replace(/<\/thought>/g, "\n---")
    .replace(/<final>/g, "🎯 **Final Response:**\n")
    .replace(/<\/final>/g, "\n---");

  return (
    <div className="prose prose-sm max-w-none text-black leading-relaxed whitespace-pre-wrap">
      <ReactMarkdown remarkGfm>{processedText}</ReactMarkdown>
    </div>
  );
};

/**
 * ChatInterface Component: The primary user interface for interacting with the AI.
 * Handles message rendering, markdown parsing, and the input form.
 */
const ChatInterface = ({
  messages,
  onSendMessage,
  isLoading,
  onStartQuiz,
  onStopGenerating,
}) => {
  const [input, setInput] = useState("");
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  // State to track which reasoning blocks are expanded/collapsed
  const [expandedThoughts, setExpandedThoughts] = useState({});

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input);
    setInput("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const toggleThought = (idx) => {
    setExpandedThoughts((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  return (
    <div className="flex flex-col h-full bg-[#FCF6F5]">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 md:p-8 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        <div className="max-w-3xl mx-auto w-full space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
               <h2 className="text-2xl md:text-3xl font-extrabold text-[#7b9acc] leading-tight">
                Study to Understand, <span className="block md:inline">Navigate to Succeed.</span>
              </h2>
              <p className="text-black max-w-sm">
                Ask me to summarize a topic, create study notes, or start a mock
                quiz.
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
              >
                <div
                  className={`max-w-[90%] md:max-w-2xl p-4 rounded-2xl ${
                    msg.role === "user"
                       ? "bg-[#FCF6F5] text-black rounded-tr-none shadow-sm"
                       : "bg-[#FCF6F5] border border-[#7b9acc]/30 text-black rounded-tl-none shadow-sm"
                  }`}
                >
                  {msg.role === "model" && msg.raw && (
                    <>
                      {/* Reasoning Process: Minimized by default */}
                      {msg.raw.includes("<thought>") && (
                        <div
                          className={`mb-4 transition-all duration-200 overflow-hidden ${expandedThoughts[idx] ? "max-h-64 opacity-100" : "max-h-10 opacity-80"}`}
                        >
                          <div
                            onClick={() => toggleThought(idx)}
                            className="flex items-center justify-between p-2 bg-[#FCF6F5] rounded-lg border border-[#7b9acc] cursor-pointer hover:bg-[#7b9acc] transition-colors group"
                          >
                            <div className="flex items-center gap-2 text-xs font-medium text-black">
                              <span>Reasoning</span>
                            </div>
                            <div className="text-black group-hover:text-[#7b9acc] transition-colors">
                              {expandedThoughts[idx] ? (
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 15l7-7 7 7"
                                  />
                                </svg>
                              ) : (
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 9l-7 7-7-7"
                                  />
                                </svg>
                              )}
                            </div>
                          </div>
                          {expandedThoughts[idx] && (
                            <div className="mt-2 p-3 text-sm text-black italic leading-relaxed bg-[#FCF6F5] rounded-b-lg border-x border-b border-[#7b9acc] break-words max-h-48 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                              {msg.raw.match(
                                /<thought>([\s\S]*?)<\/thought>/,
                              )?.[1] || ""}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="prose prose-sm max-w-none text-black leading-relaxed overflow-hidden break-words">
                        <ReactMarkdown remarkGfm>{msg.text}</ReactMarkdown>
                      </div>

                      {msg.type === "quiz" && (
                        <div className="mt-6 pt-6 border-t border-[#7b9acc]/20 space-y-4">
                          <div className="flex items-center gap-2 text-xs font-bold text-black uppercase tracking-wider mb-2">
                            <span>Quiz Interface</span>
                            <span className="text-black">•</span>
                            <span>
                              Question {msg.progress?.current} of{" "}
                              {msg.progress?.total}
                            </span>
                          </div>

                          {msg.feedback && msg.feedback.isCorrect !== null && (
                            <div
                              className={`p-3 rounded-lg mb-4 text-sm ${
                                msg.feedback.isCorrect
                                  ? "bg-[#7b9acc] text-[#FCF6F5] border border-[#7b9acc] hover:bg-[#7b9acc]/80"
                                  : "bg-[#FCF6F5] text-[#7b9acc] border border-[#7b9acc]/30 hover:bg-[#7b9acc]/10 hover:border-[#7b9acc]/50"
                              }`}
                            >
                              <p className="font-bold mb-1">
                                {msg.feedback.isCorrect
                                  ? "✅ Correct!"
                                  : "❌ Not quite"}
                              </p>
                              <p>{msg.feedback.text}</p>
                            </div>
                          )}

                          <p className="font-medium text-lg leading-relaxed">
                            {msg.text}
                          </p>

                          {msg.options && msg.options.length > 0 && (
                            <div className="grid grid-cols-1 gap-2 mt-4">
                              {msg.options.map((option, oIdx) => (
                                <button
                                  key={oIdx}
                                  onClick={() => onSendMessage(option)}
                                  className="text-left px-4 py-2 rounded-xl border border-[#7b9acc]/30 hover:bg-[#7b9acc]/10 hover:border-[#7b9acc]/50 transition-all text-sm font-medium"
                                >
                                  {option}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {msg.role === "model" && !msg.raw && msg.type !== "quiz" && (
                    <div className="prose prose-sm max-w-none text-black leading-relaxed overflow-hidden break-words">
                      <ReactMarkdown remarkGfm>{msg.text}</ReactMarkdown>
                    </div>
                  )}

                  {msg.role === "user" && (
                    <div className="space-y-2">
                      <div className="prose prose-sm max-w-none text-black leading-relaxed break-words">
                        {msg.text}
                      </div>
                    </div>
                  )}

                  {msg.type === "notes" && (
                    <div className="mt-6 flex justify-end">
                      <button
                        onClick={onStartQuiz}
                        className="bg-[#7b9acc] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#7b9acc] transition-all shadow-sm flex items-center gap-2"
                      >
                        Start Mock Quiz
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {isLoading && (
            <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="max-w-[85%] md:max-w-2xl p-4 rounded-2xl bg-[#FCF6F5] border border-[#7b9acc]/30 text-black rounded-tl-none shadow-sm">
                <div className="flex items-center gap-3 text-black">
                  <span className="text-sm font-medium italic text-black">Thinking</span>
                  <div className="flex gap-1">
                    <div className="w-1 h-1 bg-[#7b9acc] rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1 h-1 bg-[#7b9acc] rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1 h-1 bg-[#7b9acc] rounded-full animate-bounce"></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 md:p-8 bg-[#FCF6F5]">
        <form
          onSubmit={handleSubmit}
          className="max-w-3xl mx-auto relative group"
        >
          <div className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Start a topic..."
                rows="1"
                className="w-full px-4 py-3 md:px-6 md:py-4 pr-12 md:pr-16 rounded-2xl border border-[#7b9acc] focus:ring-2 focus:ring-[#7b9acc] focus:border-transparent outline-none shadow-sm transition-all bg-[#FCF6F5] resize-none min-h-[56px] max-h-[200px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!isLoading && !input.trim()}
                onClick={(e) => {
                  if (isLoading) {
                    e.preventDefault();
                    onStopGenerating();
                  }
                }}
                className={`absolute right-3 bottom-3 p-2 rounded-xl transition-all flex items-center justify-center ${
                  isLoading
                    ? "bg-[#7b9acc] text-[#FCF6F5] hover:bg-[#7b9acc]/80"
                    : "bg-[#7b9acc] text-white hover:bg-[#7b9acc] disabled:bg-[#7b9acc]/30"
                }`}
              >
                {isLoading ? (
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                ) : (
                  <span className="text-xl">↑</span>
                )}
              </button>
            </div>
          </div>
        </form>
        <p className="text-center text-[10px] text-black/40 mt-3">
          <span className="italic">AI still make mistakes always double check.</span>
        </p>
      </div>
    </div>
  );
};

export default ChatInterface;
