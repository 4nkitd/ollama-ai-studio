
import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../types';
import ChatMessage from './ChatMessage';
import { Send, CornerDownLeft, Loader2, AlertTriangle, Square } from 'lucide-react';

interface ChatAreaProps {
  messages: Message[];
  onSendMessage: (input: string) => void;
  isLoading: boolean;
  onStopGeneration: () => void;
  isModelSelected: boolean;
  isServerConnected: boolean;
  // FIX: Added selectedModel to props
  selectedModel: string | null;
}

const ChatArea: React.FC<ChatAreaProps> = ({ messages, onSendMessage, isLoading, onStopGeneration, isModelSelected, isServerConnected, selectedModel }) => {
  const [userInput, setUserInput] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    if (!isLoading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLoading]);


  const handleSend = () => {
    if (userInput.trim() && !isLoading && isModelSelected && isServerConnected) {
      onSendMessage(userInput);
      setUserInput('');
    } else if (!isModelSelected) {
      alert("Please select a model in the sidebar first.");
    } else if (!isServerConnected) {
      alert("Cannot send message. Ollama server is not connected or no models are available. Please check settings in the sidebar.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isInputDisabled = isLoading || !isModelSelected || !isServerConnected;
  let placeholderText = "Type your message here... (Shift+Enter for new line)";
  if (!isServerConnected) {
    placeholderText = "Ollama server not connected. Check settings in the sidebar.";
  } else if (!isModelSelected) {
    placeholderText = "Please select a model in the sidebar.";
  }


  return (
    <div className="flex-1 flex flex-col bg-gray-850 h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-gray-850">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <CornerDownLeft size={48} className="mb-4" />
            <p className="text-lg">No messages yet.</p>
            {!isServerConnected && (
                <p className="text-orange-400 flex items-center mt-2"><AlertTriangle size={16} className="mr-1"/> Server not connected. Configure in sidebar.</p>
            )}
            {isServerConnected && !isModelSelected && (
                <p className="text-orange-400 flex items-center mt-2"><AlertTriangle size={16} className="mr-1"/> No model selected. Choose one in sidebar.</p>
            )}
            {isServerConnected && isModelSelected && <p>Start a conversation by typing below.</p>}
          </div>
        )}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 md:p-6 border-t border-gray-700 bg-gray-800">
        {isLoading && (
          <button
            onClick={onStopGeneration}
            className="mb-2 w-full flex items-center justify-center px-4 py-2 border border-red-500 rounded-md shadow-sm text-sm font-medium text-red-400 bg-gray-700 hover:bg-red-900 hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 focus:ring-offset-gray-800"
          >
            <Square size={18} className="mr-2" />
            Stop Generation
          </button>
        )}
        <div className={`flex items-end space-x-3 bg-gray-700 rounded-lg p-1 pr-2 border border-gray-600 focus-within:ring-2 ${isInputDisabled && !isLoading ? 'opacity-60 cursor-not-allowed' : 'focus-within:ring-sky-500'}`}>
          <textarea
            ref={inputRef}
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholderText}
            className="flex-1 p-2 bg-transparent text-gray-100 placeholder-gray-400 focus:outline-none resize-none min-h-[40px] max-h-40 overflow-y-auto"
            rows={1}
            disabled={isInputDisabled}
          />
          <button
            onClick={handleSend}
            disabled={isInputDisabled || !userInput.trim()}
            className="p-2 rounded-md text-sky-400 hover:text-sky-300 hover:bg-sky-800 disabled:text-gray-500 disabled:hover:bg-transparent transition-colors"
            aria-label="Send message"
          >
            {isLoading ? <Loader2 size={22} className="animate-spin" /> : <Send size={22} />}
          </button>
        </div>
         <p className="text-xs text-gray-500 mt-2 text-center">
           {/* FIX: Use selectedModel prop */}
           {isServerConnected ? `Interacting with Ollama model ${selectedModel ? selectedModel : ''}.` : "Ollama server not connected."}
        </p>
      </div>
    </div>
  );
};

export default ChatArea;