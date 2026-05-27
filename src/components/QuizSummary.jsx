import React from 'react';

const QuizSummary = ({ summary, onRestart }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-gray-50">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-100">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-3xl font-bold mb-4 text-indigo-600">Quiz Completed!</h2>
        <div className="text-gray-700 mb-8 leading-relaxed">
          {summary || "You've completed the interactive session. Great job on challenging yourself!"}
        </div>
        <button
          onClick={onRestart}
          className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-lg hover:bg-indigo-700 transition-colors shadow-lg"
        >
          Try Another Topic
        </button>
      </div>
    </div>
  );
};

export default QuizSummary;
