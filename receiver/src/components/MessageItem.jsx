import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ImageMessage from './ImageMessage';

// Code block with syntax highlighting
const CodeBlock = ({ children, language }) => {
  return (
    <div style={{ 
      maxHeight: '500px', 
      overflow: 'auto', 
      borderRadius: '8px',
      margin: '1em 0'
    }}>
      <SyntaxHighlighter
        style={vscDarkPlus}
        language={language || 'text'}
        PreTag="div"
        customStyle={{
          margin: 0,
          padding: '1em',
          borderRadius: '8px',
          fontSize: '0.875em',
          lineHeight: '1.5'
        }}
      >
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
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
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
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

