export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string; // For assistant messages, which model generated it
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

export interface Conversation {
  id: string; // uuidv4
  title: string;
  createdAt: Date;
  updatedAt: Date;
  systemPrompt: string; // Stores the actual system prompt text used for this conversation
  selectedModel: string | null;
  parameters: OllamaParameters;
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