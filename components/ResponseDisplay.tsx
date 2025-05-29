import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'; // Using vscDarkPlus for a common dark theme
import remarkGfm from 'remark-gfm';
import { Loader2, Clipboard, Check } from 'lucide-react';

interface ResponseDisplayProps {
  content: string;
  isLoading: boolean;
}

// Add type definition for the props passed to the custom 'code' component by ReactMarkdown
interface CodeComponentRenderProps {
  node?: any; // Corresponds to the HAST node
  inline?: boolean;
  className?: string;
  children: React.ReactNode;
  [key: string]: any; // Allow other props passed by ReactMarkdown
}

const ResponseDisplay: React.FC<ResponseDisplayProps> = ({ content, isLoading }) => {
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});

  if (isLoading && !content) {
    return (
      <div className="flex items-center space-x-2 text-gray-400">
        <Loader2 size={18} className="animate-spin" />
        <span>Generating response...</span>
      </div>
    );
  }
  
  // Add a blinking cursor effect for streaming
  const displayContent = isLoading ? content + '▍' : content;

  const handleCopy = (codeToCopy: string, instanceKey: string) => {
    navigator.clipboard.writeText(codeToCopy).then(() => {
      setCopiedStates((prev: Record<string, boolean>) => ({ ...prev, [instanceKey]: true }));
      setTimeout(() => {
        setCopiedStates((prev: Record<string, boolean>) => ({ ...prev, [instanceKey]: false }));
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy: ', err);
      // You could add a more user-friendly error message here
    });
  };

  return (
    <div className="prose prose-sm prose-invert max-w-none break-words py-3 overflow-x-scroll">
      <ReactMarkdown
        children={displayContent}
        remarkPlugins={[remarkGfm]}
        components={{
          // Apply the explicit type to the 'code' component's props
          code({ node, inline, className, children, ...props }: CodeComponentRenderProps) {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');
            // Create a unique key for each code block instance for copied state
            // This is a simple way; for more complex scenarios, a more robust key generation might be needed.
            const instanceKey = useMemo(() => Math.random().toString(36).substring(7), []);

            return !inline && match ? (
              <div className="relative group">
                <button
                  onClick={() => handleCopy(codeString, instanceKey)}
                  className="absolute  mt-4 bottom-2 left-2 p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 hover:text-gray-100 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                  title={copiedStates[instanceKey] ? "Copied!" : "Copy code"}
                  aria-label={copiedStates[instanceKey] ? "Code copied to clipboard" : "Copy code to clipboard"}
                >
                  {copiedStates[instanceKey] ? <Check size={16} className="text-green-400" /> : <Clipboard size={16} />}
                </button>
                <SyntaxHighlighter
                  children={codeString}
                  style={vscDarkPlus as any} // Cast to any to resolve style type conflicts
                  language={match[1]}
                  PreTag="div"
                  {...props}
                />
              </div>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          // Ensure tables are styled nicely by Tailwind prose
          table: ({children}: {children: React.ReactNode}) => <table className="table-auto w-full">{children}</table>,
          th: ({children}: {children: React.ReactNode}) => <th className="border border-gray-600 px-2 py-1 bg-gray-650">{children}</th>,
          td: ({children}: {children: React.ReactNode}) => <td className="border border-gray-600 px-2 py-1">{children}</td>,
        }}
      />
    </div>
  );
};

export default ResponseDisplay;
