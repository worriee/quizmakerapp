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
      <div className="flex flex-col items-center justify-center h-full max-w-3xl mx-auto w-full p-4 sm:p-6 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#7b9acc] mb-4"></div>
        <p className="text-lg font-bold text-[#7b9acc]">
          Preparing your quiz...
        </p>
        <p className="text-sm text-black/60 mt-2">This won't take long.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto w-full p-4 sm:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#7b9acc]/20 pb-4 mb-8">
        <button
          onClick={onExit}
          className="text-sm text-black/60 hover:text-black transition-colors flex items-center gap-1"
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

      <div className="flex-1 overflow-y-auto space-y-8 pr-2">
        {/* Feedback Card - Moved to Top */}
        {feedback && feedback.isCorrect !== null && (
          <div
            className={`p-6 rounded-2xl border-2 animate-in slide-in-from-top-4 duration-500 shadow-sm ${
              feedback.isCorrect
                ? "bg-[#7b9acc] border-[#7b9acc] text-[#FCF6F5]"
                : "bg-[#FCF6F5] border-[#7b9acc] text-black"
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">
                {feedback.isCorrect ? "✅" : "❌"}
              </span>
              <span className="text-lg font-bold leading-none">
                {feedback.isCorrect ? "Correct!" : "Not quite"}
              </span>
            </div>
            <p className="text-sm sm:text-base leading-relaxed opacity-95 font-medium">
              {feedback.text}
            </p>
          </div>
        )}

        {/* Question Section */}
        <div className="space-y-8">
          <div className="space-y-3">
            <div className="inline-block px-3 py-1 rounded-full bg-[#7b9acc]/10 text-[#7b9acc] text-[10px] font-bold uppercase tracking-widest">
              Current Question
            </div>
            <h2 className="text-xl sm:text-3xl font-bold text-black leading-tight tracking-tight">
              {text}
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {options.map((option, idx) => {
              let buttonClass =
                "text-left px-6 py-5 rounded-2xl border-2 transition-all text-sm sm:text-base font-medium ";

              if (selectedOption === null) {
                buttonClass +=
                  "border-[#7b9acc]/20 bg-white hover:bg-[#7b9acc]/5 hover:border-[#7b9acc]/50 text-black";
              } else if (option === selectedOption) {
                buttonClass += feedback?.isCorrect
                  ? "bg-[#7b9acc] border-[#7b9acc] text-[#FCF6F5] shadow-md scale-[1.02]"
                  : "bg-[#FCF6F5] border-[#7b9acc] text-black shadow-sm";
              } else {
                buttonClass += "border-[#7b9acc]/10 text-black/30 bg-white/50";
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
