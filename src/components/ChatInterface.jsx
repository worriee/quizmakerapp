import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * ChatInterface Component: The primary user interface for interacting with the AI.
 * Handles message rendering, markdown parsing, and the input form.
 */
const ChatInterface = ({ messages, onSendMessage, isLoading, onStartQuiz }) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef(null);

  // Auto-scroll to bottom whenever new messages are added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Handles form submission for sending messages
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Messages Display Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6"
      >
        {/* Empty State: Shown when no messages exist in the session */}
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
            <div className="text-5xl">✨</div>
            <h2 className="text-2xl font-semibold text-gray-700">How can I help you learn today?</h2>
            <p className="text-gray-500 max-w-sm">
              Ask me to summarize a topic, create study notes, or start a mock quiz.
            </p>
          </div>
        ) : (
          // Render each message based on its role (user vs model) and type
          messages.map((msg, idx) => (
            <div 
              key={idx} 
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
            >
              <div className={`max-w-[85%] md:max-w-2xl p-4 rounded-2xl ${
                msg.role === 'user' 
                  ? 'bg-gray-100 text-gray-800 rounded-tr-none' 
                  : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none shadow-sm'
              }`}>
                
                {/* Render Quiz Content: Options and Feedback */}
                {msg.type === 'quiz' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2">
                      <span>Quiz Mode</span>
                      <span className="text-gray-300">•</span>
                      <span>Question {msg.progress?.current} of {msg.progress?.total}</span>
                    </div>
                    
                    {/* Feedback for the previous answer */}
                    {msg.feedback && (
                      <div className={`p-3 rounded-lg mb-4 text-sm ${
                        msg.feedback.isCorrect 
                          ? 'bg-green-50 text-green-800 border border-green-100' 
                          : 'bg-red-50 text-red-800 border border-red-100'
                      }`}>
                        <p className="font-bold mb-1">{msg.feedback.isCorrect ? '✅ Correct!' : '❌ Kupal!'}</p>
                        <p>{msg.feedback.text}</p>
                      </div>
                    )}
                    
                    <p className="font-medium text-lg leading-relaxed">{msg.text}</p>
                    
                    {/* Multiple Choice Options */}
                    {msg.options && msg.options.length > 0 && (
                      <div className="grid grid-cols-1 gap-2 mt-4">
                        {msg.options.map((option, oIdx) => (
                          <button
                            key={oIdx}
                            onClick={() => onSendMessage(option)}
                            className="text-left px-4 py-2 rounded-xl border border-gray-200 hover:bg-indigo-50 hover:border-indigo-300 transition-all text-sm font-medium"
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Render Standard Text (Markdown) for Notes and General Chat */}
                {msg.type !== 'quiz' && (
                  <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                )}

                {/* Special Action Button: Trigger Quiz generation after notes are presented */}
                {msg.type === 'notes' && (
                  <div className="mt-6 flex justify-end">
                    <button 
                      onClick={onStartQuiz}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-all shadow-sm flex items-center gap-2"
                    >
                      <span>📝</span> Start Mock Quiz based on these notes
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bottom Input Bar */}
      <div className="p-4 md:p-8 bg-gradient-to-t from-white via-white to-transparent">
        <form 
          onSubmit={handleSubmit}
          className="max-w-3xl mx-auto relative group"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message AI Tutor..."
            className="w-full px-6 py-4 pr-16 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none shadow-sm transition-all bg-white"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-indigo-600 text-white p-2 rounded-xl hover:bg-indigo-700 disabled:bg-gray-300 transition-all"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <span className="text-xl">↑</span>
            )}
          </button>
        </form>
        <p className="text-center text-[10px] text-gray-400 mt-3">
          AI can make mistakes. Check important info.
        </p>
      </div>
    </div>
  );
};

export default ChatInterface;
