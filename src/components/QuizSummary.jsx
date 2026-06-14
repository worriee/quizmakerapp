// React 17+ JSX transform does not require React import

const QuizSummary = ({ summary, score, total, onReset, onGrowthRetry, hasWrongAnswers }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full p-4 sm:p-6 text-center space-y-8 animate-in fade-in zoom-in duration-500">
      <div className="space-y-4 max-w-2xl">
        <div className="text-6xl mb-4">🏆</div>
        <h1 className="text-3xl sm:text-4xl font-bold text-black tracking-tight">
          Quiz Complete!
        </h1>
        <div className="text-5xl sm:text-6xl font-black text-black my-6">
          {score} / {total}
        </div>
        <p className="text-lg text-black/80 leading-relaxed">
          {summary || "Great effort! Review your notes and try again to master the topic."}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        {hasWrongAnswers && (
          <button
            onClick={onGrowthRetry}
            className="w-full sm:w-auto px-8 py-3 bg-white text-[#7b9acc] border border-[#7b9acc] rounded-xl font-semibold hover:bg-[#7b9acc]/10 transition-all shadow-sm"
          >
            Focus on Growth Areas
          </button>
        )}
        <button
          onClick={onReset}
          className="w-full sm:w-auto px-8 py-3 bg-[#7b9acc] text-[#FCF6F5] rounded-xl font-semibold hover:bg-[#7b9acc]/80 transition-all shadow-md"
        >
          Try Another Topic
        </button>
      </div>
    </div>
  );
};

export default QuizSummary;
