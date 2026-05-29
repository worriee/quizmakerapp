import React, { useState, useEffect, useRef } from 'react';

/**
 * QuizInterface Component: Provides a specialized, focused view for the interactive mock exam.
 * Handles user answers and displays real-time AI feedback.
 */
const QuizInterface = ({ session, isLoading, onAnswer }) => {
  const [userAnswer, setUserAnswer] = useState('');
  const scrollRef = useRef(null);

  // Ensure the chat view scrolls to the most recent feedback/question
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [session]);

  // Handles submission of the user's answer
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!userAnswer.trim() || isLoading) return;
    onAnswer(userAnswer);
    setUserAnswer('');
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-gray-50 shadow-xl">
      {/* Quiz Header: Displays current progress */}
      <div className="bg-indigo-600 text-white p-4 flex justify-between items-center sticky top-0 z-10">
        <h2 className="text-xl font-bold">Interactive Tutor</h2>
        <div className="text-sm bg-indigo-500 px-3 py-1 rounded-full">
          Question {session.progress.current} of {session.progress.total}
        </div>
      </div>

      {/* Interaction Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {/* AI Feedback: Shown after a user answers a question */}
        {session.feedback && (
          <div className="flex justify-start animate-in fade-in slide-in-from-left-2 duration-300">
            <div className={`max-w-[85%] p-4 rounded-2xl rounded-tl-none shadow-sm ${
              session.feedback.isCorrect
                ? 'bg-green-50 text-green-900 border border-green-200'
                : 'bg-red-50 text-red-900 border border-red-200'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{session.feedback.isCorrect ? '✅' : '❌'}</span>
                <p className="font-bold text-sm uppercase tracking-wide">
                  {session.feedback.isCorrect ? 'Correct' : 'Incorrect'}
                </p>
              </div>
              <p className="text-sm leading-relaxed">{session.feedback.text}</p>
            </div>
          </div>
        )}

        {/* Current AI Question */}
        <div className="flex justify-start animate-in fade-in slide-in-from-left-2 duration-300">
          <div className="max-w-[85%] p-4 bg-white text-gray-800 rounded-2xl rounded-tl-none shadow-sm border border-gray-200">
            <p className="font-medium leading-relaxed">{session.question.text}</p>
            {/* Multiple Choice Options (if provided by AI) */}
            {session.question.options && session.question.options.length > 0 && (
              <div className="mt-4 grid grid-cols-1 gap-2">
                {session.question.options.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => setUserAnswer(option)}
                    className="text-left px-4 py-2 rounded-xl border border-gray-200 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-all text-sm font-medium"
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Answer Input Form */}
      <form
        onSubmit={handleSubmit}
        className="p-4 bg-white border-t border-gray-200 flex gap-2"
      >
        <input
          type="text"
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          placeholder="Type your answer here..."
          className="flex-1 px-4 py-2 rounded-full border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading}
          className="bg-indigo-600 text-white px-6 py-2 rounded-full font-semibold hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
        >
          {isLoading ? '...' : 'Send'}
        </button>
      </form>
    </div>
  );
};

export default QuizInterface;
