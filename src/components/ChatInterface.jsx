import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";

/** Custom renderers so wide markdown content (code blocks, tables, long lines)
 *  scrolls horizontally in a themed strip directly below the surrounding text
 *  instead of widening the chat bubble or wrapping awkwardly. The strip uses
 *  overflow-x-auto and inherits the ERR-046 themed scrollbar so it blends
 *  with the active light/dark theme. */
const markdownComponents = {
  pre: ({ children }) => (
    <div className="overflow-x-auto my-2 rounded-lg bg-app-surface border border-app">
      <pre className="px-3 py-2 m-0 text-xs sm:text-sm leading-relaxed whitespace-pre">
        {children}
      </pre>
    </div>
  ),
  code: ({ inline, children, ...props }) =>
    inline ? (
      <code
        className="px-1 py-0.5 rounded bg-app-surface text-[#7b9acc] text-xs sm:text-sm"
        {...props}
      >
        {children}
      </code>
    ) : (
      <code {...props}>{children}</code>
    ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="border-collapse text-xs sm:text-sm">{children}</table>
    </div>
  ),
};

/** ChatInterface Component: primary chat UI with markdown and quiz rendering. */
const ChatInterface = ({ messages, onSendMessage, isLoading, onStartQuiz }) => {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 text-app">
       {/* Messages Area */}
       <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-5 sm:space-y-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <h1 className="text-lg sm:text-2xl font-serif italic text-[#7b9acc] max-w-md leading-relaxed">
                "Study to Understand, Navigate to Succeed."
              </h1>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-5 py-3 ${
                    msg.role === "user"
                      ? "bg-[#7b9acc] text-white rounded-br-sm"
                      : "bg-app text-app border border-app rounded-bl-sm"
                  }`}
                >
                  {msg.type === "quiz" ? (
                    <div className="text-sm">{msg.text}</div>
                  ) : (
                    <div className="prose prose-sm max-w-none break-words text-app leading-relaxed">
                      <ReactMarkdown
                        rehypePlugins={[rehypeSanitize]}
                        components={markdownComponents}
                      >
                        {msg.text}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-app text-app border border-app rounded-2xl rounded-bl-sm px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 bg-[#7b9acc] rounded-full animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    />
                    <div
                      className="w-2 h-2 bg-[#7b9acc] rounded-full animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    />
                    <div
                      className="w-2 h-2 bg-[#7b9acc] rounded-full animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-app p-3 sm:p-4 bg-app">
        <form onSubmit={handleSubmit} className="flex gap-2 sm:gap-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask TUON AI anything..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-app bg-app-surface px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-app placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-[#7b9acc]"
          />
          <div className="flex flex-col gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={onStartQuiz}
              disabled={isLoading}
              className="px-3 sm:px-4 py-2 rounded-xl bg-app-surface text-app border border-app text-xs sm:text-sm font-medium hover:bg-[#7b9acc]/10 disabled:opacity-50"
            >
              Quiz
            </button>
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-3 sm:px-4 py-2 rounded-xl bg-[#7b9acc] text-white text-xs sm:text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </form>
        <p className="text-center text-[10px] text-app-muted mt-2 sm:mt-3 italic">
          AI still make mistakes always double check
        </p>
      </div>
    </div>
  );
};

export default ChatInterface;
