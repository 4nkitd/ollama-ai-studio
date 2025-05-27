export const APP_TITLE = "Ollama AI Studio";

export const DEFAULT_SYSTEM_PROMPT = "You are a helpful AI assistant. Respond in Markdown format.";
export const DEFAULT_MODEL_NAME: string | null = null;

export const DEFAULT_TEMPERATURE = 0.7;
export const DEFAULT_TOP_P = 0.9;
export const DEFAULT_MAX_TOKENS = 1024; // Renamed to DEFAULT_NUM_PREDICT internally

// Ollama uses num_predict for max tokens in response
export const DEFAULT_NUM_PREDICT = DEFAULT_MAX_TOKENS; 

export const LOCALSTORAGE_OLLAMA_URL_KEY = 'ollamaStudio_ollamaUrl';
export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

export const LOCALSTORAGE_LEFT_SIDEBAR_OPEN_KEY = 'ollamaStudio_leftSidebarOpen';
export const LOCALSTORAGE_RIGHT_SIDEBAR_OPEN_KEY = 'ollamaStudio_rightSidebarOpen';