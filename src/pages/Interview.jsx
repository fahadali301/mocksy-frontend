import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ChatBubble from '../components/ChatBubble';
import VideoInterview from '../components/VideoInterview';

export default function Interview() {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const cv_id = searchParams.get('cv_id');
  const role = searchParams.get('role');
  const mode = searchParams.get('mode') || 'chat';

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [provider, setProvider] = useState('');
  
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  if (mode === 'video') {
    return <VideoInterview cv_id={cv_id} role={role} token={token} />;
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, isTyping]);

  useEffect(() => {
    if (!token || !cv_id) {
      navigate('/dashboard');
      return;
    }

    // Connect to WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:8000/ws/interview?token=${token}`;
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      // Start the interview session automatically
      ws.send(JSON.stringify({
        type: 'start',
        cv_id: parseInt(cv_id),
        role: role
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'question_started':
          setIsTyping(true);
          setStreamingText('');
          break;

        case 'token':
          setStreamingText(prev => prev + data.text);
          break;

        case 'question_complete':
          setIsTyping(false);
          setMessages(prev => [...prev, { role: 'ai', text: data.text }]);
          setStreamingText('');
          if (data.powered_by) setProvider(data.powered_by);
          break;

        case 'evaluating':
          setMessages(prev => [...prev, { role: 'status', text: 'AI is evaluating your performance...' }]);
          break;

        case 'result':
          setMessages(prev => [...prev, { role: 'result', result: data.data }]);
          if (data.powered_by) setProvider(data.powered_by);
          break;

        case 'error':
          setMessages(prev => [...prev, { role: 'ai', text: `Error: ${data.detail}` }]);
          setIsTyping(false);
          break;

        default:
          console.log('Unknown message type:', data.type);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [token, cv_id, role, navigate]);

  const handleSend = (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || !isConnected || isTyping) return;

    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');

    socketRef.current.send(JSON.stringify({
      type: 'answer',
      text: userMsg
    }));
  };

  const handleExit = () => {
    if (socketRef.current && isConnected) {
      socketRef.current.send(JSON.stringify({ type: 'exit' }));
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
            {isConnected ? 'Connected' : 'Disconnected'} 
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

        {isTyping && (
          <ChatBubble role="ai" text={streamingText} streaming={true} />
        )}
        
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
