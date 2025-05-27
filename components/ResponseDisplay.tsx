
import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'; // Using vscDarkPlus for a common dark theme
import remarkGfm from 'remark-gfm';
import { Loader2 } from 'lucide-react';

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

  return (
    <div className="prose prose-sm prose-invert max-w-none break-words">
      <ReactMarkdown
        children={displayContent}
        remarkPlugins={[remarkGfm]}
        components={{
          // Apply the explicit type to the 'code' component's props
          code({ node, inline, className, children, ...props }: CodeComponentRenderProps) {
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
              <SyntaxHighlighter
                children={String(children).replace(/\n$/, '')}
                style={vscDarkPlus as any} // Cast to any to resolve style type conflicts
                language={match[1]}
                PreTag="div"
                {...props}
              />
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          // Ensure tables are styled nicely by Tailwind prose
          table: ({children}) => <table className="table-auto w-full">{children}</table>,
          th: ({children}) => <th className="border border-gray-600 px-2 py-1 bg-gray-650">{children}</th>,
          td: ({children}) => <td className="border border-gray-600 px-2 py-1">{children}</td>,
        }}
      />
    </div>
  );
};

export default ResponseDisplay;
