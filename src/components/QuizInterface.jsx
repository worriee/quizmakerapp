import { useState, useEffect } from 'react';

const QuizInterface = ({ quizData, onAnswer, onExit }) => {
  const [selectedOption, setSelectedOption] = useState(null);

  useEffect(() => {
    setSelectedOption(null);
  }, [quizData]);

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
  const stepWidth = total > 1 ? 100 / (total - 1) : 100;

  if (!quizData || !text) {
    return (
      <div className="flex flex-col items-center justify-center h-full max-w-3xl mx-auto w-full p-4 sm:p-6 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#7b9acc] mb-4"></div>
        <p className="text-lg font-bold text-[#7b9acc]">Preparing your quiz...</p>
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
          <div className="text-xs font-bold text-black uppercase tracking-wider">
            Question {current} of {total}
          </div>
          <div className="w-32 h-2 bg-[#FCF6F5] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#7b9acc] transition-all duration-500"
              style={{ width: `${(current / total) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Progress Stepped Divider */}
      <div className="flex items-center justify-between mb-8 px-2">
        {Array.from({ length: total }).map((_, idx) => {
          const stepNumber = idx + 1;
          const isCompleted = stepNumber < current;
          const isCurrent = stepNumber === current;
          return (
            <div key={idx} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`h-3 w-3 rounded-full border-2 transition-all duration-300 ${
                    isCurrent
                      ? 'border-[#7b9acc] bg-[#7b9acc] shadow-md scale-125'
                      : isCompleted
                        ? 'border-[#7b9acc] bg-[#7b9acc]'
                        : 'border-[#7b9acc]/30 bg-transparent'
                  }`}
                />
                <span className={`text-[9px] font-bold uppercase tracking-widest ${
                  isCurrent ? 'text-[#7b9acc]' : isCompleted ? 'text-[#7b9acc]/70' : 'text-black/30'
                }`}>
                  {stepNumber}
                </span>
              </div>
              {idx < total - 1 && (
                <div className="flex-1 h-0.5 mx-1 rounded-full bg-[#7b9acc]/10">
                  <div
                    className="h-full bg-[#7b9acc] rounded-full transition-all duration-500"
                    style={{ width: isCompleted ? '100%' : '0%' }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto space-y-8 pr-2">
        {/* Feedback Card - Moved to Top */}
        {feedback && feedback.isCorrect !== null && (
          <div className={`p-6 rounded-2xl border-2 animate-in slide-in-from-top-4 duration-500 shadow-sm ${
            feedback.isCorrect
              ? "bg-[#7b9acc] border-[#7b9acc] text-[#FCF6F5]"
              : "bg-[#FCF6F5] border-[#7b9acc] text-black"
          }`}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">{feedback.isCorrect ? "✅" : "❌"}</span>
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
              let buttonClass = "text-left px-6 py-5 rounded-2xl border-2 transition-all text-sm sm:text-base font-medium ";

              if (selectedOption === null) {
                buttonClass += "border-[#7b9acc]/20 bg-white hover:bg-[#7b9acc]/5 hover:border-[#7b9acc]/50 text-black";
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
