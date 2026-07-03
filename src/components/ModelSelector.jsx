import { useState, useRef, useEffect } from 'react';
import CustomLLMModal from './CustomLLMModal';
import { generateModelId } from '../utils/customModelStorage';

const MODELS = [
{ id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite' },
{ id: 'step-3.7-flash', name: 'Step 3.7 Flash' },
{ id: 'glm-5.1', name: 'GLM 5.1' },
];

const ModelSelector = ({ selectedModel, setSelectedModel, customModels = [], onSaveCustomModel, onDeleteCustomModel }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
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

  const currentModel = MODELS.find(m => m.id === selectedModel)
    || customModels.find(m => m.id === selectedModel)
    || MODELS[0];

  const handleSaveCustom = (modelData) => {
    const id = generateModelId(modelData);
    onSaveCustomModel({
      id,
      ...modelData,
    });
    setSelectedModel(id);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-app bg-app-surface/80 hover:bg-app-surface transition-all text-xs font-medium text-app shadow-sm group"
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
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 sm:w-64 bg-app-surface border border-app rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2 max-h-80 overflow-y-auto">
            <p className="px-3 py-2 text-[9px] font-black text-app-muted uppercase tracking-widest">Built-in Models</p>
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
                      : 'text-app hover:bg-[#7b9acc]/10'
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

            {customModels.length > 0 && (
              <>
                <div className="my-2 border-t border-app" />
                <p className="px-3 py-2 text-[9px] font-black text-app-muted uppercase tracking-widest">Custom LLMs</p>
                <div className="space-y-1">
                  {customModels.map((model) => (
                    <div key={model.id} className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setSelectedModel(model.id);
                          setIsOpen(false);
                        }}
                        className={`flex-1 text-left px-3 py-2 rounded-xl text-xs transition-all flex items-center justify-between ${
                          selectedModel === model.id 
                            ? 'bg-[#7b9acc] text-white font-bold' 
                            : 'text-app hover:bg-[#7b9acc]/10'
                        }`}
                      >
                        <span>{model.name}</span>
                        {selectedModel === model.id && (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          onDeleteCustomModel(model.id);
                          if (selectedModel === model.id) {
                            setSelectedModel(MODELS[0].id);
                          }
                        }}
                        className="p-2 text-app-muted hover:text-red-400 hover:bg-red-900/30 rounded-lg transition-all"
                        title="Remove"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                          <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c-.84 0-1.673.025-2.5.075V3.75c0-.69.56-1.25 1.25-1.25h2.5c.69 0 1.25.56 1.25 1.25v.325C11.673 4.025 10.84 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="my-2 border-t border-app" />
            <button
              onClick={() => {
                setIsOpen(false);
                setIsModalOpen(true);
              }}
              className="w-full text-left px-3 py-2 rounded-xl text-xs text-[#7b9acc] hover:bg-[#7b9acc]/10 transition-all font-bold flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
              </svg>
              Add Custom LLM
            </button>
          </div>
        </div>
      )}

      <CustomLLMModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveCustom}
      />
    </div>
  );
};

export default ModelSelector;
