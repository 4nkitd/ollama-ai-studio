import React, { useState, useEffect } from 'react';
import { OllamaParameters, OllamaApiTag, SystemPromptRecord } from '../types';
import { SlidersHorizontal, Settings2, FileDown, Server, AlertTriangle, CheckCircle, Loader2, Save, Trash2, Edit3, Check, X, ChevronDown, ChevronUp, Info, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { DEFAULT_SYSTEM_PROMPT } from '../constants';

interface RightSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  activeSystemPromptText: string;
  onActiveSystemPromptTextChange: (prompt: string) => void;
  
  selectedModel: string | null;
  setSelectedModel: (model: string | null) => void;
  
  parameters: OllamaParameters;
  onParameterChange: <K extends keyof OllamaParameters>(param: K, value: OllamaParameters[K]) => void;
  
  isLoading: boolean; 
  onDownloadChat: () => void;

  ollamaUrl: string;
  onOllamaUrlChange: (newUrl: string) => void;
  fetchedOllamaModels: OllamaApiTag[];
  ollamaConnectionError: string | null;
  isFetchingModels: boolean; 
  ollamaServerStatus: 'idle' | 'connecting' | 'connected' | 'error';

  savedSystemPrompts: SystemPromptRecord[];
  selectedSystemPromptId: string | null;
  onSaveNewSystemPrompt: (title: string, prompt: string) => Promise<boolean>;
  onUpdateSelectedSystemPrompt: (id: string, title: string, prompt: string) => Promise<boolean>;
  onDeleteSelectedSystemPrompt: (id: string) => void;
  onSelectSavedSystemPrompt: (promptId: string | null) => void;
}

const AccordionSection: React.FC<{ 
  title: string; 
  icon: React.ElementType; 
  children: React.ReactNode; 
  defaultOpen?: boolean;
  isSidebarOpen: boolean;
}> = ({ title, icon: Icon, children, defaultOpen = false, isSidebarOpen }) => {
  const [isAccordionContentOpen, setIsAccordionContentOpen] = useState(defaultOpen);

  const handleToggle = () => {
    if (isSidebarOpen) {
      setIsAccordionContentOpen(!isAccordionContentOpen);
    }
    // If sidebar is closed, clicking does nothing to accordion content,
    // but could trigger sidebar open if that was desired (not implemented here)
  };

  return (
    <div className="border-b border-gray-700">
      <button
        onClick={handleToggle}
        className={`w-full flex items-center text-left text-gray-200 hover:bg-gray-700/50 transition-colors
                    ${isSidebarOpen ? 'justify-between p-3' : 'justify-center p-3'}`}
        aria-expanded={isSidebarOpen && isAccordionContentOpen}
        title={title}
      >
        <div className={`flex items-center ${isSidebarOpen ? 'space-x-2' : ''}`}>
          <Icon size={isSidebarOpen ? 18 : 22} />
          {isSidebarOpen && <span className="font-medium text-sm">{title}</span>}
        </div>
        {isSidebarOpen && (isAccordionContentOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />)}
      </button>
      {isSidebarOpen && isAccordionContentOpen && (
        <div className="p-3 space-y-3 bg-gray-800/30">
          {children}
        </div>
      )}
    </div>
  );
};

const ParameterInput: React.FC<{
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  id: string;
  disabled?: boolean;
  unit?: string;
  info?: string;
}> = ({ label, value, onChange, min, max, step, id, disabled, unit, info }) => (
  <div>
    <label htmlFor={id} className="block text-xs font-medium text-gray-300 mb-1 flex justify-between items-center">
      <span>{label} {info && <span title={info}><Info size={12} className="inline text-gray-400" /></span>}</span>
      <span className="font-semibold text-sky-400">{value}{unit}</span>
    </label>
    <input
      type="range"
      id={id}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={disabled}
    />
  </div>
);


