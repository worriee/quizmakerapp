import { useState, useCallback } from "react";
import {
  loadCustomModels,
  saveCustomModel as saveCustomModelUtil,
  deleteCustomModel as deleteCustomModelUtil,
} from "../utils/customModelStorage";

const MODEL_STORAGE_KEY = "quizmaker_selected_model";
const DEFAULT_MODEL = "gemini-3.1-flash-lite";

export function useCustomModels() {
  const [selectedModel, setSelectedModelState] = useState(() => {
    const saved = localStorage.getItem(MODEL_STORAGE_KEY);
    return saved || DEFAULT_MODEL;
  });
  const [customModels, setCustomModels] = useState(() => loadCustomModels());

  const setSelectedModel = useCallback((model) => {
    setSelectedModelState(model);
    localStorage.setItem(MODEL_STORAGE_KEY, model);
  }, []);

  const addCustomModel = useCallback((modelConfig) => {
    const savedModel = saveCustomModelUtil(modelConfig);
    setCustomModels(loadCustomModels());
    localStorage.setItem(MODEL_STORAGE_KEY, savedModel.id);
  }, []);

  const deleteCustomModel = useCallback((modelId) => {
    deleteCustomModelUtil(modelId);
    setCustomModels(loadCustomModels());
  }, []);

  const getCustomModelConfig = useCallback(
    (modelId) => {
      return customModels.find((m) => m.id === modelId) || null;
    },
    [customModels],
  );

  return {
    selectedModel,
    setSelectedModel,
    customModels,
    addCustomModel,
    deleteCustomModel,
    getCustomModelConfig,
  };
}
