import { useState } from "react";

const QuizInterface = ({ quizData, onAnswer, onExit }) => {
  const [selectedOption, setSelectedOption] = useState(null);

  const handleOptionClick = (option) => {
    if (selectedOption !== null) return;
    setSelectedOption(option);
    onAnswer(option);
  };

  const text = quizData?.text;
  const options = quizData?.options || [];
  const feedback = quizData?.feedback;
  const progress = quizData?.progress || { current: 1, total: 1 };
  const current = progress.current || 1;
  const total = progress.total || 1;

  if (!quizData || !text) {
    return (
      <div className="flex flex-col items-center justify-center h-full max-w-3xl mx-auto w-full p-4 sm:p-6 text-center text-app">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#7b9acc] mb-4"></div>
        <p className="text-lg font-bold text-[#7b9acc]">
          Preparing your quiz...
        </p>
        <p className="text-sm text-app-secondary mt-2">This won't take long.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto w-full p-3 sm:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-app pb-3 sm:pb-4 mb-4 sm:mb-8">
        <button
          onClick={onExit}
          className="text-sm text-app-secondary hover:text-app transition-colors flex items-center gap-1"
        >
          ← Back to Chat
        </button>
        <div className="flex items-center gap-3">
          <div className="text-xs font-bold text-[#7b9acc] uppercase tracking-wider animate-in fade-in duration-300">
            Question{" "}
            <span className="font-extrabold text-[#7b9acc]">{current}</span> of{" "}
            <span className="font-extrabold text-[#7b9acc]">{total}</span>
          </div>
          <div className="w-24 h-2.5 bg-[#7b9acc]/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#7b9acc] transition-all duration-500 ease-out"
              style={{ width: `${(current / total) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-5 sm:space-y-8 pr-1 sm:pr-2">
        {/* Feedback Card - Moved to Top */}
        {feedback && feedback.isCorrect !== null && (
          <div
            className={`p-4 sm:p-6 rounded-2xl border-2 animate-in slide-in-from-top-4 duration-500 shadow-sm ${
              feedback.isCorrect
                ? "bg-[#7b9acc] border-[#7b9acc] text-[#FCF6F5]"
                : "bg-app text-app border-[#7b9acc]"
            }`}
          >
            <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
              <span className="text-xl sm:text-2xl">
                {feedback.isCorrect ? "✅" : "❌"}
              </span>
              <span className="text-base sm:text-lg font-bold leading-none">
                {feedback.isCorrect ? "Correct!" : "Not quite"}
              </span>
            </div>
            <p className="text-sm sm:text-base leading-relaxed opacity-95 font-medium">
              {feedback.text}
            </p>
          </div>
        )}

        {/* Question Section */}
        <div className="space-y-5 sm:space-y-8">
          <div className="space-y-2 sm:space-y-3">
            <div className="inline-block px-2.5 sm:px-3 py-1 rounded-full bg-[#7b9acc]/10 text-[#7b9acc] text-[10px] font-bold uppercase tracking-widest">
              Current Question
            </div>
            <h2 className="text-lg sm:text-3xl font-bold text-app leading-tight tracking-tight">
              {text}
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:gap-4">
            {options.map((option, idx) => {
              let buttonClass =
                "text-left px-4 sm:px-6 py-3 sm:py-5 rounded-2xl border-2 transition-all text-sm sm:text-base font-medium ";
              
              if (selectedOption === null) {
                buttonClass +=
                  "border-app bg-app-surface hover:bg-[#7b9acc]/5 hover:border-[#7b9acc]/50 text-app";
              } else if (option === selectedOption) {
                buttonClass += feedback?.isCorrect
                  ? "bg-[#7b9acc] border-[#7b9acc] text-[#FCF6F5] shadow-md scale-[1.02]"
                  : "bg-app border-[#7b9acc] text-app shadow-sm";
              } else {
                buttonClass += "border-[#7b9acc]/10 text-app-muted";
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleOptionClick(option)}
                  disabled={selectedOption !== null}
                  className={buttonClass}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizInterface;
