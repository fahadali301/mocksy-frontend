import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ChatBubble from '../components/ChatBubble';
import VideoInterview from '../components/VideoInterview';

export default function Interview() {
  const { token, API_BASE } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const cv_id = searchParams.get('cv_id');
  const role = searchParams.get('role');
  const mode = searchParams.get('mode') || 'chat';

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [provider, setProvider] = useState('');
  const [interviewId, setInterviewId] = useState(null);

  const messagesEndRef = useRef(null);

  if (mode === 'video') {
    return <VideoInterview cv_id={cv_id} role={role} token={token} />;
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (!token || !cv_id) {
      navigate('/dashboard');
      return;
    }

    let cancelled = false;

    const startInterview = async () => {
      setIsTyping(true);
      setIsConnected(false);

      try {
        const res = await fetch(`${API_BASE}/interview/start`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            cv_id: Number.parseInt(cv_id, 10),
            role: role || null,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || 'Failed to start interview');
        }

        if (cancelled) return;
        setInterviewId(data.interview_id);
        setIsConnected(true);
        setMessages([{ role: 'ai', text: data.next_question }]);
        if (data.powered_by) setProvider(data.powered_by);
      } catch (err) {
        if (cancelled) return;
        setMessages([{ role: 'ai', text: `Error: ${err.message}` }]);
      } finally {
        if (!cancelled) setIsTyping(false);
      }
    };

    startInterview();

    return () => {
      cancelled = true;
    };
  }, [token, cv_id, role, navigate, API_BASE]);

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || !isConnected || isTyping || !interviewId) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);

    try {
      const res = await fetch(`${API_BASE}/interview/turn`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          interview_id: interviewId,
          answer: userMsg,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to submit answer');
      }

      if (data.powered_by) setProvider(data.powered_by);

      if (data.status === 'completed') {
        setIsConnected(false);
        setMessages(prev => [...prev, { role: 'result', result: data.result }]);
      } else {
        setMessages(prev => [...prev, { role: 'ai', text: data.next_question }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: `Error: ${err.message}` }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleExit = async () => {
    if (!isConnected || isTyping || !interviewId) return;

    setMessages(prev => [...prev, { role: 'status', text: 'AI is evaluating your performance...' }]);
    setIsTyping(true);

    try {
      const res = await fetch(`${API_BASE}/interview/turn`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          interview_id: interviewId,
          answer: 'exit',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to end interview');
      }

      if (data.powered_by) setProvider(data.powered_by);
      setIsConnected(false);
      setMessages(prev => [...prev, { role: 'result', result: data.result }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: `Error: ${err.message}` }]);
    } finally {
      setIsTyping(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-container">
      <header className="chat-header">
        <div className="chat-header-info">
          <h2>Live Interview Session</h2>
          <p>
            <span className={`connection-dot ${isConnected ? 'connected' : 'disconnected'}`} />
            {isConnected ? 'Connected' : (isTyping && !interviewId ? 'Starting...' : 'Disconnected')}
            {role && ` • Target: ${role}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {provider && <span className="badge badge-provider">AI: {provider}</span>}
          <button onClick={handleExit} className="btn btn-outline" style={{ padding: '6px 12px', borderColor: 'var(--error)', color: 'var(--error)' }}>
            End Interview
          </button>
        </div>
      </header>

      <div className="chat-messages">
        {messages.length === 0 && !isTyping && (
          <div style={{ textAlign: 'center', marginTop: '40px', color: 'var(--text-muted)' }}>
            Starting your AI interview session...
          </div>
        )}

        {messages.map((m, i) => (
          <ChatBubble key={i} role={m.role} text={m.text} result={m.result} />
        ))}

        {isTyping && <ChatBubble role="status" text="AI is thinking..." />}

        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <textarea
          placeholder="Type your answer here..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={!isConnected || isTyping}
        />
        <button
          onClick={handleSend}
          className="btn btn-primary"
          disabled={!input.trim() || !isConnected || isTyping}
          style={{ height: '48px', minWidth: '80px' }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
