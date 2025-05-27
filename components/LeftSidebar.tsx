
import React from 'react';
import { Conversation } from '../types';
import { APP_TITLE } from '../constants';
import { MessageSquareText, PlusSquare, Trash2, CheckCircle, Loader2, PanelLeftClose, PanelLeftOpen, FolderKanban } from 'lucide-react';

interface LeftSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  conversations: Conversation[];
  currentConversationId: string | null;
  onNewChat: () => void;
  onLoadConversation: (conversation: Conversation) => void;
  onDeleteConversation: (conversationId: string) => void;
  isLoading: boolean; 
}

const LeftSidebar: React.FC<LeftSidebarProps> = ({
  isOpen,
  onToggle,
  conversations,
  currentConversationId,
  onNewChat,
  onLoadConversation,
  onDeleteConversation,
  isLoading,
}) => {
  return (
    <div 
      className={`bg-gray-800 flex flex-col border-r border-gray-700 shadow-lg transition-all duration-300 ease-in-out relative
                  ${isOpen ? 'w-64 md:w-72 lg:w-80 p-4' : 'w-20 p-3 items-center'}`}
    >
      <button
        onClick={onToggle}
        title={isOpen ? "Collapse Sidebar" : "Expand Sidebar"}
        className={`absolute bottom-3 text-gray-400 hover:text-sky-400 transition-colors z-10
                    ${isOpen ? 'right-3' : 'left-1/2 -translate-x-1/2'}`}
      >
        {isOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
      </button>

      <div className={`flex items-center justify-between mb-6 ${isOpen ? '' : 'w-full flex-col'}`}>
        <div 
          className={`flex items-center space-x-2 text-lg font-semibold text-sky-400 ${isOpen ? '' : 'mt-8 mb-2'}`}
          title={APP_TITLE}
        >
          <MessageSquareText size={isOpen ? 24 : 28} />
          {isOpen && <span>{APP_TITLE}</span>}
        </div>
        <button
          onClick={onNewChat}
          disabled={isLoading}
          title="Start New Chat"
          className={`p-2 text-sky-400 hover:text-sky-300 hover:bg-sky-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                      ${isOpen ? '' : 'w-full flex justify-center'}`}
        >
          {isLoading && !currentConversationId ? <Loader2 size={22} className="animate-spin" /> : <PlusSquare size={isOpen ? 22 : 24} />}
        </button>
      </div>

      {isOpen && (
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
          Conversations
        </h3>
      )}
      {!isOpen && <div className="w-full border-t border-gray-700 my-2"></div>}


      <div className={`flex-grow overflow-y-auto space-y-1 ${isOpen ? 'pr-1 sidebar-conversations-list' : 'w-full flex flex-col items-center'}`}>
        {conversations.length === 0 && !isLoading && (
          isOpen ? <p className="text-sm text-gray-500 px-1 py-2">No conversations yet.</p> : 
// FIX: Wrap FolderKanban with a span to apply the title attribute
          <span title="No conversations">
            <FolderKanban size={28} className="text-gray-500 my-4" />
          </span>
        )}
        {isLoading && conversations.length === 0 && (
           <div className="flex justify-center items-center h-full">
             <Loader2 size={isOpen ? 24 : 28} className="animate-spin text-sky-500" />
           </div>
        )}
        {conversations.map(conv => (
          <div
            key={conv.id}
            className={`group flex items-center justify-between p-2.5 rounded-md cursor-pointer transition-all duration-150 ease-in-out
              ${currentConversationId === conv.id 
                ? 'bg-sky-600 text-white shadow-md' 
                : 'hover:bg-gray-700 text-gray-300 hover:text-gray-100'
              }
              ${isLoading && currentConversationId !== conv.id ? 'opacity-50 cursor-not-allowed' : ''}
              ${!isOpen ? 'w-12 h-12 justify-center' : ''}
            `}
            onClick={() => !isLoading && currentConversationId !== conv.id && onLoadConversation(conv)}
            title={conv.title || `Chat ${new Date(conv.createdAt).toLocaleDateString()}`}
          >
            <div className={`flex items-center overflow-hidden ${!isOpen ? 'justify-center w-full' : ''}`}>
              {currentConversationId === conv.id && <CheckCircle size={16} className={`inline ${isOpen ? 'mr-2' : ''} flex-shrink-0`} />}
              {!isOpen && currentConversationId !== conv.id && <MessageSquareText size={18} className="text-gray-400 group-hover:text-gray-200"/>}
              {isOpen && (
                <span className="truncate text-sm">
                  {conv.title || `Chat ${new Date(conv.createdAt).toLocaleDateString()}`}
                </span>
              )}
            </div>
            {isOpen && (
              <button
                onClick={(e) => { 
                  e.stopPropagation();
                  if (isLoading) return;
                  if (window.confirm(`Are you sure you want to delete "${conv.title || 'this chat'}"? This action cannot be undone.`)) {
                    onDeleteConversation(conv.id);
                  }
                }}
                disabled={isLoading}
                className={`ml-2 p-1 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 
                  ${currentConversationId === conv.id ? 'text-red-300 hover:text-red-100 hover:bg-red-500/50' : 'text-red-400 hover:text-red-300 hover:bg-red-600/50'} 
                  disabled:opacity-30 disabled:hover:bg-transparent transition-all duration-150 ease-in-out`}
                title="Delete conversation"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default LeftSidebar;