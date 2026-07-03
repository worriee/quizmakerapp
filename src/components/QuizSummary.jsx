const QuizSummary = ({
  summary,
  score,
  total,
  onResetToChat,
  onGrowthRetry,
  hasWrongAnswers,
}) => {
  return (
    <div className="flex flex-col items-center justify-center h-full p-4 sm:p-6 text-center space-y-8 animate-in fade-in zoom-in duration-500 text-app">
      <div className="space-y-4 max-w-2xl">
        <h1 className="text-3xl sm:text-4xl font-bold text-app tracking-tight">
          Quiz Complete!
        </h1>
        <div className="text-5xl sm:text-6xl font-black text-app my-6">
          {score} / {total}
        </div>
        <p className="text-lg text-app-secondary leading-relaxed">
          {summary ||
            "Great effort! Review your notes and try again to master the topic."}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        {hasWrongAnswers && (
          <button
            onClick={onGrowthRetry}
            className="w-full sm:w-auto px-8 py-3 bg-app-surface text-[#7b9acc] border border-[#7b9acc] rounded-xl font-semibold hover:bg-[#7b9acc]/10 transition-all shadow-sm"
          >
            Focus on Growth Areas
          </button>
        )}
        <button
          onClick={onResetToChat}
          className="w-full sm:w-auto px-8 py-3 bg-[#7b9acc] text-[#FCF6F5] rounded-xl font-semibold hover:bg-[#7b9acc]/80 transition-all shadow-md"
        >
          Back to Chats
        </button>
      </div>
    </div>
  );
};

export default QuizSummary;