const RightSidebar: React.FC<RightSidebarProps> = ({
  isOpen,
  onToggle,
  activeSystemPromptText,
  onActiveSystemPromptTextChange,
  selectedModel,
  setSelectedModel,
  parameters,
  onParameterChange,
  isLoading, 
  onDownloadChat,
  ollamaUrl,
  onOllamaUrlChange,
  fetchedOllamaModels,
  ollamaConnectionError,
  isFetchingModels, 
  ollamaServerStatus,
  savedSystemPrompts,
  selectedSystemPromptId,
  onSaveNewSystemPrompt,
  onUpdateSelectedSystemPrompt,
  onDeleteSelectedSystemPrompt,
  onSelectSavedSystemPrompt,
}) => {
  const [editableOllamaUrl, setEditableOllamaUrl] = useState(ollamaUrl);
  const [showPromptTitleModal, setShowPromptTitleModal] = useState<null | 'new' | 'update'>(null);
  const [promptTitleInput, setPromptTitleInput] = useState('');

  useEffect(() => {
    setEditableOllamaUrl(ollamaUrl);
  }, [ollamaUrl]);

  const handleUrlSave = () => {
    onOllamaUrlChange(editableOllamaUrl);
  };
  
  const handleSaveNewPromptClick = () => {
    setPromptTitleInput('');
    setShowPromptTitleModal('new');
  };

  const handleUpdateSelectedPromptClick = () => {
    if (selectedSystemPromptId) {
      const selected = savedSystemPrompts.find(p => p.id === selectedSystemPromptId);
      setPromptTitleInput(selected?.title || '');
      setShowPromptTitleModal('update');
    }
  };

  const handlePromptTitleSubmit = async () => {
    if (!promptTitleInput.trim()) {
        alert("Prompt title cannot be empty.");
        return;
    }
    let success = false;
    if (showPromptTitleModal === 'new') {
        success = await onSaveNewSystemPrompt(promptTitleInput, activeSystemPromptText);
    } else if (showPromptTitleModal === 'update' && selectedSystemPromptId) {
        success = await onUpdateSelectedSystemPrompt(selectedSystemPromptId, promptTitleInput, activeSystemPromptText);
    }
    if (success) {
        setShowPromptTitleModal(null);
        setPromptTitleInput('');
    }
  };

  const isChatSettingsDisabled = isLoading; 
  const isServerSectionDisabled = isFetchingModels; 

  const isCustomPrompt = selectedSystemPromptId === null && activeSystemPromptText !== DEFAULT_SYSTEM_PROMPT;

  return (
    <div 
      className={`bg-gray-850 flex flex-col border-l border-gray-700 shadow-lg overflow-y-auto transition-all duration-300 ease-in-out relative
                  ${isOpen ? 'w-80 md:w-96 lg:w-[400px]' : 'w-20 items-center'}`}
    >
      <button
        onClick={onToggle}
        title={isOpen ? "Collapse Sidebar" : "Expand Sidebar"}
        className={`absolute top-3 text-gray-400 hover:text-sky-400 transition-colors z-10
                    ${isOpen ? 'left-3' : 'left-1/2 -translate-x-1/2'}`}
      >
        {isOpen ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
      </button>
      
      <div className={isOpen ? 'pt-12' : 'pt-12 w-full'}> {/* Add padding top to make space for toggle button */}
        <AccordionSection title="Ollama Server" icon={Server} defaultOpen={true} isSidebarOpen={isOpen}>
          {isOpen && (
            <>
              <div>
                <label htmlFor="ollama-url" className="block text-xs font-medium text-gray-300 mb-1">
                  Server URL
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    id="ollama-url"
                    value={editableOllamaUrl}
                    onChange={(e) => setEditableOllamaUrl(e.target.value)}
                    placeholder="e.g., http://localhost:11434"
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-xs text-gray-200 disabled:opacity-70"
                    disabled={isServerSectionDisabled}
                  />
                  <button
                    onClick={handleUrlSave}
                    disabled={isServerSectionDisabled || editableOllamaUrl === ollamaUrl}
                    title="Save URL and Fetch Models"
                    className="p-2 bg-sky-600 hover:bg-sky-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                  >
                    {isFetchingModels ? <Loader2 size={18} className="animate-spin"/> : <Save size={18} />}
                  </button>
                </div>
              </div>
              <div className="text-xs text-gray-400 h-4 mt-1">
                {isFetchingModels && <span className="flex items-center"><Loader2 size={14} className="animate-spin mr-1" />Connecting...</span>}
                {ollamaServerStatus === 'connected' && !isFetchingModels && <span className="text-green-400 flex items-center"><CheckCircle size={14} className="mr-1" />Connected</span>}
                {ollamaServerStatus === 'error' && !isFetchingModels && <span className="text-red-400 flex items-center"><AlertTriangle size={14} className="mr-1" />Error</span>}
                {ollamaServerStatus === 'idle' && !isFetchingModels && <span>Status: Idle</span>}
              </div>
            </>
          )}
        </AccordionSection>

        <AccordionSection title="Chat Configuration" icon={Settings2} defaultOpen={true} isSidebarOpen={isOpen}>
          {isOpen && (
            <>
              <div>
                <label htmlFor="model-select" className="block text-xs font-medium text-gray-300 mb-1">Model</label>
                <select
                  id="model-select"
                  value={selectedModel || ''}
                  onChange={(e) => setSelectedModel(e.target.value || null)}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-xs text-gray-200 disabled:opacity-70"
                  disabled={isChatSettingsDisabled || isFetchingModels || fetchedOllamaModels.length === 0 || ollamaServerStatus !== 'connected'}
                >
                  <option value="" disabled={selectedModel !== null || fetchedOllamaModels.length === 0}>
                    {isFetchingModels ? "Loading..." : (ollamaServerStatus !== 'connected' || fetchedOllamaModels.length === 0) ? "No models" : "Select model"}
                  </option>
                  {fetchedOllamaModels.map(model => (
                    <option key={model.name} value={model.name}>{model.name}</option>
                  ))}
                  {selectedModel && !fetchedOllamaModels.some(m => m.name === selectedModel) && ollamaServerStatus === 'connected' && (
                      <option key={selectedModel} value={selectedModel} disabled>
                          {selectedModel} (unavailable)
                      </option>
                  )}
                </select>
              </div>
              
              <div className="space-y-2 pt-2">
                 <label className="block text-xs font-medium text-gray-300">System Prompt</label>
                  <select
                      value={selectedSystemPromptId || (isCustomPrompt ? "custom" : "default")}
                      onChange={(e) => {
                          if (e.target.value === "custom" || e.target.value === "default") {
                              onSelectSavedSystemPrompt(null); 
                              if (e.target.value === "default") onActiveSystemPromptTextChange(DEFAULT_SYSTEM_PROMPT);
                          } else {
                              onSelectSavedSystemPrompt(e.target.value);
                          }
                      }}
                      className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-xs text-gray-200 focus:ring-sky-500 focus:border-sky-500 disabled:opacity-70"
                      disabled={isChatSettingsDisabled}
                  >
                      <option value="default" disabled={activeSystemPromptText === DEFAULT_SYSTEM_PROMPT && !selectedSystemPromptId}>Default</option>
                      {isCustomPrompt && !selectedSystemPromptId && <option value="custom" disabled>Custom (unsaved)</option>}

                      {savedSystemPrompts.map(sp => (
                          <option key={sp.id} value={sp.id}>{sp.title}</option>
                      ))}
                  </select>

                <textarea
                  id="system-prompt"
                  rows={5}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-xs text-gray-200 resize-y disabled:opacity-70"
                  value={activeSystemPromptText}
                  onChange={(e) => onActiveSystemPromptTextChange(e.target.value)}
                  placeholder="Define assistant behavior..."
                  disabled={isChatSettingsDisabled}
                />
                <div className="flex flex-wrap gap-2 items-center">
                   <button onClick={handleSaveNewPromptClick} disabled={isChatSettingsDisabled} title="Save as New Prompt" className="text-xs flex items-center p-1.5 bg-green-600 hover:bg-green-700 rounded disabled:opacity-50"><Save size={14} className="mr-1"/> Save New</button>
                   <button onClick={handleUpdateSelectedPromptClick} disabled={isChatSettingsDisabled || !selectedSystemPromptId} title="Update Selected Prompt" className="text-xs flex items-center p-1.5 bg-sky-600 hover:bg-sky-700 rounded disabled:opacity-50"><Edit3 size={14} className="mr-1"/> Update Sel.</button>
                   <button onClick={() => selectedSystemPromptId && window.confirm("Delete this saved prompt?") && onDeleteSelectedSystemPrompt(selectedSystemPromptId)} disabled={isChatSettingsDisabled || !selectedSystemPromptId} title="Delete Selected Prompt" className="text-xs flex items-center p-1.5 bg-red-600 hover:bg-red-700 rounded disabled:opacity-50"><Trash2 size={14} className="mr-1"/> Delete Sel.</button>
                </div>
              </div>
            </>
          )}
        </AccordionSection>

        <AccordionSection title="Parameters" icon={SlidersHorizontal} isSidebarOpen={isOpen}>
          {isOpen && (
            <>
              <ParameterInput
                id="temperature"
                label="Temperature"
                value={parameters.temperature}
                onChange={(v) => onParameterChange('temperature', v)}
                min={0} max={2} step={0.01}
                disabled={isChatSettingsDisabled}
                info="Controls randomness. Lower is more deterministic."
              />
              <ParameterInput
                id="top-p"
                label="Top P"
                value={parameters.topP}
                onChange={(v) => onParameterChange('topP', v)}
                min={0} max={1} step={0.01}
                disabled={isChatSettingsDisabled}
                info="Nucleus sampling. Considers tokens with P% cumulative probability."
              />
              <div>
                <label htmlFor="num_predict" className="block text-xs font-medium text-gray-300 mb-1 flex justify-between items-center">
                  <span>Max Response Tokens</span>
                  <span className="font-semibold text-sky-400">{parameters.num_predict <= 0 ? 'Model Default' : parameters.num_predict}</span>
                </label>
                <input
                  type="number"
                  id="num_predict"
                  value={parameters.num_predict <= 0 ? '' : parameters.num_predict}
                  onChange={(e) => onParameterChange('num_predict', parseInt(e.target.value, 10) || -1)}
                  placeholder="Default"
                  className="w-full p-2 mt-1 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-xs text-gray-200 disabled:opacity-70"
                  min={-1} step={1}
                  disabled={isChatSettingsDisabled}
                />
                 <p className="text-xs text-gray-400 mt-1">Set to -1 for model default, 0 for unlimited.</p>
              </div>
            </>
          )}
        </AccordionSection>
      </div>

      <div className={`mt-auto border-t border-gray-700 ${isOpen ? 'p-3' : 'p-3 w-full'}`}>
        <button
          onClick={onDownloadChat}
          disabled={isLoading}
          title="Download Chat"
          className={`w-full flex items-center justify-center px-4 py-2.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed
                      ${!isOpen ? 'px-2' : ''}`}
        >
          <FileDown size={isOpen ? 18 : 22} className={isOpen ? 'mr-2' : ''} />
          {isOpen && "Download Chat"}
        </button>
      </div>

      {showPromptTitleModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold text-sky-400">
              {showPromptTitleModal === 'new' ? 'Save New System Prompt' : 'Update System Prompt Title'}
            </h3>
            <input
              type="text"
              value={promptTitleInput}
              onChange={(e) => setPromptTitleInput(e.target.value)}
              placeholder="Enter prompt title"
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-sm text-gray-200 focus:ring-sky-500 focus:border-sky-500"
              autoFocus
            />
            <div className="flex justify-end space-x-3">
              <button onClick={() => setShowPromptTitleModal(null)} className="px-4 py-2 text-sm rounded-md text-gray-300 hover:bg-gray-700 transition-colors"><X size={16} className="inline mr-1"/>Cancel</button>
              <button onClick={handlePromptTitleSubmit} className="px-4 py-2 text-sm rounded-md bg-sky-600 hover:bg-sky-700 text-white transition-colors"><Check size={16} className="inline mr-1"/>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RightSidebar;