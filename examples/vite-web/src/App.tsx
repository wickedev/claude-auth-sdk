import { useCallback, useEffect, useRef, useState } from 'react';
import type { LoginMode, LoginState } from '@claude-auth-sdk/react';
import { useLoginState } from '@claude-auth-sdk/react';
import { chatAbort, chatClear, chatSend, loginStore, onChatMessage } from './store.js';

// --- Chat types & component (same UI as electron example) ---

interface ChatMessage {
  role: 'user' | 'assistant' | 'error';
  text: string;
  streaming?: boolean;
  thinking?: boolean;
}

function Chat({
  messages,
  setMessages,
}: {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const streamingRef = useRef('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  });

  useEffect(() => {
    const unsub = onChatMessage((msg) => {
      if (msg.type === 'chatDelta') {
        streamingRef.current += msg.text;
        const trimmed = streamingRef.current.trimStart();
        if (!trimmed) return;
        setMessages((prev) => {
          const last = prev.at(-1);
          if (last?.role === 'assistant' && last.streaming) {
            return [...prev.slice(0, -1), { role: 'assistant', text: trimmed, streaming: true }];
          }
          return [...prev, { role: 'assistant', text: trimmed, streaming: true }];
        });
      }

      if (msg.type === 'chatDone') {
        setMessages((prev) => {
          const last = prev.at(-1);
          if (last?.streaming) {
            return [...prev.slice(0, -1), { role: 'assistant', text: last.text }];
          }
          return prev;
        });
        streamingRef.current = '';
        setSending(false);
      }

      if (msg.type === 'chatError') {
        setMessages((prev) => {
          const filtered = prev.filter((m) => !m.streaming && !m.thinking);
          return [...filtered, { role: 'error', text: msg.message }];
        });
        streamingRef.current = '';
        setSending(false);
      }
    });

    return unsub;
  }, [setMessages]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: trimmed },
      { role: 'assistant', text: '', thinking: true, streaming: true },
    ]);
    setInput('');
    setSending(true);
    streamingRef.current = '';
    void chatSend(trimmed);
  }, [input, sending, setMessages]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleAbort = useCallback(() => {
    void chatAbort();
    setSending(false);
  }, []);

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.length === 0 && <p className="chat-empty">Send a message to start chatting.</p>}
        {messages.map((msg) => (
          <div
            key={`${msg.role}-${msg.text.slice(0, 20)}`}
            className={`chat-msg chat-msg-${msg.role}`}
          >
            <div className="chat-bubble">
              <div className="chat-role">
                {msg.role === 'user' ? 'You' : msg.role === 'error' ? 'Error' : 'Claude'}
                {msg.streaming && <span className="chat-streaming"> ...</span>}
              </div>
              {msg.thinking ? (
                <span className="chat-thinking">
                  <span className="chat-thinking-dot" />
                  <span className="chat-thinking-dot" />
                  <span className="chat-thinking-dot" />
                </span>
              ) : (
                <span className="chat-text">{msg.text}</span>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input-row">
        <textarea
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={sending}
          rows={1}
        />
        {sending ? (
          <button type="button" className="chat-abort-btn" onClick={handleAbort}>
            Stop
          </button>
        ) : (
          <button
            type="button"
            className="chat-send-btn"
            onClick={handleSend}
            disabled={!input.trim()}
          >
            Send
          </button>
        )}
      </div>
    </div>
  );
}

// --- Helpers ---

function formatCredentials(state: LoginState & { status: 'logged_in' }): string {
  const { credentials } = state;
  if (credentials.type === 'api-key') {
    return `Console (API Key: ${credentials.apiKey.slice(0, 12)}...)`;
  }
  return `Claude.ai (Token: ${credentials.credentials.accessToken.slice(0, 12)}...)`;
}

function CopyUrlButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="console-btn"
      onClick={() => {
        void navigator.clipboard.writeText(url).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
    >
      {copied ? 'Copied!' : 'Copy URL'}
    </button>
  );
}

// --- Main App ---

export default function App() {
  const { state, startLogin, logout, reset } = useLoginState(loginStore);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = useCallback(
    (mode: LoginMode) => {
      setError(null);
      void startLogin(mode).catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Login failed');
      });
    },
    [startLogin],
  );

  const handleLogout = useCallback(() => {
    void chatClear();
    setMessages([]);
    void logout();
  }, [logout]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>claude-auth-sdk</h1>
        <p className="subtitle">Vite Web Demo</p>
        <p className="status">
          Status: <strong>{state.status}</strong>
        </p>
      </header>

      {state.status === 'checking' && <p>Checking stored credentials...</p>}

      {state.status === 'idle' && (
        <div className="login-screen">
          <pre className="login-art">
            {[
              '   *        *  ',
              ' ╔══╗    ╔══╗ *',
              ' ║▓▓║    ║░░║  ',
              ' ╚══╝  * ╚══╝  ',
              '    *        *  ',
            ].join('\n')}
          </pre>
          <p className="login-desc">
            Browser-based OAuth login using <code>@claude-auth-sdk/react</code> — no Node.js
            required.
          </p>
          <p className="login-question">How do you want to log in?</p>
          <button
            type="button"
            className="login-btn login-btn-claudeai"
            onClick={() => handleLogin('claudeai')}
          >
            Claude.ai Subscription
          </button>
          <p className="login-hint">Use your Claude Pro, Team, or Enterprise subscription</p>
          <button
            type="button"
            className="login-btn login-btn-console"
            onClick={() => handleLogin('console')}
          >
            Anthropic Console
          </button>
          <p className="login-hint">Pay for API usage through your Console account</p>
          {error && <p className="error">{error}</p>}
        </div>
      )}

      {state.status === 'logging_in' && (
        <div className="login-screen">
          <button type="button" disabled>
            Logging in...
          </button>
          <p style={{ marginTop: '1rem' }}>Waiting for authorization in browser...</p>
          {state.authUrl && (
            <div style={{ marginTop: '0.75rem' }}>
              <p style={{ fontSize: '0.85rem', color: '#aaa', marginBottom: '0.5rem' }}>
                Browser didn't open?
              </p>
              <a
                href={state.authUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#7c9aff', fontSize: '0.85rem', wordBreak: 'break-all' }}
              >
                Open login page manually
              </a>
              <div style={{ marginTop: '0.5rem' }}>
                <CopyUrlButton url={state.authUrl} />
              </div>
            </div>
          )}
          <button
            type="button"
            className="console-btn"
            style={{ marginTop: '1rem' }}
            onClick={reset}
          >
            Cancel
          </button>
        </div>
      )}

      {state.status === 'logged_in' && (
        <div className="logged-in-container">
          <div className="logged-in-bar">
            <span>
              <code>{formatCredentials(state)}</code>
            </span>
            <button type="button" className="logout-btn" onClick={handleLogout}>
              Log out
            </button>
          </div>
          <Chat messages={messages} setMessages={setMessages} />
        </div>
      )}

      {state.status === 'error' && (
        <div className="login-screen">
          <p className="error">
            Error: {state.error.message} ({state.error.code})
          </p>
          <button type="button" onClick={() => handleLogin('claudeai')}>
            Retry with Claude.ai
          </button>
          <button type="button" className="console-btn" onClick={() => handleLogin('console')}>
            Retry with Console
          </button>
        </div>
      )}
    </div>
  );
}
