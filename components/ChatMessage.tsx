
import React, { useState } from 'react';
import { Message } from '../types';
import ResponseDisplay from './ResponseDisplay';
import { User, Bot, Cpu, BarChart3, Brain, ChevronDown, ChevronUp } from 'lucide-react';

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const [showThinking, setShowThinking] = useState(false);

  const formatTimestamp = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} group`}>
      <div className={`max-w-xl lg:max-w-2xl xl:max-w-3xl p-3 rounded-lg shadow ${
          isUser 
            ? 'bg-sky-600 text-white rounded-br-none' 
            : 'bg-gray-700 text-gray-100 rounded-bl-none'
        }`}
      >
        <div className="flex items-center mb-1">
          {isUser ? (
            <User size={18} className="mr-2 text-sky-200" />
          ) : (
            <Bot size={18} className="mr-2 text-teal-400" />
          )}
          <span className="font-semibold text-sm">
            {isUser ? 'You' : message.model ? `Assistant (${message.model})` : 'Assistant'}
          </span>
        </div>
        
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : (
          <>
            {/* Thinking indicator */}
            {message.isThinking && (
              <div 
                className="flex items-center mb-2 p-2 bg-gray-600 rounded cursor-pointer hover:bg-gray-500 transition-colors"
                onClick={() => setShowThinking(!showThinking)}
              >
                <Brain size={16} className="mr-2 text-purple-400 animate-pulse" />
                <span className="text-sm text-purple-300">Assistant is thinking...</span>
                {showThinking ? (
                  <ChevronUp size={16} className="ml-auto text-gray-400" />
                ) : (
                  <ChevronDown size={16} className="ml-auto text-gray-400" />
                )}
              </div>
            )}

            {/* Thinking content (expandable) */}
            {showThinking && message.isThinking && (
              <div className="mb-2 p-2 bg-gray-800 rounded border-l-4 border-purple-400">
                <div className="text-xs text-purple-300 mb-1">Thinking Process:</div>
                <div className="text-sm text-gray-300 italic">
                  The assistant is processing your request and considering the best response...
                </div>
              </div>
            )}

            <ResponseDisplay content={message.content} isLoading={message.isLoading || false} />
          </>
        )}

        <div className="text-xs mt-2 flex items-center justify-end space-x-3 opacity-70 group-hover:opacity-100 transition-opacity">
          {message.tokens && (message.tokens.total > 0 || message.tokens.prompt > 0 || message.tokens.completion > 0) && !message.isLoading && (
            <span 
              className="flex items-center" 
              title={isUser ? `Input tokens (simulated): ${message.tokens.total}` : `Prompt: ${message.tokens.prompt}, Completion: ${message.tokens.completion}, Total: ${message.tokens.total} tokens`}
            >
              <BarChart3 size={12} className="mr-1" />
              {message.tokens.total} {isUser ? '(sim.)' : ''}
            </span>
          )}
          {message.isLoading && message.role === 'assistant' && (
             message.isThinking ? (
                <span className="flex items-center text-yellow-400" title="Assistant is thinking...">
                  <Brain size={12} className="mr-1 animate-pulse" /> 
                  Thinking...
                </span>
             ) : (
                <span className="flex items-center" title="Generating response...">
                  <Cpu size={12} className="mr-1 animate-pulse" />
                  Processing...
                </span>
             )
          )}
          <span>{formatTimestamp(new Date(message.timestamp))}</span>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
