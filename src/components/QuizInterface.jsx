import React, { useState } from 'react';

const QuizInterface = ({ quizData, onAnswer, onExit }) => {
  const [selectedOption, setSelectedOption] = useState(null);
  const { text, options, feedback, progress } = quizData;

  const handleOptionClick = (option) => {
    if (selectedOption !== null) return;
    setSelectedOption(option);
    onAnswer(option);
  };

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto w-full p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#7b9acc]/20 pb-4">
        <button 
          onClick={onExit}
          className="text-sm text-black/60 hover:text-black transition-colors flex items-center gap-1"
        >
          ← Back to Chat
        </button>
        <div className="flex items-center gap-3">
          <div className="text-xs font-bold text-black uppercase tracking-wider">
            Question {progress.current} of {progress.total}
          </div>
          <div className="w-32 h-2 bg-[#FCF6F5] rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#7b9acc] transition-all duration-500" 
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Question */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-black leading-snug">
          {text}
        </h2>

        <div className="grid grid-cols-1 gap-3">
          {options.map((option, idx) => {
            const isCorrect = feedback?.isCorrect === true && option === quizData.correctAnswer; // Assuming correctAnswer is passed
            const isWrong = feedback?.isCorrect === false && option === selectedOption;
            
            // Since we don't have 'correctAnswer' in the JSON, we use feedback text or the AI response.
            // In a real app, we'd need the correct option explicitly. 
            // For now, we'll highlight the selected one.
            
            let buttonClass = "text-left px-5 py-4 rounded-xl border transition-all text-sm font-medium ";
            if (selectedOption === null) {
              buttonClass += "border-[#7b9acc]/30 hover:bg-[#7b9acc]/10 hover:border-[#7b9acc]/50";
            } else if (option === selectedOption) {
              buttonClass += feedback?.isCorrect 
                ? "bg-[#7b9acc] border-[#7b9acc] text-[#FCF6F5]" 
                : "bg-[#FCF6F5] border-[#7b9acc] text-black";
            } else {
              buttonClass += "border-[#7b9acc]/20 text-black/40";
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

      {/* Feedback Card */}
      {feedback && feedback.isCorrect !== null && (
        <div className={`p-5 rounded-2xl border animate-in slide-in-from-top-2 duration-300 ${
          feedback.isCorrect 
            ? "bg-[#7b9acc] border-[#7b9acc] text-[#FCF6F5]" 
            : "bg-[#FCF6F5] border-[#7b9acc] text-black"
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">{feedback.isCorrect ? "✅" : "❌"}</span>
            <span className="font-bold">{feedback.isCorrect ? "Correct!" : "Not quite"}</span>
          </div>
          <p className="text-sm leading-relaxed opacity-90">{feedback.text}</p>
        </div>
      )}
    </div>
  );
};

export default QuizInterface;
