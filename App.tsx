import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Message, 
  OllamaParameters, 
  OllamaApiOptions,
  Conversation, 
  StoredMessage, 
  OllamaApiTagResponse, // Keep for Ollama specific parsing if needed, or adapt AIModel
  OllamaChatRequestBody,
  OllamaStreamChatResponse,
  OllamaStreamChatResponseDone,
  OllamaChatMessage,
  SystemPromptRecord,
  AIModel, // New generic model type
  ProviderType, // New provider type
  OpenAIChatRequest, // For OpenAI-compatible requests
  OpenAIChatResponse, // For OpenAI-compatible responses
  OpenAIMessage,
  ProviderState,
  CustomModel,
  CustomModelsByProvider
} from './types';
import { 
  DEFAULT_SYSTEM_PROMPT, 
  DEFAULT_TEMPERATURE, 
  DEFAULT_TOP_P, 
  DEFAULT_NUM_PREDICT,
  DEFAULT_MODEL_NAME,
  LOCALSTORAGE_LEFT_SIDEBAR_OPEN_KEY,
  LOCALSTORAGE_RIGHT_SIDEBAR_OPEN_KEY,
  PROVIDERS,
  PROVIDER_CONFIGS,
  LOCALSTORAGE_PROVIDER_TYPE_KEY,
  LOCALSTORAGE_PROVIDER_URL_KEY,
  LOCALSTORAGE_PROVIDER_API_KEY,
  LOCALSTORAGE_CUSTOM_MODELS_KEY,
  DEFAULT_PROVIDER_TYPE,
  DEFAULT_PROVIDER_API_KEY,
  // Legacy keys for migration
  LOCALSTORAGE_OLLAMA_URL_KEY,
  LOCALSTORAGE_OLLAMA_API_KEY,
} from './constants';
import LeftSidebar from './components/LeftSidebar';
import RightSidebar from './components/RightSidebar';
import ChatArea from './components/ChatArea';
import NetworkStatusIndicator from './components/NetworkStatusIndicator';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import OfflineQueueManager from './components/OfflineQueueManager';
import UpdateNotification from './components/UpdateNotification';
import { v4 as uuidv4 } from 'uuid';
import { 
  db, 
  getAllConversations, 
  getMessagesForConversation, 
  addConversation, 
  updateConversation, 
  deleteConversationAndMessages, 
  addMessage, 
  updateMessage,
  addSystemPrompt,
  getAllSystemPrompts,
  updateSystemPromptRecord,
  deleteSystemPromptRecord,
  // getSystemPrompt, // Not currently used, can be removed if not needed elsewhere
} from './db';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { usePWAInstall } from './hooks/usePWAInstall';
import { useServiceWorker } from './hooks/useServiceWorker';

