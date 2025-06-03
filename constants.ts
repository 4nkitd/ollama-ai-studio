export const APP_TITLE = "AI Chat Studio";

export const DEFAULT_SYSTEM_PROMPT = "You are a helpful AI assistant. Respond in Markdown format.";
export const DEFAULT_MODEL_NAME: string | null = null;

export const DEFAULT_TEMPERATURE = 0.7;
export const DEFAULT_TOP_P = 0.9;
export const DEFAULT_MAX_TOKENS = 1024; // Renamed to DEFAULT_NUM_PREDICT internally

// Ollama uses num_predict for max tokens in response
export const DEFAULT_NUM_PREDICT = DEFAULT_MAX_TOKENS; 

// Provider Types
export const PROVIDERS = {
  OLLAMA: 'ollama',
  OPENAI: 'openai',
  GEMINI: 'gemini',
  ANTHROPIC: 'anthropic',
  CUSTOM: 'custom'
} as const;

export type ProviderType = typeof PROVIDERS[keyof typeof PROVIDERS];

// Provider Configurations
export const PROVIDER_CONFIGS = {
  [PROVIDERS.OLLAMA]: {
    name: 'Ollama',
    defaultUrl: 'http://localhost:11434',
    apiPath: '/api/chat',
    requiresApiKey: false,
    supportsModelsEndpoint: true,
    modelsEndpoint: '/api/tags'
  },
  [PROVIDERS.OPENAI]: {
    name: 'OpenAI',
    defaultUrl: 'https://api.openai.com/v1',
    apiPath: '/chat/completions',
    requiresApiKey: true,
    supportsModelsEndpoint: true,
    modelsEndpoint: '/models'
  },
  [PROVIDERS.GEMINI]: {
    name: 'Gemini (OpenAI Compatible)',
    defaultUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiPath: '/chat/completions',
    requiresApiKey: true,
    supportsModelsEndpoint: false,
    modelsEndpoint: '/models'
  },
  [PROVIDERS.ANTHROPIC]: {
    name: 'Anthropic (OpenAI Compatible)',
    defaultUrl: 'https://api.anthropic.com/v1',
    apiPath: '/messages',
    requiresApiKey: true,
    supportsModelsEndpoint: false,
    modelsEndpoint: '/models'
  },
  [PROVIDERS.CUSTOM]: {
    name: 'Custom Provider',
    defaultUrl: 'http://localhost:8080/v1',
    apiPath: '/chat/completions',
    requiresApiKey: false,
    supportsModelsEndpoint: true,
    modelsEndpoint: '/models'
  }
} as const;

// Storage Keys
export const LOCALSTORAGE_PROVIDER_TYPE_KEY = 'aiStudio_providerType';
export const LOCALSTORAGE_PROVIDER_URL_KEY = 'aiStudio_providerUrl';
export const LOCALSTORAGE_PROVIDER_API_KEY = 'aiStudio_providerApiKey';
export const LOCALSTORAGE_CUSTOM_MODELS_KEY = 'aiStudio_customModels';

// Default Values
export const DEFAULT_PROVIDER_TYPE: ProviderType = PROVIDERS.OLLAMA;
export const DEFAULT_PROVIDER_URL = PROVIDER_CONFIGS[DEFAULT_PROVIDER_TYPE].defaultUrl;
export const DEFAULT_PROVIDER_API_KEY = '';

// Legacy support (for backwards compatibility)
export const LOCALSTORAGE_OLLAMA_URL_KEY = 'ollamaStudio_ollamaUrl';
export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
export const LOCALSTORAGE_OLLAMA_API_KEY = 'ollamaStudio_ollamaApiKey';  
export const DEFAULT_OLLAMA_API_KEY = '';

export const LOCALSTORAGE_LEFT_SIDEBAR_OPEN_KEY = 'aiStudio_leftSidebarOpen';
export const LOCALSTORAGE_RIGHT_SIDEBAR_OPEN_KEY = 'aiStudio_rightSidebarOpen';