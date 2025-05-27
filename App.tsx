import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Message, 
  OllamaParameters, 
  Conversation, 
  StoredMessage, 
  OllamaApiTag, 
  OllamaApiTagResponse,
  OllamaChatRequestBody,
  OllamaStreamChatResponse,
  OllamaChatMessage,
  SystemPromptRecord
} from './types';
import { 
  DEFAULT_SYSTEM_PROMPT, 
  DEFAULT_TEMPERATURE, 
  DEFAULT_TOP_P, 
  DEFAULT_NUM_PREDICT,
  LOCALSTORAGE_OLLAMA_URL_KEY,
  DEFAULT_OLLAMA_URL,
  DEFAULT_MODEL_NAME,
  LOCALSTORAGE_LEFT_SIDEBAR_OPEN_KEY,
  LOCALSTORAGE_RIGHT_SIDEBAR_OPEN_KEY
} from './constants';
import LeftSidebar from './components/LeftSidebar';
import RightSidebar from './components/RightSidebar';
import ChatArea from './components/ChatArea';
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

const App: React.FC = () => {
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

  const [ollamaUrl, setOllamaUrl] = useState<string>(() => {
    return localStorage.getItem(LOCALSTORAGE_OLLAMA_URL_KEY) || DEFAULT_OLLAMA_URL;
  });
  const [fetchedOllamaModels, setFetchedOllamaModels] = useState<OllamaApiTag[]>([]);
  const [ollamaConnectionError, setOllamaConnectionError] = useState<string | null>(null);
  const [isFetchingModels, setIsFetchingModels] = useState<boolean>(false);
  const [ollamaServerStatus, setOllamaServerStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');

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
    await fetchOllamaModels(ollamaUrl); // Initial fetch
  };
  
  const fetchOllamaModels = useCallback(async (urlToFetch: string) => {
    if (!isMounted.current) return;
    setIsFetchingModels(true);
    setOllamaConnectionError(null);
    setOllamaServerStatus('connecting');
    try {
      const response = await fetch(`${urlToFetch}/api/tags`, { signal: AbortSignal.timeout(15000) }); // 15s timeout
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}. ${errorData}`);
      }
      const data: OllamaApiTagResponse = await response.json();
      if (!isMounted.current) return;
      
      const validModels = data.models || [];
      setFetchedOllamaModels(validModels);
      setOllamaConnectionError(null);
      setOllamaServerStatus('connected');

      if (validModels.length > 0) {
        if (selectedModel === null || (!validModels.some(m => m.name === selectedModel) && !currentConversationId)) {
           setSelectedModel(validModels[0].name);
        }
      } else {
        if (!currentConversationId) setSelectedModel(null); 
      }
    } catch (error) {
      if (!isMounted.current) return;
      const errorMessage = error instanceof Error ? error.message : String(error);
      setOllamaConnectionError(errorMessage);
      if(isMounted.current && document.hidden === false && ollamaServerStatus !== 'error') { 
        alert(`Error connecting to Ollama or fetching models: ${errorMessage.substring(0, 150)}...\nPlease check the URL and ensure Ollama server is running.`);
      }
      setFetchedOllamaModels([]);
      if (!currentConversationId) setSelectedModel(null);
      setOllamaServerStatus('error');
    } finally {
      if (isMounted.current) setIsFetchingModels(false);
    }
  }, [selectedModel, currentConversationId, ollamaServerStatus]);

  const handleOllamaUrlChange = useCallback((newUrl: string) => {
    if (isMounted.current) {
      setOllamaUrl(newUrl);
      localStorage.setItem(LOCALSTORAGE_OLLAMA_URL_KEY, newUrl);
      fetchOllamaModels(newUrl);
    }
  }, [fetchOllamaModels]);

  const loadConversationsFromDb = async () => {
    const convos = await getAllConversations();
    if (isMounted.current) {
      setConversationsList(convos);
      if (!currentConversationId && convos.length === 0) { 
        handleNewChat(); 
      } else if (!currentConversationId && convos.length > 0) {
        handleNewChat();
      }
    }
  };
  
  const loadSavedSystemPrompts = async () => {
    const prompts = await getAllSystemPrompts();
    if (isMounted.current) {
      setSavedSystemPrompts(prompts);
    }
  };

  useEffect(() => {
    if (currentConversationId && isMounted.current) {
      const activeConversation = conversationsList.find(c => c.id === currentConversationId);
      if (activeConversation && (
          activeConversation.systemPrompt !== activeSystemPrompt ||
          activeConversation.selectedModel !== selectedModel ||
          JSON.stringify(activeConversation.parameters) !== JSON.stringify(parameters)
      )) {
          updateConversation(currentConversationId, {
            systemPrompt: activeSystemPrompt,
            selectedModel,
            parameters,
          }).then(() => {
             if(isMounted.current) loadConversationsFromDb();
          }).catch(console.error);
      }
    }
  }, [activeSystemPrompt, selectedModel, parameters, currentConversationId, conversationsList, loadConversationsFromDb]); // Added loadConversationsFromDb to deps

  const simulateUserMessageTokens = (text: string): number => {
    return Math.round(text.split(/\s+/).length * 1.3); 
  };

  const handleSendMessage = useCallback(async (userInput: string) => {
    if (!userInput.trim()) return;
    if (!selectedModel) {
      alert("Please select a model first.");
      return;
    }
    if (ollamaServerStatus !== 'connected' || fetchedOllamaModels.length === 0) {
        alert("Ollama server is not connected or no models available. Please check settings.");
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
        parameters,
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
    const { isLoading: _removedIsLoadingUser, ...userMessageForDbData } = userMessageForUi;
    const userMessageForDb: StoredMessage = {
        ...userMessageForDbData,
        conversationId: activeConversationId,
    };
    await addMessage(userMessageForDb);
    if (!isMounted.current) return;
    
    const currentMessagesWithUser = [...messages, userMessageForUi];
    setMessages(currentMessagesWithUser);

    const assistantMessageId = uuidv4();
    const assistantMessagePlaceholder: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      model: selectedModel,
      timestamp: new Date(timestamp.getTime() + 1),
      isLoading: true,
      tokens: { prompt: 0, completion: 0, total: 0 }
    };
    const { isLoading: _removedIsLoadingAssistant, ...placeholderDataForDb } = assistantMessagePlaceholder;
    const assistantMessagePlaceholderForDb: StoredMessage = {
      ...placeholderDataForDb,
      conversationId: activeConversationId,
    };
    await addMessage(assistantMessagePlaceholderForDb);
    if (!isMounted.current) return;
    setMessages(prev => [...prev, assistantMessagePlaceholder]);

    const ollamaMessagesHistory: OllamaChatMessage[] = [];
    if (activeSystemPrompt) {
      ollamaMessagesHistory.push({ role: 'system', content: activeSystemPrompt });
    }
    
    currentMessagesWithUser.forEach(msg => { 
      if (!msg.isLoading) { 
         ollamaMessagesHistory.push({ role: msg.role, content: msg.content });
      }
    });

    const requestBody: OllamaChatRequestBody = {
      model: selectedModel,
      messages: ollamaMessagesHistory,
      stream: true,
      options: {
        temperature: parameters.temperature,
        topP: parameters.topP, 
        num_predict: parameters.num_predict > 0 ? parameters.num_predict : undefined,
      },
    };

    try {
      const response = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API Error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      if (!response.body) throw new Error("Response body is null");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = "";
      let finalTokenData = { prompt: 0, completion: 0, total: 0 };

      while (true) {
        if (!isMounted.current || abortControllerRef.current?.signal.aborted) { if(!reader.closed) reader.cancel(); break; }
        const { done, value } = await reader.read();
        if (done) break;

        const chunkText = decoder.decode(value, { stream: true });
        const jsonResponses = chunkText.split('\n').filter(line => line.trim() !== '');

        for (const jsonResponse of jsonResponses) {
          if (!isMounted.current || abortControllerRef.current?.signal.aborted) { if(!reader.closed) reader.cancel(); break; }
          try {
            const streamPart = JSON.parse(jsonResponse) as OllamaStreamChatResponse;
            
            if (streamPart.message?.content) {
              accumulatedContent += streamPart.message.content;
              if (isMounted.current) {
                setMessages(prevMessages =>
                  prevMessages.map(msg =>
                    msg.id === assistantMessageId ? { ...msg, content: accumulatedContent, isLoading: true } : msg
                  )
                );
              }
            }

            if (streamPart.done) {
              finalTokenData = {
                prompt: streamPart.prompt_eval_count || simulateUserMessageTokens(activeSystemPrompt) + simulateUserMessageTokens(userInput),
                completion: streamPart.eval_count || 0,
                total: (streamPart.prompt_eval_count || simulateUserMessageTokens(activeSystemPrompt) + simulateUserMessageTokens(userInput)) + (streamPart.eval_count || 0),
              };
            }
          } catch (e) {
            console.error("Error parsing stream chunk:", e, "Chunk:", jsonResponse);
          }
        }
         if ((!isMounted.current || abortControllerRef.current?.signal.aborted) && !reader.closed) { reader.cancel(); break; }
      }
      
      if (!isMounted.current) return;

      if (!abortControllerRef.current?.signal.aborted) {
        setMessages(prevMessages =>
          prevMessages.map(msg =>
            msg.id === assistantMessageId
              ? { ...msg, isLoading: false, content: accumulatedContent, tokens: finalTokenData }
              : msg
          )
        );
        await updateMessage(assistantMessageId, { content: accumulatedContent, tokens: finalTokenData, model: selectedModel });
        if (activeConversationId) {
            await updateConversation(activeConversationId, { updatedAt: new Date() });
            if (isMounted.current) {
                loadConversationsFromDb();
            }
        }
      }
    } catch (error) {
      if (!isMounted.current) return;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Error sending message to Ollama:", errorMessage);
      
      if (!abortControllerRef.current?.signal.aborted) {
        setMessages(prevMessages =>
            prevMessages.map(msg =>
            msg.id === assistantMessageId
                ? { ...msg, isLoading: false, content: `Error: ${errorMessage.substring(0,200)}...`, tokens: {prompt:0, completion:0, total:0} }
                : msg
            )
        );
        await updateMessage(assistantMessageId, { content: `Error: ${errorMessage.substring(0,200)}...` , model: selectedModel});
        if(isMounted.current && document.hidden === false) alert(`Failed to get response from Ollama: ${errorMessage}`);
      }
    } finally {
      if (isMounted.current) {
         setIsLoading(false);
         if (abortControllerRef.current && abortControllerRef.current.signal.reason !== "User cancelled generation.") {
             abortControllerRef.current = null; 
         }
      }
    }
  }, [currentConversationId, activeSystemPrompt, selectedModel, parameters, ollamaUrl, ollamaServerStatus, fetchedOllamaModels, messages, loadConversationsFromDb]);

  const handleNewChat = useCallback(() => {
    if (isMounted.current) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort("Starting new chat.");
        abortControllerRef.current = null;
      }
      setMessages([]);
      setCurrentConversationId(null);
      setActiveSystemPrompt(DEFAULT_SYSTEM_PROMPT);
      setSelectedSystemPromptId(null); 
      setSelectedModel(fetchedOllamaModels[0]?.name ?? DEFAULT_MODEL_NAME);
      setParameters({
        temperature: DEFAULT_TEMPERATURE,
        topP: DEFAULT_TOP_P,
        num_predict: DEFAULT_NUM_PREDICT,
      });
      setIsLoading(false);
    }
  }, [fetchedOllamaModels]);
  
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

      if (!isMounted.current) return;
      if (convoDetails) {
        setCurrentConversationId(convoDetails.id);
        setActiveSystemPrompt(convoDetails.systemPrompt);
        setSelectedModel(convoDetails.selectedModel);
        setParameters(convoDetails.parameters);
        setMessages(convoMessages.map(m => ({...m, isLoading: false, timestamp: new Date(m.timestamp)} as Message)));
        
        const matchingSavedPrompt = savedSystemPrompts.find(p => p.prompt === convoDetails.systemPrompt);
        setSelectedSystemPromptId(matchingSavedPrompt ? matchingSavedPrompt.id : null);

      } else {
        setConversationsList(prev => prev.filter(c => c.id !== conversationToLoad.id));
        handleNewChat();
      }
    } catch (error) {
      console.error("Error loading conversation:", error);
      handleNewChat();
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  }, [handleNewChat, savedSystemPrompts]);

  const handleDeleteConversation = useCallback(async (conversationIdToDelete: string) => {
    if (!isMounted.current) return;
    await deleteConversationAndMessages(conversationIdToDelete);
    if (!isMounted.current) return;
    setConversationsList(prev => prev.filter(c => c.id !== conversationIdToDelete));
    if (currentConversationId === conversationIdToDelete) {
      handleNewChat();
    }
  }, [currentConversationId, handleNewChat]);


  const handleParameterChange = useCallback(<K extends keyof OllamaParameters,>(param: K, value: OllamaParameters[K]) => {
    if (isMounted.current) {
      setParameters(prev => ({ ...prev, [param]: value }));
    }
  }, []);

  const handleDownloadChat = useCallback(async () => {
    if (!currentConversationId) {
      alert("No active conversation to download.");
      return;
    }
    const conversation = await db.conversations.get(currentConversationId);
    const chatMessages = await getMessagesForConversation(currentConversationId);

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

  }, [currentConversationId]);

  const handleStopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort("User cancelled generation.");
      setMessages(prev => prev.map(msg => {
        if (msg.isLoading && msg.role === 'assistant') {
          return { ...msg, isLoading: false, content: (msg.content || "") + "\n\n[Generation stopped by user]" };
        }
        return msg;
      }));
      setIsLoading(false); 
      abortControllerRef.current = null; 
    }
  }, []);

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
    if (isMounted.current) {
        await loadSavedSystemPrompts(); 
        setSelectedSystemPromptId(newPromptRecord.id); 
        setActiveSystemPrompt(prompt); 
    }
    return true;
  };

  const handleUpdateSavedSystemPrompt = async (id: string, title: string, prompt: string) => {
    if (!title.trim() || !prompt.trim()) {
        alert("Title and prompt content are required.");
        return false;
    }
    await updateSystemPromptRecord(id, { title, prompt });
    if (isMounted.current) {
        await loadSavedSystemPrompts(); 
        if (selectedSystemPromptId === id) {
            setActiveSystemPrompt(prompt);
        }
    }
    return true;
  };

  const handleDeleteSavedSystemPrompt = async (id: string) => {
    await deleteSystemPromptRecord(id);
    if (isMounted.current) {
        await loadSavedSystemPrompts(); 
        if (selectedSystemPromptId === id) {
            setSelectedSystemPromptId(null);
            setActiveSystemPrompt(DEFAULT_SYSTEM_PROMPT); 
        }
    }
  };

  const handleSelectSavedSystemPrompt = (promptId: string | null) => {
    if (promptId) {
        const selected = savedSystemPrompts.find(p => p.id === promptId);
        if (selected) {
            setSelectedSystemPromptId(selected.id);
            setActiveSystemPrompt(selected.prompt);
        }
    } else { 
        setSelectedSystemPromptId(null);
    }
  };
  
  const handleActiveSystemPromptTextChange = (newPromptText: string) => {
    setActiveSystemPrompt(newPromptText);
    if (selectedSystemPromptId) {
        const currentlySelectedSavedPrompt = savedSystemPrompts.find(p => p.id === selectedSystemPromptId);
        if (currentlySelectedSavedPrompt && currentlySelectedSavedPrompt.prompt !== newPromptText) {
            setSelectedSystemPromptId(null); 
        }
    }
  };

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
        isLoading={isLoading || isFetchingModels}
      />
      <ChatArea
        messages={messages}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        onStopGeneration={handleStopGeneration}
        isModelSelected={!!selectedModel}
        isServerConnected={ollamaServerStatus === 'connected' && fetchedOllamaModels.length > 0}
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
        isLoading={isLoading || isFetchingModels} 
        onDownloadChat={handleDownloadChat}
        ollamaUrl={ollamaUrl}
        onOllamaUrlChange={handleOllamaUrlChange}
        fetchedOllamaModels={fetchedOllamaModels}
        ollamaConnectionError={ollamaConnectionError}
        isFetchingModels={isFetchingModels}
        ollamaServerStatus={ollamaServerStatus}
        
        savedSystemPrompts={savedSystemPrompts}
        selectedSystemPromptId={selectedSystemPromptId}
        onSaveNewSystemPrompt={handleSaveNewSystemPrompt}
        onUpdateSelectedSystemPrompt={handleUpdateSavedSystemPrompt}
        onDeleteSelectedSystemPrompt={handleDeleteSavedSystemPrompt}
        onSelectSavedSystemPrompt={handleSelectSavedSystemPrompt}
      />
    </div>
  );
};

export default App;