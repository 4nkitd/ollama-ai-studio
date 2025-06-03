import { ProviderType } from './constants';

export type { ProviderType };

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string; // For assistant messages, which model generated it
  provider?: ProviderType; // Which provider generated this message
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  timestamp: Date;
  isLoading?: boolean; // Transient state for UI
  isThinking?: boolean; // Indicates if the assistant is in a <think> block
}

export interface OllamaParameters {
  temperature: number;
  topP: number;
  num_predict: number; // Ollama uses num_predict for max output tokens
  // Add other Ollama options here if needed, e.g., top_k, seed
}

// Ollama API options type (what the API actually expects)
export interface OllamaApiOptions {
  temperature?: number;
  top_p?: number;
  num_predict?: number;
  top_k?: number;
  seed?: number;
  stop?: string[];
  repeat_penalty?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
}

export interface Conversation {
  id: string; // uuidv4
  title: string;
  createdAt: Date;
  updatedAt: Date;
  systemPrompt: string; // Stores the actual system prompt text used for this conversation
  selectedModel: string | null;
  providerType: ProviderType; // Which provider this conversation uses
  providerUrl: string; // The API URL for this conversation
  parameters: OllamaParameters;
  totalTokenCount?: number; // Added to store cumulative token count
}

export interface StoredMessage extends Omit<Message, 'isLoading' | 'model' | 'isThinking'> { // isThinking is transient
  conversationId: string;
  model?: string;
}

export interface OllamaApiTagDetails {
  format: string;
  family: string;
  families: string[] | null;
  parameter_size: string;
  quantization_level: string;
}

export interface OllamaApiTag {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: OllamaApiTagDetails;
}

export interface OllamaApiTagResponse {
  models: OllamaApiTag[];
}

// Types for Ollama /api/chat
export interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[]; // For multimodal models (base64 encoded images)
}

export interface OllamaChatRequestBody {
  model: string;
  messages: OllamaChatMessage[];
  stream: boolean;
  format?: 'json';
  options?: Partial<OllamaParameters>; // Pass supported parameters
  keep_alive?: string | number;
}

// A single message part in the chat stream
interface OllamaStreamMessagePart {
  role: 'assistant';
  content: string;
}

// Response for each chunk in the stream (when done: false)
export interface OllamaStreamChatResponseChunk {
  model: string;
  created_at: string;
  message: OllamaStreamMessagePart;
  done: false;
}

// Final response when the stream is done (when done: true)
export interface OllamaStreamChatResponseDone {
  model: string;
  created_at: string;
  done: true;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;    // Number of tokens in the prompt
  prompt_eval_duration?: number;
  eval_count?: number;           // Number of tokens in the response
  eval_duration?: number;
  context?: number[];            // The context array for the next request (if applicable)
  message?: OllamaStreamMessagePart; // Sometimes contains a final empty message
}

export type OllamaStreamChatResponse = OllamaStreamChatResponseChunk | OllamaStreamChatResponseDone;

export interface SystemPromptRecord {
  id: string; // uuidv4
  title: string;
  prompt: string;
  createdAt: Date;
  updatedAt: Date;
}

// Provider Configuration
export interface ProviderConfig {
  name: string;
  defaultUrl: string;
  apiPath: string;
  requiresApiKey: boolean;
  supportsModelsEndpoint: boolean;
  modelsEndpoint: string;
}

// OpenAI-Compatible API Types
export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAIChatRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  stop?: string | string[];
}

export interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface OpenAIChoice {
  index: number;
  message?: OpenAIMessage;
  delta?: Partial<OpenAIMessage>;
  finish_reason?: string | null;
}

export interface OpenAIChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage?: OpenAIUsage;
}

// Generic Model Interface (works for both Ollama and OpenAI-compatible)
export interface AIModel {
  id: string;
  name: string;
  provider: ProviderType;
  created?: number;
  owned_by?: string;
  isCustom?: boolean; // Flag to indicate user-added custom models
  // Ollama-specific fields (optional)
  model?: string;
  modified_at?: string;
  size?: number;
  digest?: string;
  details?: OllamaApiTagDetails;
}

// Custom Model Interface for user-added models
export interface CustomModel {
  id: string;
  name: string;
  provider: ProviderType;
  addedAt: Date;
  description?: string;
}

// Storage format for custom models (organized by provider)
export interface CustomModelsByProvider {
  [key: string]: CustomModel[]; // key is ProviderType
}

// Provider State Interface
export interface ProviderState {
  type: ProviderType;
  url: string;
  apiKey: string;
  models: AIModel[];
  customModels: AIModel[];
  status: 'idle' | 'connecting' | 'connected' | 'error';
  error: string | null;
  isFetchingModels: boolean;
}