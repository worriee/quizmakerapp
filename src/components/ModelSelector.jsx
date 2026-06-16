import React, { useState, useRef, useEffect } from 'react';

const MODELS = [
{ id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash' },
{ id: 'step-3.7-flash', name: 'Step 3.7 Flash' },
{ id: 'glm-5.1', name: 'GLM 5.1' },
];

const ModelSelector = ({ selectedModel, setSelectedModel }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentModel = MODELS.find(m => m.id === selectedModel) || MODELS[0];

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#7b9acc]/30 bg-white/50 hover:bg-white transition-all text-xs font-medium text-black shadow-sm group"
      >
        <span className="w-2 h-2 rounded-full bg-[#7b9acc] group-hover:scale-125 transition-transform" />
        <span>{currentModel.name}</span>
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          fill="none" 
          viewBox="0 0 24 24" 
          strokeWidth={2} 
          stroke="currentColor" 
          className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 bg-[#FCF6F5] border border-[#7b9acc]/20 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2">
            <p className="px-3 py-2 text-[9px] font-black text-black/40 uppercase tracking-widest">Select Model</p>
            <div className="space-y-1">
              {MODELS.map((model) => (
                <button
                  key={model.id}
                  onClick={() => {
                    setSelectedModel(model.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-all flex items-center justify-between ${
                    selectedModel === model.id 
                      ? 'bg-[#7b9acc] text-white font-bold' 
                      : 'text-black hover:bg-[#7b9acc]/10'
                  }`}
                >
                  <span>{model.name}</span>
                  {selectedModel === model.id && (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelSelector;