const App = (): JSX.Element => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeSystemPrompt, setActiveSystemPrompt] = useState<string>(DEFAULT_SYSTEM_PROMPT);
  const [selectedModel, setSelectedModel] = useState<string | null>(DEFAULT_MODEL_NAME);
  const [parameters, setParameters] = useState<OllamaParameters>({
    temperature: DEFAULT_TEMPERATURE,
    topP: DEFAULT_TOP_P,
    num_predict: DEFAULT_NUM_PREDICT,
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  const [conversationsList, setConversationsList] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [currentConversationTokenCount, setCurrentConversationTokenCount] = useState<number | null>(null);

  // Provider State
  const [providerState, setProviderState] = useState<ProviderState>(() => {
    // Migration from old Ollama-specific keys
    const legacyOllamaUrl = localStorage.getItem(LOCALSTORAGE_OLLAMA_URL_KEY);
    const legacyOllamaApiKey = localStorage.getItem(LOCALSTORAGE_OLLAMA_API_KEY);

    const storedProviderType = localStorage.getItem(LOCALSTORAGE_PROVIDER_TYPE_KEY) as ProviderType | null;
    
    let initialType = storedProviderType || DEFAULT_PROVIDER_TYPE;
    let initialUrl = localStorage.getItem(LOCALSTORAGE_PROVIDER_URL_KEY);
    let initialApiKey = localStorage.getItem(LOCALSTORAGE_PROVIDER_API_KEY);

    if (!storedProviderType && legacyOllamaUrl) { // If no new provider type but old ollama URL exists, assume migration
      initialType = PROVIDERS.OLLAMA;
      initialUrl = legacyOllamaUrl;
      if (legacyOllamaApiKey) {
        initialApiKey = legacyOllamaApiKey;
      }
      // Store migrated values under new keys
      localStorage.setItem(LOCALSTORAGE_PROVIDER_TYPE_KEY, initialType);
      localStorage.setItem(LOCALSTORAGE_PROVIDER_URL_KEY, initialUrl);
      if (initialApiKey) {
        localStorage.setItem(LOCALSTORAGE_PROVIDER_API_KEY, initialApiKey);
      }
      // Optionally, remove old keys after migration
      // localStorage.removeItem(LOCALSTORAGE_OLLAMA_URL_KEY);
      // localStorage.removeItem(LOCALSTORAGE_OLLAMA_API_KEY);
    }
    
    const config = PROVIDER_CONFIGS[initialType as keyof typeof PROVIDER_CONFIGS] || PROVIDER_CONFIGS[DEFAULT_PROVIDER_TYPE];

    return {
      type: initialType,
      url: initialUrl || config.defaultUrl,
      apiKey: initialApiKey || DEFAULT_PROVIDER_API_KEY,
      models: [],
      customModels: [],
      status: 'idle',
      error: null,
      isFetchingModels: false,
    };
  });

  const [savedSystemPrompts, setSavedSystemPrompts] = useState<SystemPromptRecord[]>([]);
  const [selectedSystemPromptId, setSelectedSystemPromptId] = useState<string | null>(null); 

  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState<boolean>(() => {
    const storedValue = localStorage.getItem(LOCALSTORAGE_LEFT_SIDEBAR_OPEN_KEY);
    return storedValue ? JSON.parse(storedValue) : true;
  });
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState<boolean>(() => {
    const storedValue = localStorage.getItem(LOCALSTORAGE_RIGHT_SIDEBAR_OPEN_KEY);
    return storedValue ? JSON.parse(storedValue) : true;
  });

  // PWA and Network Hooks
  const { networkStatus, offlineQueue, isProcessingQueue } = useNetworkStatus();
  const pwaInstall = usePWAInstall(); // Destructure its properties where needed
  const serviceWorker = useServiceWorker(); // Destructure its properties where needed
  const [isOfflineQueueModalOpen, setIsOfflineQueueModalOpen] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    loadInitialData();
    return () => {
      isMounted.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(LOCALSTORAGE_LEFT_SIDEBAR_OPEN_KEY, JSON.stringify(isLeftSidebarOpen));
  }, [isLeftSidebarOpen]);

  useEffect(() => {
    localStorage.setItem(LOCALSTORAGE_RIGHT_SIDEBAR_OPEN_KEY, JSON.stringify(isRightSidebarOpen));
  }, [isRightSidebarOpen]);

  const toggleLeftSidebar = () => setIsLeftSidebarOpen(prev => !prev);
  const toggleRightSidebar = () => setIsRightSidebarOpen(prev => !prev);

  const loadInitialData = async () => {
    await loadConversationsFromDb();
    await loadSavedSystemPrompts();
    loadCustomModels();
    // fetchModels will be called by the useEffect watching providerState changes after initial state is set.
  };

  // useEffect to run loadInitialData once on mount
  useEffect(() => {
    if (isMounted.current) {
      loadInitialData();
    }
  }, []); // Empty dependency array ensures it runs only once on mount


  const fetchModels = useCallback(async (urlToFetch: string, type: ProviderType, apiKeyToUse: string) => {
    if (!isMounted.current) return;
    
    const config = PROVIDER_CONFIGS[type as keyof typeof PROVIDER_CONFIGS];
    if (!config.supportsModelsEndpoint || !config.modelsEndpoint) {
      // For providers that don't support model listing, provide default models
      let defaultModels: AIModel[] = [];
      
      if (type === PROVIDERS.GEMINI) {
        defaultModels = [
          { id: 'gemini-1.5-pro-latest', name: 'Gemini 1.5 Pro (Latest)', provider: type },
          { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: type },
          { id: 'gemini-1.5-flash-latest', name: 'Gemini 1.5 Flash (Latest)', provider: type },
          { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: type },
          { id: 'gemini-pro', name: 'Gemini Pro (Legacy)', provider: type },
        ];
      } else if (type === PROVIDERS.ANTHROPIC) {
        defaultModels = [
          { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: type },
          { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: type },
          { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', provider: type },
        ];
      }
      
      setProviderState(prev => ({
        ...prev,
        models: defaultModels,
        isFetchingModels: false,
        status: 'connected',
        error: null,
      }));
      return;
    }

    setProviderState(prev => ({ ...prev, isFetchingModels: true, error: null, status: 'connecting' })); // Don't clear models here, update on success/failure

    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      
      // Set up authentication headers based on provider
      if (apiKeyToUse) {
        if (type === PROVIDERS.ANTHROPIC) {
          headers['x-api-key'] = apiKeyToUse;
          headers['anthropic-version'] = '2023-06-01';
        } else {
          headers['Authorization'] = `Bearer ${apiKeyToUse}`;
        }
      }

      const response = await fetch(`${urlToFetch.replace(/\/+$/, '')}${config.modelsEndpoint}`, {
        signal: AbortSignal.timeout(15000),
        headers,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}. ${errorData}`);
      }

      let fetchedAImodels: AIModel[] = [];
      const data = await response.json();
      if (!isMounted.current) return;

      if (type === PROVIDERS.OLLAMA) {
        const ollamaData = data as OllamaApiTagResponse;
        fetchedAImodels = (ollamaData.models || []).map(m => ({
          id: m.name, // Ollama uses name as ID
          name: m.name,
          provider: type,
          model: m.model,
          modified_at: m.modified_at,
          size: m.size,
          digest: m.digest,
          details: m.details,
        }));
      } else {
        // Handle OpenAI-compatible providers (OpenAI, custom, etc.)
        if (data.data && Array.isArray(data.data)) {
          fetchedAImodels = data.data.map((m: any) => ({
            id: m.id,
            name: m.name || m.id,
            provider: type,
            created: m.created,
            owned_by: m.owned_by,
          })).sort((a: AIModel, b: AIModel) => a.name.localeCompare(b.name));
        } else if (data.models && Array.isArray(data.models)) {
          // Some providers might return models in a different format
          fetchedAImodels = data.models.map((m: any) => ({
            id: m.id || m.name,
            name: m.name || m.id,
            provider: type,
            created: m.created,
            owned_by: m.owned_by,
          })).sort((a: AIModel, b: AIModel) => a.name.localeCompare(b.name));
        }
      }
      // Add other provider-specific parsing here if needed

      setProviderState(prev => ({
        ...prev,
        models: fetchedAImodels,
        isFetchingModels: false,
        status: 'connected',
        error: null,
      }));
      // setSelectedModel logic is now handled by a dedicated useEffect
    } catch (error) {
      if (!isMounted.current) return;
      const errorMessage = error instanceof Error ? error.message : String(error);
      setProviderState(prev => ({
        ...prev,
        models: (networkStatus.isOnline || prev.models.length === 0) ? [] : prev.models, // Keep cached models if offline
        isFetchingModels: false,
        status: 'error',
        error: errorMessage,
      }));
      
      // Alerting logic can be improved or made less intrusive
      if (networkStatus.isOnline && isMounted.current && document.hidden === false && providerState.status !== 'error') {
        if (!errorMessage.toLowerCase().includes('failed to fetch') && !errorMessage.toLowerCase().includes('networkerror')) {
          // Debounce or make this a less intrusive notification
          // console.warn(`Error connecting to ${PROVIDER_CONFIGS[type].name} or fetching models: ${errorMessage.substring(0, 150)}...`);
          // For now, keeping alert for direct feedback:
           alert(`Error connecting to ${PROVIDER_CONFIGS[type as keyof typeof PROVIDER_CONFIGS].name} or fetching models: ${errorMessage.substring(0, 150)}...\\nPlease check the URL, API key, and ensure the server is running.`);
        }
      }
    }
  }, [networkStatus.isOnline]);

  const handleProviderTypeChange = useCallback((newType: ProviderType) => {
    if (isMounted.current) {
      const newConfig = PROVIDER_CONFIGS[newType as keyof typeof PROVIDER_CONFIGS];
      setProviderState(prev => {
        const updatedState = {
          ...prev,
          type: newType,
          url: newConfig.defaultUrl, // Reset to default URL for the new provider
          apiKey: '', // Reset API key when changing provider
          models: [], // Clear models
          customModels: [], // Clear custom models, will be loaded for new provider
          status: 'idle' as 'idle', // Explicitly type
          error: null,
        };
        localStorage.setItem(LOCALSTORAGE_PROVIDER_TYPE_KEY, newType);
        localStorage.setItem(LOCALSTORAGE_PROVIDER_URL_KEY, updatedState.url);
        localStorage.setItem(LOCALSTORAGE_PROVIDER_API_KEY, updatedState.apiKey); // Store empty API key
        fetchModels(updatedState.url, newType, updatedState.apiKey);
        return updatedState;
      });
      setSelectedModel(null); // Reset selected model
      
      // Load custom models for the new provider
      setTimeout(() => loadCustomModels(), 0);
    }
  }, [fetchModels, setProviderState, setSelectedModel]); // Added setProviderState, setSelectedModel

  const handleProviderUrlChange = useCallback((newUrl: string) => {
    if (isMounted.current) {
      setProviderState(prev => {
        const updatedState = { ...prev, url: newUrl, status: 'idle' as 'idle', error: null, models: [] }; // Reset status/models
        localStorage.setItem(LOCALSTORAGE_PROVIDER_URL_KEY, newUrl);
        // fetchModels will be called by the dedicated useEffect for providerState changes
        return updatedState;
      });
    }
  }, [setProviderState]); // fetchModels removed, will be triggered by effect

  const handleProviderApiKeyChange = useCallback((newApiKey: string) => {
    if (isMounted.current) {
      setProviderState(prev => {
        const updatedState = { ...prev, apiKey: newApiKey, status: 'idle' as 'idle', error: null, models: [] }; // Reset status/models
        localStorage.setItem(LOCALSTORAGE_PROVIDER_API_KEY, newApiKey);
        // fetchModels will be called by the dedicated useEffect for providerState changes
        return updatedState;
      });
    }
  }, [setProviderState]); // fetchModels removed, will be triggered by effect

  // Effect to fetch models when provider URL, type, or API key changes
  useEffect(() => {
    // Only fetch if url is set and the provider status allows (e.g., not already connecting or in error from the same change)
    // The 'idle' status is a good trigger, or if essential params change while not already fetching.
    if (isMounted.current && providerState.url && (providerState.status === 'idle' || providerState.status === 'connected' || providerState.status === 'error')) {
        fetchModels(providerState.url, providerState.type, providerState.apiKey);
    }
  }, [providerState.url, providerState.type, providerState.apiKey, fetchModels]); // Ensure fetchModels is stable


  // Effect to update selected model based on fetched models and current conversation
  useEffect(() => {
    if (!isMounted.current) return;

    const currentModels = [...providerState.models, ...providerState.customModels];
    const activeConversation = currentConversationId ? conversationsList.find(c => c.id === currentConversationId) : null;

    if (activeConversation) {
      // If a conversation is active
      if (activeConversation.providerType === providerState.type) { // Ensure provider types match
        const modelForConvo = activeConversation.selectedModel;
        if (modelForConvo && currentModels.some(m => m.id === modelForConvo)) {
          setSelectedModel(modelForConvo);
        } else if (currentModels.length > 0) {
          setSelectedModel(currentModels[0].id); // Fallback to first model of current provider
        } else {
          setSelectedModel(modelForConvo); // Keep convo model if no models listed (e.g. custom entry)
        }
      } else {
        // Provider type mismatch (e.g., conversation loaded with different provider than global state)
        // This case should be handled by the effect that loads conversation settings (updates global providerState)
        // For now, if models are available for current global provider, pick first, else null.
         if (currentModels.length > 0) {
            setSelectedModel(currentModels[0].id);
        } else {
            // Provider mismatch, but models for current global provider are available
            if (currentModels.length > 0) {
              setSelectedModel(currentModels[0].id);
            } else {
              setSelectedModel(null); // Or keep activeConversation.selectedModel if preferred, allowing user to try
            }
        }
      }
    } else {
      // No active conversation (e.g., new chat)
      // Set model based on current provider's available models
      if (currentModels.length > 0) {
        const currentModelStillValid = selectedModel && currentModels.some(m => m.id === selectedModel);
        if (!currentModelStillValid) {
             setSelectedModel(currentModels[0].id);
        }
        // If selectedModel is already valid for the current provider and its models, keep it.
      } else {
        // No models available for the current provider
        setSelectedModel(null);
      }
    }
  }, [providerState.models, providerState.customModels, providerState.type, currentConversationId, conversationsList, setSelectedModel, selectedModel]);


  const loadConversationsFromDb = async () => {
    const convos = await getAllConversations();
    if (isMounted.current) {
      setConversationsList(convos);
      if (!currentConversationId && convos.length === 0) { 
        // handleNewChat(); // This can cause issues if handleNewChat also modifies conversationsList
      } else if (!currentConversationId && convos.length > 0) {
        // handleNewChat(); // Defer this or ensure no recursive state updates
      }
      // Update token count if a conversation is loaded
      if (currentConversationId) {
        const currentConvo = convos.find(c => c.id === currentConversationId);
        setCurrentConversationTokenCount(currentConvo?.totalTokenCount ?? 0);
      }
    }
  };
  
  const loadSavedSystemPrompts = async () => {
    const prompts = await getAllSystemPrompts();
    if (isMounted.current) {
      setSavedSystemPrompts(prompts);
    }
  }; // This is loadSavedSystemPrompts, seems fine.

  const loadCustomModels = () => {
    try {
      const stored = localStorage.getItem(LOCALSTORAGE_CUSTOM_MODELS_KEY);
      if (stored) {
        const customModelsByProvider: CustomModelsByProvider = JSON.parse(stored);
        const currentProviderModels = customModelsByProvider[providerState.type] || [];
        
        const customAIModels: AIModel[] = currentProviderModels.map(cm => ({
          id: cm.id,
          name: cm.name,
          provider: cm.provider,
          isCustom: true,
        }));
        
        setProviderState(prev => ({
          ...prev,
          customModels: customAIModels,
        }));
      }
    } catch (error) {
      console.error('Failed to load custom models:', error);
    }
  };

  const saveCustomModels = (customModels: AIModel[]) => {
    try {
      const stored = localStorage.getItem(LOCALSTORAGE_CUSTOM_MODELS_KEY);
      const customModelsByProvider: CustomModelsByProvider = stored ? JSON.parse(stored) : {};
      
      const customModelList: CustomModel[] = customModels.map(model => ({
        id: model.id,
        name: model.name,
        provider: model.provider,
        addedAt: new Date(),
      }));
      
      customModelsByProvider[providerState.type] = customModelList;
      localStorage.setItem(LOCALSTORAGE_CUSTOM_MODELS_KEY, JSON.stringify(customModelsByProvider));
    } catch (error) {
      console.error('Failed to save custom models:', error);
    }
  };

  const handleAddCustomModel = useCallback((modelId: string, modelName: string) => {
    if (!isMounted.current) return;
    
    const newCustomModel: AIModel = {
      id: modelId,
      name: modelName,
      provider: providerState.type,
      isCustom: true,
    };
    
    setProviderState(prev => {
      const updatedCustomModels = [...prev.customModels, newCustomModel];
      saveCustomModels(updatedCustomModels);
      return {
        ...prev,
        customModels: updatedCustomModels,
      };
    });
  }, [providerState.type]);

  const handleRemoveCustomModel = useCallback((modelId: string) => {
    if (!isMounted.current) return;
    
    setProviderState(prev => {
      const updatedCustomModels = prev.customModels.filter(model => model.id !== modelId);
      saveCustomModels(updatedCustomModels);
      return {
        ...prev,
        customModels: updatedCustomModels,
      };
    });
  }, []);

  const handleTestConnection = useCallback(async (): Promise<boolean> => {
    if (!isMounted.current) return false;
    
    try {
      const config = PROVIDER_CONFIGS[providerState.type as keyof typeof PROVIDER_CONFIGS];
      
      // Check if API key is required but missing
      if (config.requiresApiKey && !providerState.apiKey.trim()) {
        throw new Error(`API key is required for ${config.name}`);
      }

      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      
      // Set up authentication headers
      if (providerState.apiKey) {
        if (providerState.type === PROVIDERS.ANTHROPIC) {
          headers['x-api-key'] = providerState.apiKey;
          headers['anthropic-version'] = '2023-06-01';
        } else {
          headers['Authorization'] = `Bearer ${providerState.apiKey}`;
        }
      }

      // Try to make a simple test request
      let testEndpoint = '';
      let testBody = {};

      if (providerState.type === PROVIDERS.OLLAMA) {
        testEndpoint = `${providerState.url.replace(/\/+$/, '')}/api/tags`;
        const response = await fetch(testEndpoint, { 
          headers,
          signal: AbortSignal.timeout(10000)
        });
        return response.ok;
      } else {
        // For OpenAI-compatible providers, try a simple chat completion
        testEndpoint = `${providerState.url.replace(/\/+$/, '')}${config.apiPath}`;
        testBody = {
          model: providerState.models[0]?.id || 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 1
        };
        
        const response = await fetch(testEndpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(testBody),
          signal: AbortSignal.timeout(10000)
        });
        
        return response.ok;
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }, [providerState.type, providerState.url, providerState.apiKey, providerState.models]);

  useEffect(() => {
    if (currentConversationId && isMounted.current) {
      const activeConversation = conversationsList.find(c => c.id === currentConversationId);
      if (activeConversation) {
        // Update provider state to match conversation's provider settings
        if (activeConversation.providerType !== providerState.type || activeConversation.providerUrl !== providerState.url) {
          setProviderState(prev => ({
            ...prev,
            type: activeConversation.providerType,
            url: activeConversation.providerUrl,
            status: 'idle',
            error: null,
            models: []
          }));
        }
        
        // Update conversation-specific settings
        setActiveSystemPrompt(activeConversation.systemPrompt);
        setSelectedModel(activeConversation.selectedModel);
        setParameters(activeConversation.parameters);
        setCurrentConversationTokenCount(activeConversation.totalTokenCount || 0);
        
        // Load messages for this conversation
        const loadMessages = async () => {
          const msgs = await getMessagesForConversation(currentConversationId);
          if (isMounted.current) {
            setMessages(msgs);
          }
        };
        loadMessages();
      }
    } else if (!currentConversationId && isMounted.current) {
      // No active conversation, clear messages
      setMessages([]);
      setCurrentConversationTokenCount(null);
    }
  }, [currentConversationId, conversationsList, providerState.type, providerState.url]);

  const simulateUserMessageTokens = (text: string): number => {
    return Math.round(text.split(/\s+/).length * 1.3); 
  };

  const handleSendMessage = useCallback(async (userInput: string) => {
    if (!userInput.trim()) return;
    if (!selectedModel) {
      alert("Please select a model first.");
      return;
    }

    // Offline handling: if offline and chat is not available, queue the message
    if (!networkStatus.isOnline) {
      let conversationIdForQueue = currentConversationId;
      let isNewOfflineChat = false;

      if (!conversationIdForQueue) {
        // Create a new conversation ID for this offline message
        conversationIdForQueue = uuidv4();
        isNewOfflineChat = true;
        
        // Create and save the new conversation immediately
        let title = `Chat (Offline) - ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        const firstWords = userInput.substring(0, 30).split(' ').slice(0,5).join(' ');
        if (firstWords) title = firstWords + "...";
        
        const newConversation: Conversation = {
            id: conversationIdForQueue,
            title: title,
            createdAt: new Date(),
            updatedAt: new Date(),
            systemPrompt: activeSystemPrompt,
            selectedModel: selectedModel || DEFAULT_MODEL_NAME, // Ensure selectedModel is not null
            providerType: providerState.type,
            providerUrl: providerState.url,
            parameters,
            totalTokenCount: 0,
        };
        await addConversation(newConversation);
        // No need to await setCurrentConversationId if we use conversationIdForQueue directly
        // setCurrentConversationId(conversationIdForQueue); // This will update UI if needed
        setConversationsList(prev => [newConversation, ...prev].sort((a,b) => b.updatedAt.getTime() - a.updatedAt.getTime()));
      }
      
      // Ensure conversationIdForQueue is a string before calling offlineQueue.add
      if (conversationIdForQueue) {
         const queuedMessageId = offlineQueue.add({ // offlineQueue.add comes from useNetworkStatus hook
          conversationId: conversationIdForQueue, 
          content: userInput,
          timestamp: new Date(),
        }) as unknown as string; // Force cast due to incorrect interface in useNetworkStatus
        
        const userMessageForUi: Message = {
          id: queuedMessageId, 
          role: 'user',
          content: userInput,
          timestamp: new Date(),
          tokens: { prompt: 0, completion: 0, total: 0 },
          isLoading: true, 
        };
        setMessages(prev => [...prev, userMessageForUi]);

        if (isNewOfflineChat && conversationIdForQueue) {
          // If it was a new chat, set it as current after adding the message
          setCurrentConversationId(conversationIdForQueue);
        }
        
        alert("You are offline. Your message has been queued and will be sent when connection is restored.");
        return;
      } else {
        // This case should ideally not be reached if new offline chats are handled
        alert("You are offline and unable to queue message. Please check your connection or try again.");
        return;
      }
    }
    
    // If online, proceed with normal sending logic
    const currentProviderConfig = PROVIDER_CONFIGS[providerState.type as keyof typeof PROVIDER_CONFIGS];
    
    // Check if API key is required but missing
    if (currentProviderConfig.requiresApiKey && !providerState.apiKey.trim()) {
      alert(`API key is required for ${currentProviderConfig.name}. Please enter your API key in the settings.`);
      return;
    }
    
    if (providerState.status !== 'connected' || (currentProviderConfig.supportsModelsEndpoint && providerState.models.length === 0)) {
      if (providerState.status !== 'connected') {
        alert(`${currentProviderConfig.name} server is not connected. Please check settings.`);
      } else {
        alert(`No models available for ${currentProviderConfig.name} or provider not configured to list models. Please check settings or select/enter a model name directly.`);
      }
      return;
    }

    setIsLoading(true);
    abortControllerRef.current = new AbortController();
    let activeConversationId = currentConversationId;
    
    const timestamp = new Date();

    if (!activeConversationId) {
      const newConvId = uuidv4();
      let title = `Chat - ${timestamp.toLocaleDateString()} ${timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      const firstWords = userInput.substring(0, 30).split(' ').slice(0,5).join(' ');
      if (firstWords) title = firstWords + "...";


      const newConversation: Conversation = {
        id: newConvId,
        title: title,
        createdAt: timestamp,
        updatedAt: timestamp,
        systemPrompt: activeSystemPrompt,
        selectedModel,
        providerType: providerState.type,
        providerUrl: providerState.url,
        parameters,
        totalTokenCount: 0, // Initialize token count
      };
      await addConversation(newConversation);
      if (!isMounted.current) return;
      activeConversationId = newConvId;
      setCurrentConversationId(newConvId);
      setConversationsList(prev => [newConversation, ...prev].sort((a,b) => b.updatedAt.getTime() - a.updatedAt.getTime()));
    } else {
      await updateConversation(activeConversationId, { updatedAt: timestamp, selectedModel, systemPrompt: activeSystemPrompt, parameters });
      if (isMounted.current) {
         setConversationsList(prev => prev.map(c => c.id === activeConversationId ? {...c, updatedAt: timestamp, selectedModel, systemPrompt: activeSystemPrompt, parameters} : c).sort((a,b) => b.updatedAt.getTime() - a.updatedAt.getTime()));
      }
    }
    
    if (!activeConversationId) {
        setIsLoading(false);
        console.error("Failed to get active conversation ID");
        return;
    }

    // Calculate initial token count for the new conversation or update existing
    let conversationTokenCount = conversationsList.find(c => c.id === activeConversationId)?.totalTokenCount ?? 0;

    const userMessageId = uuidv4();
    const userMessageForUi: Message = {
      id: userMessageId,
      role: 'user',
      content: userInput,
      timestamp: timestamp,
      tokens: { 
        prompt: simulateUserMessageTokens(userInput) + simulateUserMessageTokens(activeSystemPrompt), 
        completion: 0,
        total: simulateUserMessageTokens(userInput) + simulateUserMessageTokens(activeSystemPrompt),
      }
    };
    const { isLoading: _removedIsLoadingUser, isThinking: _removedIsThinkingUser, ...userMessageForDbData } = userMessageForUi;
    const userMessageForDb: StoredMessage = {
        ...(userMessageForDbData as Omit<Message, 'isLoading' | 'isThinking' | 'model'>), 
        conversationId: activeConversationId, // activeConversationId must be string here
    };

    await addMessage(userMessageForDb);
    if (!isMounted.current) return;
    
    // Important: ensure messages state is updated after user message is added, BEFORE assistant placeholder
    setMessages(prevMessages => [...prevMessages, userMessageForUi]);
    // Create a snapshot of messages to pass to ollamaMessagesHistory
    const currentMessagesWithUserForHistory = [...messages, userMessageForUi];


    const assistantMessageId = uuidv4();
    const assistantMessagePlaceholder: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      model: selectedModel, // selectedModel must be string
      timestamp: new Date(timestamp.getTime() + 1),
      isLoading: true,
      isThinking: false, 
      tokens: { prompt: 0, completion: 0, total: 0 }
    };
    const { isLoading: _removedIsLoadingAssistant, isThinking: _removedIsThinkingAssistant, ...placeholderDataForDb } = assistantMessagePlaceholder;
    const assistantMessagePlaceholderForDb: StoredMessage = {
      ...(placeholderDataForDb as Omit<Message, 'isLoading' | 'isThinking' | 'model'>),
      model: selectedModel, // selectedModel must be string
      conversationId: activeConversationId, // activeConversationId must be string
    };

    await addMessage(assistantMessagePlaceholderForDb);
    if (!isMounted.current) return;
    setMessages(prev => [...prev, assistantMessagePlaceholder]);
    
    let requestBody: OllamaChatRequestBody | OpenAIChatRequest;
    let apiEndpoint = `${providerState.url.replace(/\/+$/, '')}${PROVIDER_CONFIGS[providerState.type].apiPath}`;

    const commonMessages: OpenAIMessage[] = []; // Use OpenAI message format as a base, adapt if needed
    if (activeSystemPrompt) {
      commonMessages.push({ role: 'system', content: activeSystemPrompt });
    }
    currentMessagesWithUserForHistory.forEach(msg => {
      if (!msg.isLoading) {
        commonMessages.push({ role: msg.role, content: msg.content });
      }
    });

    if (providerState.type === PROVIDERS.OLLAMA) {
      const ollamaOptions: OllamaApiOptions = {
        temperature: parameters.temperature,
        top_p: parameters.topP,
        num_predict: parameters.num_predict > 0 ? parameters.num_predict : undefined,
      };
      
      requestBody = {
        model: selectedModel!,
        messages: commonMessages as OllamaChatMessage[], // Ollama type is compatible here
        stream: true,
        options: ollamaOptions,
      };
    } else { // OpenAI-compatible
      requestBody = {
        model: selectedModel!,
        messages: commonMessages,
        stream: true,
        temperature: parameters.temperature,
        top_p: parameters.topP,
        max_tokens: parameters.num_predict > 0 ? parameters.num_predict : undefined,
        // stop: ... // if you want to add stop sequences
      };
    }

    // For processing <think> tags
    let currentVisibleContent = ""; 
    let currentThinkingContent = "";
    let inThinkBlock = false; 

    let finalTokenData = { prompt: 0, completion: 0, total: 0 };
    // let finalContext: number[] | undefined = undefined; // For Ollama context if needed

    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      
      // Set up authentication headers based on provider
      if (providerState.apiKey) {
        if (providerState.type === PROVIDERS.ANTHROPIC) {
          headers['x-api-key'] = providerState.apiKey;
          headers['anthropic-version'] = '2023-06-01';
        } else {
          headers['Authorization'] = `Bearer ${providerState.apiKey}`;
        }
      }
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${PROVIDER_CONFIGS[providerState.type as keyof typeof PROVIDER_CONFIGS].name} API Error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      if (!response.body) throw new Error("Response body is null");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        if (!isMounted.current || abortControllerRef.current?.signal.aborted) { if(reader && !reader.closed) reader.cancel("Component unmounted or aborted").catch(()=>{/* ignore */}); break; }
        const { done, value } = await reader.read();
        if (done) break;

        const chunkText = decoder.decode(value, { stream: true });
        const lines = chunkText.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (!isMounted.current || abortControllerRef.current?.signal.aborted) { if(reader && !reader.closed) reader.cancel("Component unmounted or aborted mid-chunk").catch(()=>{/* ignore */}); break; }
          
          // Handle SSE format - lines start with "data: "
          if (!line.startsWith('data: ')) continue;
          
          const jsonData = line.slice(6); // Remove "data: " prefix
          
          // Handle the [DONE] signal
          if (jsonData === '[DONE]') {
            // Stream is complete - finalize the message
            if (isMounted.current) {
              setMessages(prevMessages =>
                prevMessages.map(msg =>
                  msg.id === assistantMessageId ? { 
                    ...msg, 
                    isThinking: false, 
                    isLoading: false,
                    tokens: finalTokenData,
                    thinkingContent: currentThinkingContent
} : msg
                )
              );
            }
            break;
          }
          
          try {
            const streamPart = JSON.parse(jsonData);
            let chunkContent = "";
            let isDone = false;
            let streamPromptTokens: number | undefined = undefined;
            let streamCompletionTokens: number | undefined = undefined;
            let streamTotalTokens: number | undefined = undefined;

            if (providerState.type === PROVIDERS.OLLAMA) {
              const ollamaStreamPart = streamPart as OllamaStreamChatResponse;
              chunkContent = ollamaStreamPart.message?.content || "";
              isDone = ollamaStreamPart.done;
              if (isDone) {
                const doneResponse = ollamaStreamPart as OllamaStreamChatResponseDone;
                streamPromptTokens = doneResponse.prompt_eval_count;
                streamCompletionTokens = doneResponse.eval_count;
                // finalContext = doneResponse.context; 
              }
            } else { // OpenAI-compatible
              const openAIStreamPart = streamPart as OpenAIChatResponse; // Streamed chunks are also OpenAIChatResponse
              chunkContent = openAIStreamPart.choices?.[0]?.delta?.content || "";
              isDone = openAIStreamPart.choices?.[0]?.finish_reason !== null && openAIStreamPart.choices?.[0]?.finish_reason !== undefined;
              if (isDone && openAIStreamPart.usage) { // Final chunk with usage for some providers
                streamPromptTokens = openAIStreamPart.usage.prompt_tokens;
                streamCompletionTokens = openAIStreamPart.usage.completion_tokens;
                streamTotalTokens = openAIStreamPart.usage.total_tokens;
              }
            }
            
            if (chunkContent) {
              let visibleChunkSegment = ""; 

              while (chunkContent.length > 0) {
                  if (inThinkBlock) {
                      const thinkEndIndex = chunkContent.indexOf("</think>");
                      if (thinkEndIndex !== -1) {
                          // Capture the remaining thinking content before the closing tag
                          currentThinkingContent += chunkContent.substring(0, thinkEndIndex);
                          chunkContent = chunkContent.substring(thinkEndIndex + "</think>".length);
                          inThinkBlock = false;
                          if (isMounted.current) {
                              setMessages(prevMessages =>
                                  prevMessages.map(msg =>
                                      msg.id === assistantMessageId ? { 
                                          ...msg, 
                                          isThinking: false,
                                          thinkingContent: currentThinkingContent
                                      } : msg
                                  )
                              );
                          }
                      } else {
                          // Still in thinking block, capture all content
                          currentThinkingContent += chunkContent;
                          chunkContent = ""; 
                      }
                  } else { // Not in a think block
                      const thinkStartIndex = chunkContent.indexOf("<think>");
                      if (thinkStartIndex !== -1) {
                          visibleChunkSegment += chunkContent.substring(0, thinkStartIndex);
                          chunkContent = chunkContent.substring(thinkStartIndex + "<think>".length);
                          inThinkBlock = true;
                          if (isMounted.current) {
                              setMessages(prevMessages =>
                                  prevMessages.map(msg =>
                                      msg.id === assistantMessageId ? { 
                                          ...msg, 
                                          isThinking: true,
                                          thinkingContent: currentThinkingContent
                                      } : msg
                                  )
                              );
                          }
                      } else {
                          visibleChunkSegment += chunkContent;
                          chunkContent = ""; 
                      }
                  }
              }
              
              if (visibleChunkSegment) {
                  currentVisibleContent += visibleChunkSegment;
              }

              if (isMounted.current) {
                setMessages(prevMessages =>
                  prevMessages.map(msg =>
                    msg.id === assistantMessageId ? { 
                        ...msg, 
                        content: currentVisibleContent,
                        isLoading: true,
                        thinkingContent: currentThinkingContent
                        // isThinking is updated above
                    } : msg
                  )
                );
              }
            }

            if (isDone || (providerState.type === PROVIDERS.OLLAMA && streamPart.done)) {
              // Use tokens from stream if available, otherwise simulate
              const promptTokens = streamPromptTokens ?? simulateUserMessageTokens(activeSystemPrompt) + simulateUserMessageTokens(userInput);
              const completionTokens = streamCompletionTokens ?? simulateUserMessageTokens(currentVisibleContent);
              finalTokenData = {
                prompt: promptTokens,
                completion: completionTokens,
                total: streamTotalTokens ?? (promptTokens + completionTokens),
              };
              // Ensure isThinking is false on completion
              if (isMounted.current) {
                setMessages(prevMessages =>
                    prevMessages.map(msg =>
                        msg.id === assistantMessageId ? { 
                            ...msg, 
                            isThinking: false, 
                            isLoading: false,
                            thinkingContent: currentThinkingContent
                        } : msg
                    )
                );
              }
              // Update conversation total token count
              if (activeConversationId) {
                const newTotalTokenCount = conversationTokenCount + finalTokenData.total;
                await updateConversation(activeConversationId, { totalTokenCount: newTotalTokenCount });
                setCurrentConversationTokenCount(newTotalTokenCount);
                // Update in local list as well for immediate UI update if needed
                setConversationsList(prev => prev.map(c => c.id === activeConversationId ? {...c, totalTokenCount: newTotalTokenCount, updatedAt: new Date()} : c).sort((a,b) => b.updatedAt.getTime() - a.updatedAt.getTime()));
              }
            }
          } catch (e) {
            console.error("Error parsing stream chunk:", e, "Chunk:", line);
          }
        }
         if ((!isMounted.current || abortControllerRef.current?.signal.aborted) && reader && !reader.closed) { reader.cancel("Component unmounted or aborted post-chunk").catch(()=>{/* ignore */}); break; }
      }
      
      if (!isMounted.current) return;

      if (!abortControllerRef.current?.signal.aborted) {
        setMessages(prevMessages =>
          prevMessages.map(msg =>
            msg.id === assistantMessageId
              ? { ...msg, isLoading: false, isThinking: false, content: currentVisibleContent, tokens: finalTokenData }
              : msg
          )
        );
        await updateMessage(assistantMessageId, { content: currentVisibleContent, tokens: finalTokenData, model: selectedModel });
        if (activeConversationId) {
            // Token count is updated when streamPart.done is true, only update updatedAt here
            await updateConversation(activeConversationId, { updatedAt: new Date() }); 
            if (isMounted.current) {
                // loadConversationsFromDb(); // Already updated in streamPart.done
            }
        }
      }
    } catch (error) {
      if (!isMounted.current) return;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error sending message to ${PROVIDER_CONFIGS[providerState.type as keyof typeof PROVIDER_CONFIGS].name}:`, errorMessage);
      
      if (!abortControllerRef.current?.signal.aborted || errorMessage !== "The user aborted a request.") {
        setMessages(prevMessages =>
            prevMessages.map(msg =>
            msg.id === assistantMessageId
                ? { ...msg, isLoading: false, isThinking: false, content: `Error: ${errorMessage.substring(0,200)}...`, tokens: {prompt:0, completion:0, total:0} }
                : msg
            )
        );
        await updateMessage(assistantMessageId, { content: `Error: ${errorMessage.substring(0,200)}...` , model: selectedModel || undefined}); // Ensure model can be undefined if selectedModel is null
        if(isMounted.current && document.hidden === false && !abortControllerRef.current?.signal.aborted) { // Check if not aborted before alerting
          alert(`Failed to get response from ${PROVIDER_CONFIGS[providerState.type as keyof typeof PROVIDER_CONFIGS].name}: ${errorMessage}`);
        }
      }
    } finally {
      if (isMounted.current) {
         setIsLoading(false);
         // Only nullify if it's not already nullified by stop generation
         if (abortControllerRef.current && abortControllerRef.current.signal.reason !== "User cancelled generation.") {
             abortControllerRef.current = null; 
         }
      }
    }
  }, [currentConversationId, activeSystemPrompt, selectedModel, parameters, providerState, messages, loadConversationsFromDb, setIsLoading, setMessages, setCurrentConversationTokenCount, setConversationsList, simulateUserMessageTokens]);

  const handleNewChat = useCallback(() => {
    if (isMounted.current) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort("Starting new chat.");
        abortControllerRef.current = null;
      }
      setMessages([]);
      setCurrentConversationId(null);
      setCurrentConversationTokenCount(0); 
      setActiveSystemPrompt(DEFAULT_SYSTEM_PROMPT);
      setSelectedSystemPromptId(null); 
      setSelectedModel(providerState.models[0]?.id ?? null);
      setParameters({
        temperature: DEFAULT_TEMPERATURE,
        topP: DEFAULT_TOP_P,
        num_predict: DEFAULT_NUM_PREDICT,
      });
      setIsLoading(false);
    }
  }, [providerState.models, setActiveSystemPrompt, setCurrentConversationId, setCurrentConversationTokenCount, setIsLoading, setMessages, setParameters, setSelectedModel, setSelectedSystemPromptId]); // Added missing dependencies
  
  const handleLoadConversation = useCallback(async (conversationToLoad: Conversation) => {
    if (!isMounted.current) return;
    if (abortControllerRef.current) {
        abortControllerRef.current.abort("Loading another conversation.");
        abortControllerRef.current = null;
    }
    setIsLoading(true); 
    try {
      const [convoDetails, convoMessages] = await Promise.all([
        db.conversations.get(conversationToLoad.id),
        getMessagesForConversation(conversationToLoad.id)
      ]);

      if (!isMounted.current) return; // Check isMounted again after await
      if (convoDetails) {
        setCurrentConversationId(convoDetails.id);
        setActiveSystemPrompt(convoDetails.systemPrompt);
        setSelectedModel(convoDetails.selectedModel);
        setParameters(convoDetails.parameters);
        setMessages(convoMessages.map((m: StoredMessage) => ({...m, isLoading: false, isThinking: false, timestamp: new Date(m.timestamp)} as Message)));
        
        const matchingSavedPrompt = savedSystemPrompts.find((p: SystemPromptRecord) => p.prompt === convoDetails.systemPrompt);
        setSelectedSystemPromptId(matchingSavedPrompt ? matchingSavedPrompt.id : null);
        setCurrentConversationTokenCount(convoDetails.totalTokenCount ?? 0); 

      } else {
        setConversationsList((prev: Conversation[]) => prev.filter(c => c.id !== conversationToLoad.id));
        handleNewChat();
      }
    } catch (error) {
      console.error("Error loading conversation:", error);
      handleNewChat(); // Ensure this doesn't cause issues if component is unmounting
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  }, [handleNewChat, savedSystemPrompts, setActiveSystemPrompt, setCurrentConversationId, setCurrentConversationTokenCount, setIsLoading, setMessages, setParameters, setSelectedModel, setSelectedSystemPromptId, setConversationsList]); // Added missing dependencies

  const handleDeleteConversation = useCallback(async (conversationIdToDelete: string) => {
    if (!isMounted.current) return;
    await deleteConversationAndMessages(conversationIdToDelete);
    if (!isMounted.current) return; // Check isMounted again after await
    setConversationsList((prev: Conversation[]) => prev.filter(c => c.id !== conversationIdToDelete));
    if (currentConversationId === conversationIdToDelete) {
      handleNewChat();
    }
  }, [currentConversationId, handleNewChat, setConversationsList]); // Added missing dependencies


  const handleParameterChange = useCallback(<K extends keyof OllamaParameters,>(param: K, value: OllamaParameters[K]) => {
    if (isMounted.current) {
      setParameters((prev: OllamaParameters) => ({ ...prev, [param]: value }));
    }
  }, [setParameters]); // Added missing dependencies

  const handleDownloadChat = useCallback(async () => {
    if (!currentConversationId) {
      alert("No active conversation to download.");
      return;
    }
    // currentConversationId is guaranteed to be a string here.
    const conversation = await db.conversations.get(currentConversationId as string);
    const chatMessages = await getMessagesForConversation(currentConversationId as string);

    if (!conversation) {
        alert("Could not find conversation data.");
        return;
    }

    const dataToDownload = {
      conversation: {
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt.toISOString(),
        systemPrompt: conversation.systemPrompt,
        selectedModel: conversation.selectedModel,
        parameters: conversation.parameters,
      },
      messages: chatMessages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        model: m.model,
        timestamp: m.timestamp.toISOString(),
        tokens: m.tokens,
      })),
    };

    const jsonString = JSON.stringify(dataToDownload, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `${conversation.title.replace(/[\\?%*:|"<>]/g, '_') || 'chat_export'}_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);

  }, [currentConversationId]); // No state setters, should be fine

  const handleStopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort("User cancelled generation.");
      setMessages((prev: Message[]) => prev.map(msg => {
        if (msg.isLoading && msg.role === 'assistant') {
          return { ...msg, isLoading: false, isThinking: false, content: (msg.content || "") + "\\n\\n[Generation stopped by user]" };
        }
        return msg;
      }));
      setIsLoading(false); 
      abortControllerRef.current = null; 
    }
  }, [setIsLoading, setMessages]); // Added missing dependencies

  const handleSaveNewSystemPrompt = async (title: string, prompt: string) => {
    if (!title.trim() || !prompt.trim()) {
        alert("Title and prompt content are required.");
        return false;
    }
    const newPromptRecord: SystemPromptRecord = {
        id: uuidv4(),
        title,
        prompt,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    await addSystemPrompt(newPromptRecord);
    if (isMounted.current) { // Check isMounted again after await
        await loadSavedSystemPrompts(); 
        setSelectedSystemPromptId(newPromptRecord.id); 
        setActiveSystemPrompt(prompt); 
    }
    return true;
  }; // Missing dependencies: loadSavedSystemPrompts, setSelectedSystemPromptId, setActiveSystemPrompt

  const handleUpdateSavedSystemPrompt = async (id: string, title: string, prompt: string) => {
    if (!title.trim() || !prompt.trim()) {
        alert("Title and prompt content are required.");
        return false;
    }
    await updateSystemPromptRecord(id, { title, prompt });
    if (isMounted.current) { // Check isMounted again after await
        await loadSavedSystemPrompts(); 
        if (selectedSystemPromptId === id) {
            setActiveSystemPrompt(prompt);
        }
    }
    return true;
  }; // Missing dependencies: loadSavedSystemPrompts, selectedSystemPromptId, setActiveSystemPrompt

  const handleDeleteSavedSystemPrompt = async (id: string) => {
    await deleteSystemPromptRecord(id);
    if (isMounted.current) { // Check isMounted again after await
        await loadSavedSystemPrompts(); 
        if (selectedSystemPromptId === id) {
            setSelectedSystemPromptId(null);
            setActiveSystemPrompt(DEFAULT_SYSTEM_PROMPT); 
        }
    }
  }; // Missing dependencies: loadSavedSystemPrompts, selectedSystemPromptId, setSelectedSystemPromptId, setActiveSystemPrompt

  const handleSelectSavedSystemPrompt = (promptId: string | null) => {
    if (promptId) {
        const selected = savedSystemPrompts.find((p: SystemPromptRecord) => p.id === promptId);
        if (selected) {
            setSelectedSystemPromptId(selected.id);
            setActiveSystemPrompt(selected.prompt);
        }
    } else { 
        setSelectedSystemPromptId(null);
        // setActiveSystemPrompt(DEFAULT_SYSTEM_PROMPT); // Optionally revert to default
    }
  }; // Missing dependencies: savedSystemPrompts, setSelectedSystemPromptId, setActiveSystemPrompt
  
  // Effect to show queue modal when items are present and user is online
  useEffect(() => {
    if (networkStatus.isOnline && offlineQueue.messages.length > 0 && !isProcessingQueue) {
      // Consider if modal should auto-open or if a notification is better.
      // For now, let's assume manual opening via NetworkStatusIndicator or a button.
    }
  }, [networkStatus.isOnline, offlineQueue.messages.length, isProcessingQueue]);

  // Handle message retry events from useNetworkStatus hook
  useEffect(() => {
    const handleMessageRetrySuccess = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      console.log('Message sent successfully after retry:', detail);
      // Optionally, update UI for this message (e.g., remove 'queued' status)
      // This might require finding the message in `messages` state and updating it.
    };

    const handleMessageRetryFailed = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      console.error('Message failed to send after multiple retries:', detail);
      // Update UI to mark as permanently failed or offer user action
      setMessages(prev => prev.map(msg => 
        msg.id === detail.id ? { ...msg, isLoading: false, content: `${msg.content}\\n\\n[Failed to send message]` } : msg
      ));
    };

    window.addEventListener('messageRetrySuccess', handleMessageRetrySuccess);
    window.addEventListener('messageRetryFailed', handleMessageRetryFailed);

    return () => {
      window.removeEventListener('messageRetrySuccess', handleMessageRetrySuccess);
      window.removeEventListener('messageRetryFailed', handleMessageRetryFailed);
    };
  }, []);
  
  const handleActiveSystemPromptTextChange = (newPromptText: string) => {
    setActiveSystemPrompt(newPromptText);
    if (selectedSystemPromptId) {
        const currentlySelectedSavedPrompt = savedSystemPrompts.find((p: SystemPromptRecord) => p.id === selectedSystemPromptId);
        if (currentlySelectedSavedPrompt && currentlySelectedSavedPrompt.prompt !== newPromptText) {
            setSelectedSystemPromptId(null); 
        }
    }
  }; // Missing dependencies: setActiveSystemPrompt, selectedSystemPromptId, savedSystemPrompts, setSelectedSystemPromptId

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 antialiased overflow-hidden">
      <LeftSidebar
        isOpen={isLeftSidebarOpen}
        onToggle={toggleLeftSidebar}
        conversations={conversationsList}
        currentConversationId={currentConversationId}
        onNewChat={handleNewChat}
        onLoadConversation={handleLoadConversation}
        onDeleteConversation={handleDeleteConversation}
        isLoading={isLoading || providerState.isFetchingModels}
      />
      <ChatArea
        messages={messages}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        onStopGeneration={handleStopGeneration}
        isModelSelected={!!selectedModel}
        isServerConnected={providerState.status === 'connected' && providerState.models.length > 0}
        selectedModel={selectedModel}
      />
      <RightSidebar
        isOpen={isRightSidebarOpen}
        onToggle={toggleRightSidebar}
        activeSystemPromptText={activeSystemPrompt}
        onActiveSystemPromptTextChange={handleActiveSystemPromptTextChange}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        parameters={parameters}
        onParameterChange={handleParameterChange}
        isLoading={isLoading || providerState.isFetchingModels}
        onDownloadChat={handleDownloadChat}
        providerType={providerState.type}
        onProviderTypeChange={handleProviderTypeChange}
        providerUrl={providerState.url}
        onProviderUrlChange={handleProviderUrlChange}
        providerApiKey={providerState.apiKey}
        onProviderApiKeyChange={handleProviderApiKeyChange}
        fetchedModels={providerState.models}
        isFetchingModels={providerState.isFetchingModels}
        providerStatus={providerState.status}
        customModels={providerState.customModels}
        onAddCustomModel={handleAddCustomModel}
        onRemoveCustomModel={handleRemoveCustomModel}
        onTestConnection={handleTestConnection}
        savedSystemPrompts={savedSystemPrompts}
        selectedSystemPromptId={selectedSystemPromptId}
        onSaveNewSystemPrompt={handleSaveNewSystemPrompt}
        onUpdateSelectedSystemPrompt={handleUpdateSavedSystemPrompt}
        onDeleteSelectedSystemPrompt={handleDeleteSavedSystemPrompt}
        onSelectSavedSystemPrompt={handleSelectSavedSystemPrompt}
        currentConversationTokenCount={currentConversationTokenCount} // Pass token count
      />

      {/* PWA and Network UI Components */}
      <NetworkStatusIndicator 
        position="bottom-left" 
        onClick={() => setIsOfflineQueueModalOpen(true)} // Added PWA & Network UI Components
        className="cursor-pointer"
      />
      
      <PWAInstallPrompt 
        variant="banner" 
        className="bottom-4 right-4 w-auto max-w-md"
        canInstall={pwaInstall.canInstall}
        showInstallPrompt={pwaInstall.showInstallPrompt}
        isIOS={pwaInstall.isIOS}
        installationStatus={pwaInstall.installationStatus}
        isStandalone={pwaInstall.isStandalone}
        dismissPrompt={pwaInstall.dismissPrompt} // Added dismissPrompt if PWAInstallPrompt uses it
      />

      {isOfflineQueueModalOpen && (
        <OfflineQueueManager
          isOpen={isOfflineQueueModalOpen}
          onClose={() => setIsOfflineQueueModalOpen(false)}
        />
      )}
      
      <UpdateNotification 
        position="bottom"
        isUpdateAvailable={serviceWorker.isUpdateAvailable}
        isUpdating={serviceWorker.isUpdating} // Added missing isUpdating prop
        updateServiceWorker={serviceWorker.updateServiceWorker} // Assuming UpdateNotification uses this
        // skipWaiting={serviceWorker.skipWaiting} // If it uses skipWaiting directly
      />

    </div>
  );
};

export default App;
