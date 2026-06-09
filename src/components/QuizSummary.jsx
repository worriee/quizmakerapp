import React from 'react';

const QuizSummary = ({ summary, score, total, onReset }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-8 animate-in fade-in zoom-in duration-500">
      <div className="space-y-4 max-w-2xl">
        <div className="text-6xl mb-4">🏆</div>
        <h1 className="text-4xl font-bold text-black tracking-tight">
          Quiz Complete!
        </h1>
        <div className="text-6xl font-black text-black my-6">
          {score} / {total}
        </div>
        <p className="text-lg text-black/80 leading-relaxed">
          {summary || "Great effort! Review your notes and try again to master the topic."}
        </p>
      </div>

      <div className="flex gap-4">
        <button
          onClick={onReset}
          className="px-8 py-3 bg-[#7b9acc] text-[#FCF6F5] rounded-xl font-semibold hover:bg-[#7b9acc]/80 transition-all shadow-md"
        >
          Try Another Topic
        </button>
      </div>
    </div>
  );
};

export default QuizSummary;
