import { useState, useEffect } from 'react';

const MAX_URL_LENGTH = 500;

const isValidApiUrl = (url) => {
  if (!url || url.length === 0) return { valid: true, error: '' };
  if (url.length > MAX_URL_LENGTH) return { valid: false, error: `Max ${MAX_URL_LENGTH} characters` };
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return { valid: false, error: 'Must start with http:// or https://' };
  }
  try {
    new URL(url);
    return { valid: true, error: '' };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
};

const CustomLLMModal = ({ isOpen, onClose, onSave, initialData = null }) => {
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [modelId, setModelId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [sendHistory, setSendHistory] = useState(false);
  const [urlError, setUrlError] = useState('');

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setBaseUrl(initialData.baseUrl || '');
      setModelId(initialData.modelId || '');
      setApiKey(initialData.apiKey || '');
      setSendHistory(initialData.sendHistory || false);
    } else {
      setName('');
      setBaseUrl('');
      setModelId('');
      setApiKey('');
      setSendHistory(false);
    }
    setUrlError('');
  }, [initialData, isOpen]);

  const handleBaseUrlChange = (value) => {
    setBaseUrl(value);
    const result = isValidApiUrl(value);
    setUrlError(result.error);
  };

  const isFormValid = () => {
    if (!name.trim() || !baseUrl.trim() || !modelId.trim()) return false;
    const { valid } = isValidApiUrl(baseUrl.trim());
    return valid;
  };

  const handleSave = () => {
    if (!isFormValid()) return;
    onSave({
      name: name.trim(),
      baseUrl: baseUrl.trim(),
      modelId: modelId.trim(),
      apiKey: apiKey.trim(),
      sendHistory,
    });
    onClose();
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-app-surface border border-app rounded-2xl shadow-2xl w-full max-w-md max-h-[95vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-app-surface border-b border-app px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between rounded-t-2xl">
          <div className="min-w-0">
            <h2 className="font-bold text-base sm:text-lg text-app">Add Custom LLM</h2>
            <p className="text-xs text-app-muted truncate">Configure OpenAI-compatible server</p>
          </div>
          <button
            onClick={onClose}
             className="p-1.5 hover:bg-[#7b9acc]/10 rounded-full transition-all text-app/60 hover:text-app shrink-0"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
          <p className="text-xs text-app-muted leading-relaxed">
            Add any OpenAI-compatible API provider with your own API key.
          </p>

          <div>
            <label className="block text-xs font-medium text-app/70 mb-1.5">
              Display Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., My OpenAI"
              className="w-full px-3 py-2 text-sm border border-app rounded-xl bg-app-surface focus:outline-none focus:ring-2 focus:ring-[#7b9acc] text-app placeholder:text-app-muted"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-app/70 mb-1.5">
              Base URL *
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => handleBaseUrlChange(e.target.value)}
              placeholder="e.g., https://api.openai.com/v1"
              className={`w-full px-3 py-2 text-sm border rounded-xl bg-app-surface focus:outline-none focus:ring-2 text-app placeholder:text-app-muted ${
                urlError
                  ? 'border-red-400 focus:ring-red-300'
                  : 'border-app focus:ring-[#7b9acc]'
              }`}
            />
            {urlError && <p className="text-xs text-red-500 mt-1">{urlError}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-app/70 mb-1.5">
              Model ID *
            </label>
            <input
              type="text"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              placeholder="e.g., llama3.2"
              className="w-full px-3 py-2 text-sm border border-app rounded-xl bg-app-surface focus:outline-none focus:ring-2 focus:ring-[#7b9acc] text-app placeholder:text-app-muted"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-app/70 mb-1.5">
              API Key <span className="text-app/40">(optional)</span>
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Leave blank if not required"
              className="w-full px-3 py-2 text-sm border border-app rounded-xl bg-app-surface focus:outline-none focus:ring-2 focus:ring-[#7b9acc] text-app placeholder:text-app-muted"
            />
          </div>

          <div className="bg-app-surface border border-app rounded-xl p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <label className="text-xs font-medium text-app/70 cursor-pointer">
                  Conversation History
                </label>
                <p className="text-[10px] text-app-muted mt-0.5 leading-relaxed">
                  {sendHistory
                    ? 'All messages sent to endpoint'
                    : 'Current message only'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={sendHistory}
                onClick={() => setSendHistory(!sendHistory)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#7b9acc] focus:ring-offset-2 ${
                  sendHistory ? 'bg-[#7b9acc]' : 'bg-app'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    sendHistory ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            {sendHistory && (
              <div className="mt-2.5 flex items-start gap-2 bg-warning border-warning rounded-lg px-2.5 py-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                <p className="text-[10px] text-warning leading-relaxed">
                  Your entire conversation will be sent to this external server. Only enable if you trust the provider.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-app-surface border-t border-app px-4 sm:px-6 py-3 sm:py-4 flex gap-3 rounded-b-2xl">
          <button
            onClick={onClose}
            className="flex-1 px-3 sm:px-4 py-2.5 sm:py-2 text-sm border border-app text-app rounded-xl hover:bg-[#7b9acc]/10 transition-all font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isFormValid()}
            className="flex-1 px-3 sm:px-4 py-2.5 sm:py-2 text-sm bg-[#7b9acc] text-white rounded-xl font-bold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Model
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomLLMModal;
