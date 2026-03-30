import { useCallback, useEffect, useRef, useState } from 'react';
import type { SerializedCredentials, SerializedLoginState } from './types.js';

interface UseLoginStateResult {
  state: SerializedLoginState;
  startLogin: (mode?: string) => void;
  logout: () => void;
  reset: () => void;
}

function useLoginState(): UseLoginStateResult {
  const [state, setState] = useState<SerializedLoginState>({ status: 'checking' });

  useEffect(() => {
    void window.loginAPI.getState().then(setState);
    return window.loginAPI.onStateChanged(setState);
  }, []);

  const startLogin = useCallback((mode?: string) => {
    void window.loginAPI.startLogin(mode as 'claudeai' | 'console');
  }, []);
  const logout = useCallback(() => {
    void window.loginAPI.logout();
  }, []);
  const reset = useCallback(() => {
    void window.loginAPI.reset();
  }, []);

  return { state, startLogin, logout, reset };
}

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
    const unsubDelta = window.chatAPI.onDelta((delta) => {
      streamingRef.current += delta;
      const trimmed = streamingRef.current.trimStart();
      if (!trimmed) return;
      setMessages((prev) => {
        const last = prev.at(-1);
        if (last?.role === 'assistant' && last.streaming) {
          return [...prev.slice(0, -1), { role: 'assistant', text: trimmed, streaming: true }];
        }
        return [...prev, { role: 'assistant', text: trimmed, streaming: true }];
      });
    });

    const unsubDone = window.chatAPI.onDone(() => {
      setMessages((prev) => {
        const last = prev.at(-1);
        if (last?.streaming) {
          return [...prev.slice(0, -1), { role: 'assistant', text: last.text }];
        }
        return prev;
      });
      streamingRef.current = '';
      setSending(false);
    });

    const unsubError = window.chatAPI.onError((error) => {
      setMessages((prev) => {
        const filtered = prev.filter((m) => !m.streaming && !m.thinking);
        return [...filtered, { role: 'error', text: error }];
      });
      streamingRef.current = '';
      setSending(false);
    });

    return () => {
      unsubDelta();
      unsubDone();
      unsubError();
    };
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
    void window.chatAPI.send(trimmed);
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
    void window.chatAPI.abort();
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
          onChange={(e) => {
            setInput(e.target.value);
          }}
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

function formatCredentials(credentials: SerializedCredentials): string {
  if (credentials.type === 'api-key') {
    return `Console (API Key: ${credentials.apiKey.slice(0, 12)}...)`;
  }
  return `Claude.ai (Token: ${credentials.credentials.accessToken.slice(0, 12)}...)`;
}

export default function App() {
  const { state, startLogin, logout, reset } = useLoginState();
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const handleLogout = useCallback(() => {
    void window.chatAPI.clear();
    setMessages([]);
    logout();
  }, [logout]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>claude-auth-sdk</h1>
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
          <p className="login-desc">Use your Claude subscription or Console API key to chat.</p>
          <p className="login-question">How do you want to log in?</p>
          <button
            type="button"
            className="login-btn login-btn-claudeai"
            onClick={() => {
              startLogin('claudeai');
            }}
          >
            Claude.ai Subscription
          </button>
          <p className="login-hint">Use your Claude Pro, Team, or Enterprise subscription</p>
          <button
            type="button"
            className="login-btn login-btn-console"
            onClick={() => {
              startLogin('console');
            }}
          >
            Anthropic Console
          </button>
          <p className="login-hint">Pay for API usage through your Console account</p>
        </div>
      )}

      {state.status === 'logging_in' && (
        <div>
          <button type="button" disabled>
            Logging in...
          </button>
          <p style={{ marginTop: '1rem' }}>Waiting for authorization in browser...</p>
          {state.authUrl && (
            <div style={{ marginTop: '0.75rem' }}>
              <p style={{ fontSize: '0.85rem', color: '#aaa', marginBottom: '0.5rem' }}>
                Browser didn't open automatically?
              </p>
              <a
                href={state.authUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#7c9aff', fontSize: '0.85rem', wordBreak: 'break-all' }}
                onClick={(e) => {
                  e.preventDefault();
                  if (state.authUrl) {
                    void window.shellAPI.openExternal(state.authUrl);
                  }
                }}
              >
                {state.authUrl}
              </a>
              <div style={{ marginTop: '0.5rem' }}>
                <CopyUrlButton url={state.authUrl} />
              </div>
            </div>
          )}
          <button type="button" className="console-btn" style={{ marginTop: '1rem' }} onClick={reset}>
            Cancel
          </button>
        </div>
      )}

      {state.status === 'logged_in' && state.credentials && (
        <div className="logged-in-container">
          <div className="logged-in-bar">
            <span>
              <code>{formatCredentials(state.credentials)}</code>
            </span>
            <button type="button" className="logout-btn" onClick={handleLogout}>
              Log out
            </button>
          </div>
          <Chat messages={messages} setMessages={setMessages} />
        </div>
      )}

      {state.status === 'error' && (
        <div>
          <p className="error">
            Error: {state.error?.message} ({state.error?.code})
          </p>
          <button
            type="button"
            onClick={() => {
              startLogin('claudeai');
            }}
          >
            Retry with Claude.ai
          </button>
          <button
            type="button"
            className="console-btn"
            onClick={() => {
              startLogin('console');
            }}
          >
            Retry with Console
          </button>
        </div>
      )}
    </div>
  );
}
