import { memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ImageMessage from './ImageMessage';

// Code block with syntax highlighting and copy button
const CodeBlock = ({ children, language }) => {
  const [copied, setCopied] = useState(false);
  const codeString = String(children).replace(/\n$/, '');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <span className="code-block-language">{language || 'code'}</span>
        <button 
          className="code-block-copy-btn" 
          onClick={handleCopy}
          title="Copy code"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <div className="code-block-content">
        <SyntaxHighlighter
          style={vscDarkPlus}
          language={language || 'text'}
          PreTag="div"
          customStyle={{
            margin: 0,
            padding: '1em',
            borderRadius: '0 0 8px 8px',
            fontSize: '0.875em',
            lineHeight: '1.6',
            background: '#1e1e1e',
            overflow: 'visible',
            maxHeight: 'none'
          }}
        >
          {codeString}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

// Memoized markdown renderer with proper formatting
const MarkdownContent = memo(({ content }) => {
  return (
    <div className="message-text markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            // Use syntax highlighting for code blocks
            if (!inline && match) {
              return <CodeBlock language={match[1]}>{children}</CodeBlock>;
            }
            // Handle code blocks without language specified (fallback)
            if (!inline && typeof children === 'string' && children.length > 50) {
              // If it's a long code block without language, treat it as text
              return <CodeBlock language="text">{children}</CodeBlock>;
            }
            // Inline code styling
            return (
              <code className="inline-code" {...props}>
                {children}
              </code>
            );
          },
          pre({ node, children, ...props }) {
            // Handle pre blocks that might contain code
            if (node.children && node.children.length === 1) {
              const child = node.children[0];
              if (child.type === 'element' && child.tagName === 'code') {
                // Already handled by code component
                return <>{children}</>;
              }
            }
            // Fallback: if pre contains plain text, treat as code block
            const textContent = String(children);
            if (textContent && textContent.length > 20 && !textContent.includes('```')) {
              return <CodeBlock language="text">{textContent}</CodeBlock>;
            }
            return <pre className="markdown-pre" {...props}>{children}</pre>;
          },
          // Proper styling for better readability
          p: ({ node, ...props }) => <p className="markdown-p" {...props} />,
          h1: ({ node, ...props }) => <h1 className="markdown-h1" {...props} />,
          h2: ({ node, ...props }) => <h2 className="markdown-h2" {...props} />,
          h3: ({ node, ...props }) => <h3 className="markdown-h3" {...props} />,
          h4: ({ node, ...props }) => <h4 className="markdown-h4" {...props} />,
          ul: ({ node, ...props }) => <ul className="markdown-ul" {...props} />,
          ol: ({ node, ...props }) => <ol className="markdown-ol" {...props} />,
          li: ({ node, ...props }) => <li className="markdown-li" {...props} />,
          strong: ({ node, ...props }) => <strong className="markdown-strong" {...props} />,
          blockquote: ({ node, ...props }) => <blockquote className="markdown-blockquote" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}, (prevProps, nextProps) => prevProps.content === nextProps.content);

MarkdownContent.displayName = 'MarkdownContent';

// Memoized message item
const MessageItem = memo(({ message }) => {
  return (
    <div className={`message message-${message.type}`}>
      {message.type === 'image' ? (
        <ImageMessage
          imageData={message.imageData}
          analysis={message.analysis}
          error={message.error}
        />
      ) : (
        <div className="message-content">
          {message.type === 'assistant' ? (
            <MarkdownContent content={message.content} />
          ) : (
            <div className="message-text">{message.content}</div>
          )}
          <div className="message-time">
            {message.timestamp.toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if message content actually changed
  return prevProps.message.id === nextProps.message.id &&
         prevProps.message.content === nextProps.message.content &&
         prevProps.message.type === nextProps.message.type;
});

MessageItem.displayName = 'MessageItem';

export default MessageItem;

