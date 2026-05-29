import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Helper to render the AI raw output with separators for <final> tags.
 * Defined outside the component to prevent unnecessary re-creations.
 */
const renderRawAIOutput = (text) => {
  if (!text) return null;

  const processedText = text
    .replace(/<thought>/g, '💭 **Reasoning:**\n')
    .replace(/<\/thought>/g, '\n---')
    .replace(/<final>/g, '🎯 **Final Response:**\n')
    .replace(/<\/final>/g, '\n---');

  return (
    <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed whitespace-pre-wrap">
      <ReactMarkdown remarkGfm>
        {processedText}
      </ReactMarkdown>
    </div>
  );
};

/**
 * ChatInterface Component: The primary user interface for interacting with the AI.
 * Handles message rendering, markdown parsing, and the input form.
 */
const ChatInterface = ({ messages, onSendMessage, isLoading, onStartQuiz, onStopGenerating }) => {
  const [input, setInput] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  // State to track which reasoning blocks are expanded/collapsed
  const [expandedThoughts, setExpandedThoughts] = useState({});

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if ((!input.trim() && selectedFiles.length === 0) || isLoading) return;
    onSendMessage(input, selectedFiles);
    setInput('');
    setSelectedFiles([]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const toggleThought = (idx) => {
    setExpandedThoughts(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
            <div className="text-5xl">✨</div>
            <h2 className="text-2xl font-semibold text-gray-700">How can I help you learn today?</h2>
            <p className="text-gray-500 max-w-sm">
              Ask me to summarize a topic, create study notes, or start a mock quiz.
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div 
              key={idx} 
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
            >
              <div className={`max-w-[90%] md:max-w-2xl p-4 rounded-2xl ${
                msg.role === 'user' 
                  ? 'bg-gray-100 text-gray-800 rounded-tr-none' 
                  : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none shadow-sm'
              }`}>
                
                {msg.role === 'model' && msg.raw && (
                  <>
                    {/* Reasoning Process: Minimized by default */}
                    {msg.raw.includes('<thought>') && (
                      <div className={`mb-4 transition-all duration-200 overflow-hidden ${expandedThoughts[idx] ? 'max-h-64 opacity-100' : 'max-h-10 opacity-80'}`}>
                        <div 
                          onClick={() => toggleThought(idx)}
                          className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors group"
                        >
                          <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
                            <span>💭 Reasoning</span>
                          </div>
                          <div className="text-gray-400 group-hover:text-indigo-500 transition-colors">
                            {expandedThoughts[idx] ? (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            )}
                          </div>
                        </div>
                        {expandedThoughts[idx] && (
                          <div className="mt-2 p-3 text-sm text-gray-500 italic leading-relaxed bg-gray-50 rounded-b-lg border-x border-b border-gray-100 break-words max-h-48 overflow-y-auto">
                            {msg.raw.match(/<thought>([\s\S]*?)<\/thought>/)?.[1] || ''}
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed overflow-hidden break-words">
                      <ReactMarkdown remarkGfm>
                        {msg.text}
                      </ReactMarkdown>
                    </div>

                    {msg.type === 'quiz' && (
                      <div className="mt-6 pt-6 border-t border-gray-100 space-y-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2">
                          <span>Quiz Interface</span>
                          <span className="text-gray-300">•</span>
                          <span>Question {msg.progress?.current} of {msg.progress?.total}</span>
                        </div>
                        
                        {msg.feedback && (
                          <div className={`p-3 rounded-lg mb-4 text-sm ${
                            msg.feedback.isCorrect 
                              ? 'bg-green-50 text-green-800 border border-green-100' 
                              : 'bg-red-50 text-red-800 border border-red-100'
                          }`}>
                            <p className="font-bold mb-1">{msg.feedback.isCorrect ? '✅ Correct!' : '❌ Not quite'}</p>
                            <p>{msg.feedback.text}</p>
                          </div>
                        )}
                        
                        <p className="font-medium text-lg leading-relaxed">{msg.text}</p>
                        
                        {msg.options && msg.options.length > 0 && (
                          <div className="grid grid-cols-1 gap-2 mt-4">
                            {msg.options.map((option, oIdx) => (
                              <button
                                key={oIdx}
                                onClick={() => onSendMessage(option)}
                                className="text-left px-4 py-2 rounded-xl border border-gray-200 hover:bg-indigo-50 hover:border-indigo-300 transition-all text-sm font-medium"
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {msg.role === 'model' && !msg.raw && msg.type !== 'quiz' && (
                  <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed overflow-hidden break-words">
                    <ReactMarkdown remarkGfm>
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                )}

                 {msg.role === 'user' && (
                   <div className="space-y-2">
                     <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed break-words">
                       {msg.text}
                     </div>
                     {msg.files && msg.files.length > 0 && (
                       <div className="flex flex-wrap gap-2 pt-2">
                         {msg.files.map((fileName, fIdx) => (
                           <div key={fIdx} className="flex items-center gap-1 px-2 py-1 bg-white/50 text-gray-600 text-[10px] font-medium rounded-md border border-gray-200">
                             <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                             </svg>
                             <span className="truncate max-w-[100px]">{fileName}</span>
                           </div>
                         ))}
                       </div>
                     )}
                   </div>
                 )}

                {msg.type === 'notes' && (
                  <div className="mt-6 flex justify-end">
                    <button 
                      onClick={onStartQuiz}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-all shadow-sm flex items-center gap-2"
                    >
                      <span>📝</span> Start Mock Quiz
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="max-w-[85%] md:max-w-2xl p-4 rounded-2xl bg-white border border-gray-200 text-gray-800 rounded-tl-none shadow-sm">
              <div className="flex items-center gap-3 text-gray-500">
                <span className="text-sm font-medium italic">Thinking</span>
                <div className="flex gap-1">
                  <div className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce"></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

       <div className="p-4 md:p-8 bg-gradient-to-t from-white via-white to-transparent">
         <form 
           onSubmit={handleSubmit}
           className="max-w-3xl mx-auto relative group"
         >
           {selectedFiles.length > 0 && (
             <div className="flex flex-wrap gap-2 mb-3">
               {selectedFiles.map((file, idx) => (
                 <div key={idx} className="flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-600 text-xs font-medium rounded-full border border-indigo-100 animate-in zoom-in-95 duration-200">
                   <span className="truncate max-w-[150px]">{file.name}</span>
                   <button type="button" onClick={() => removeFile(idx)} className="hover:text-indigo-800">
                     <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                       <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                     </svg>
                   </button>
                 </div>
               ))}
             </div>
           )}
           
           <div className="relative flex items-end gap-2">
             <label className="cursor-pointer p-3 rounded-xl border border-gray-300 bg-white text-gray-500 hover:bg-gray-50 hover:text-indigo-600 transition-all shadow-sm">
               <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
               </svg>
               <input type="file" multiple onChange={handleFileChange} className="hidden" />
             </label>
             
             <div className="relative flex-1">
               <textarea
                 ref={textareaRef}
                 value={input}
                 onChange={(e) => setInput(e.target.value)}
                 onKeyDown={handleKeyDown}
                 placeholder="Start a topic..."
                 rows="1"
                 className="w-full px-6 py-4 pr-16 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none shadow-sm transition-all bg-white resize-none min-h-[56px] max-h-[200px] overflow-y-auto"
                 disabled={isLoading}
               />
               <button
                 type="submit"
                 disabled={!isLoading && (!input.trim() && selectedFiles.length === 0)}
                 onClick={(e) => {
                   if (isLoading) {
                     e.preventDefault();
                     onStopGenerating();
                   }
                 }}
                 className={`absolute right-3 bottom-3 p-2 rounded-xl transition-all flex items-center justify-center ${
                   isLoading 
                     ? 'bg-red-500 text-white hover:bg-red-600' 
                     : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-300'
                 }`}
               >
                 {isLoading ? (
                   <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                     <rect x="6" y="6" width="12" height="12" rx="2" />
                   </svg>
                 ) : (
                   <span className="text-xl">↑</span>
                 )}
               </button>
             </div>
           </div>
         </form>
        <p className="text-center text-[10px] text-gray-400 mt-3">
          <span className="font-semibold">Studying + Cheating = Perfection.</span>
          <br />
          <span>-Julry</span>
        </p>
      </div>
    </div>
  );
};

export default ChatInterface;
