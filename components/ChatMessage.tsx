
import React from 'react';
import { Message } from '../types';
import ResponseDisplay from './ResponseDisplay';
import { User, Bot, Cpu, BarChart3 } from 'lucide-react';

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';

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
          <ResponseDisplay content={message.content} isLoading={message.isLoading || false} />
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
             <span className="flex items-center" title="Generating response...">
              <Cpu size={12} className="mr-1 animate-pulse" />
              Processing...
            </span>
          )}
          <span>{formatTimestamp(new Date(message.timestamp))}</span>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;