import { useState } from "react";

const QuizSetup = ({ onStart, onExit }) => {
  const [itemCount, setItemCount] = useState(5);
  const [difficulty, setDifficulty] = useState("Normal");

  const difficulties = ["Easy", "Normal", "Hard"];

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 animate-in fade-in zoom-in duration-300">
      <div className="bg-white border border-[#7b9acc]/20 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-xl space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-sans text-[#7b9acc]">
            Quiz Configuration
          </h2>
          <p className="text-black/50 text-sm">
            Customize your challenge to master the topic
          </p>
        </div>

        <div className="space-y-6">
          {/* Item Count */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-sm font-bold text-black/70 uppercase tracking-wider">
                Number of Questions
              </label>
              <span className="text-[#7b9acc] font-bold text-lg">
                {itemCount}
              </span>
            </div>
            <input
              type="range"
              min="3"
              max="20"
              value={itemCount}
              onChange={(e) => setItemCount(parseInt(e.target.value))}
              className="w-full h-2 bg-[#7b9acc]/20 rounded-lg appearance-none cursor-pointer accent-[#7b9acc]"
            />
            <div className="flex justify-between text-[10px] text-black/40 font-medium">
              <span>3 Questions</span>
              <span>20 Questions</span>
            </div>
          </div>

          {/* Difficulty */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-black/70 uppercase tracking-wider block">
              Difficulty Level
            </label>
            <div className="grid grid-cols-3 gap-3">
              {difficulties.map((level) => (
                <button
                  key={level}
                  onClick={() => setDifficulty(level)}
                  className={`py-2 px-3 rounded-xl text-sm font-medium transition-all border ${
                    difficulty === level
                      ? "bg-[#7b9acc] text-white border-[#7b9acc] shadow-md"
                      : "bg-white text-black border-[#7b9acc]/20 hover:border-[#7b9acc]/40"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            onClick={onExit}
            className="flex-1 py-3 rounded-xl bg-[#FCF6F5] text-black border border-[#7b9acc]/30 text-sm font-bold hover:bg-[#7b9acc]/10 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => onStart({ itemCount, difficulty })}
            className="flex-1 py-3 rounded-xl bg-[#7b9acc] text-white text-sm font-bold hover:opacity-90 transition-all shadow-md"
          >
            Start Quiz
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuizSetup;
