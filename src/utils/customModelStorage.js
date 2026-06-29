/**
 * Custom Model Storage Utility
 * Implements SEC-014: API Key Protection via sessionStorage isolation
 *
 * - localStorage: Stores model metadata (name, baseUrl, modelId) WITHOUT apiKeys
 * - sessionStorage: Stores API keys separately (cleared when browser tab closes)
 */

const CUSTOM_MODELS_KEY = "quizmaker_custom_models";
const API_KEYS_SESSION_KEY = "quizmaker_api_keys";

/**
 * Loads all custom models with API keys merged from sessionStorage.
 * @returns {Array} Array of model configs with apiKeys attached
 */
export function loadCustomModels() {
  try {
    const modelsRaw = localStorage.getItem(CUSTOM_MODELS_KEY);
    if (!modelsRaw) return [];

    const models = JSON.parse(modelsRaw);

    // Load API keys from sessionStorage
    const apiKeysRaw = sessionStorage.getItem(API_KEYS_SESSION_KEY);
    const apiKeys = apiKeysRaw ? JSON.parse(apiKeysRaw) : {};

    // Merge API keys back into models
    return models.map((model) => ({
      ...model,
      apiKey: apiKeys[model.id] || "",
    }));
  } catch (error) {
    console.error("Failed to load custom models:", error);
    return [];
  }
}

/**
 * Saves a custom model configuration.
 * API key is stripped before saving to localStorage.
 * API key is stored separately in sessionStorage.
 * @param {Object} modelConfig - Full model config including apiKey
 * @returns {Object} The saved model config (with empty apiKey for localStorage)
 */
export function saveCustomModel(modelConfig) {
  try {
    const { apiKey, ...metadata } = modelConfig;
    const modelWithId = {
      ...metadata,
      id: metadata.id || generateModelId(metadata),
    };

    // Load existing models
    const modelsRaw = localStorage.getItem(CUSTOM_MODELS_KEY);
    const models = modelsRaw ? JSON.parse(modelsRaw) : [];

    // Update or add model (metadata only, no apiKey)
    const updatedModels = models
      .filter((m) => m.id !== modelWithId.id)
      .concat({ ...modelWithId, apiKey: "" });

    // Save metadata to localStorage
    localStorage.setItem(CUSTOM_MODELS_KEY, JSON.stringify(updatedModels));

    // Save API key to sessionStorage
    const apiKeysRaw = sessionStorage.getItem(API_KEYS_SESSION_KEY);
    const apiKeys = apiKeysRaw ? JSON.parse(apiKeysRaw) : {};

    if (apiKey && apiKey.trim()) {
      apiKeys[modelWithId.id] = apiKey;
    } else {
      delete apiKeys[modelWithId.id];
    }
    sessionStorage.setItem(API_KEYS_SESSION_KEY, JSON.stringify(apiKeys));

    return modelWithId;
  } catch (error) {
    console.error("Failed to save custom model:", error);
    throw error;
  }
}

/**
 * Deletes a custom model and its API key.
 * @param {string} modelId - The model ID to delete
 */
export function deleteCustomModel(modelId) {
  try {
    // Remove from localStorage
    const modelsRaw = localStorage.getItem(CUSTOM_MODELS_KEY);
    if (modelsRaw) {
      const models = JSON.parse(modelsRaw);
      const updatedModels = models.filter((m) => m.id !== modelId);
      localStorage.setItem(CUSTOM_MODELS_KEY, JSON.stringify(updatedModels));
    }

    // Remove from sessionStorage
    const apiKeysRaw = sessionStorage.getItem(API_KEYS_SESSION_KEY);
    if (apiKeysRaw) {
      const apiKeys = JSON.parse(apiKeysRaw);
      delete apiKeys[modelId];
      sessionStorage.setItem(API_KEYS_SESSION_KEY, JSON.stringify(apiKeys));
    }
  } catch (error) {
    console.error("Failed to delete custom model:", error);
  }
}

/**
 * Gets a specific custom model config with API key attached.
 * @param {string} modelId - The model ID to retrieve
 * @returns {Object|null} Full model config or null if not found
 */
export function getCustomModelById(modelId) {
  const models = loadCustomModels();
  return models.find((m) => m.id === modelId) || null;
}

/**
 * Generates a unique model ID based on model config.
 * @param {Object} metadata - Model metadata (name, baseUrl, modelId)
 * @returns {string} Generated model ID
 */
function generateModelId(metadata) {
  const base = metadata.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `custom-${base}-${Date.now()}`;
}
