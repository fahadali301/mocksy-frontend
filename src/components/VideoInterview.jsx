import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ChatBubble from './ChatBubble';
import * as faceapi from '@vladmandic/face-api';

export default function VideoInterview({ cv_id, role, token }) {
  const navigate = useNavigate();
  const { API_BASE } = useAuth();
  const videoRef = useRef(null);

  // States
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [subtitle, setSubtitle] = useState('Starting interview...');
  const [evalResult, setEvalResult] = useState(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [detectedEmotion, setDetectedEmotion] = useState(null);
  const [interviewId, setInterviewId] = useState(null);

  // Web Speech API refs
  const recognitionRef = useRef(null);
  const synthRef = window.speechSynthesis;
  const detectionIntervalRef = useRef(null);

  // Load face-api models
  useEffect(() => {
    const loadModels = async () => {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        await faceapi.nets.faceExpressionNet.loadFromUri('/models');
        setModelsLoaded(true);
      } catch (err) {
        console.error('Error loading face-api models:', err);
      }
    };
    loadModels();
  }, []);

  // Run emotion detection loop
  useEffect(() => {
    if (!modelsLoaded || !videoRef.current) return;

    const detectEmotions = async () => {
      if (videoRef.current && videoRef.current.readyState >= 2) {
        try {
          const detections = await faceapi.detectSingleFace(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions()
          ).withFaceExpressions();

          if (detections) {
            const expressions = detections.expressions;
            const dominantEmotion = Object.keys(expressions).reduce((a, b) => 
              expressions[a] > expressions[b] ? a : b
            );
            setDetectedEmotion(dominantEmotion);
          } else {
            setDetectedEmotion(null);
          }
        } catch (e) {
          console.error('Face detection error:', e);
        }
      }
    };

    detectionIntervalRef.current = setInterval(detectEmotions, 1000);
    return () => clearInterval(detectionIntervalRef.current);
  }, [modelsLoaded, isConnected]);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        let finalTrans = '';
        let interimTrans = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTrans += event.results[i][0].transcript;
          } else {
            interimTrans += event.results[i][0].transcript;
          }
        }
        setInterimTranscript(interimTrans);

        if (finalTrans.trim()) {
          handleSendAnswer(finalTrans.trim());
        }
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        if (isListening) {
          try {
            recognition.start();
          } catch {
            // Ignore restart races when recognition is already running.
          }
        }
      };

      recognitionRef.current = recognition;
    } else {
      console.warn("Speech Recognition not supported in this browser.");
    }
  }, [isListening]);

  // Handle camera feed
  useEffect(() => {
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera access denied or error:", err);
      }
    }
    setupCamera();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Start interview over REST (Vercel-compatible)
  useEffect(() => {
    if (!token || !cv_id) {
      navigate('/dashboard');
      return;
    }

    let cancelled = false;

    const startInterview = async () => {
      setIsTyping(true);

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
        setSubtitle(data.next_question);
        speakText(data.next_question);
      } catch (err) {
        if (cancelled) return;
        setSubtitle(`Error: ${err.message}`);
        setIsConnected(false);
      } finally {
        if (!cancelled) setIsTyping(false);
      }
    };

    startInterview();

    return () => {
      if (synthRef) synthRef.cancel();
      if (recognitionRef.current) recognitionRef.current.stop();
      if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
      cancelled = true;
    };
  }, [token, cv_id, role, navigate, API_BASE]);

  // TTS function
  const speakText = (text) => {
    if (!synthRef) return;
    synthRef.cancel();

    let cleanText = text.replace(/[*_]/g, ''); // strip markdown

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const voices = synthRef.getVoices();
    const preferredVoice = voices.find(v => v.lang.includes('en') && (v.name.includes('Google') || v.name.includes('Samantha')));
    if (preferredVoice) utterance.voice = preferredVoice;

    // Trigger Avatar Animation
    utterance.onstart = () => setIsAiSpeaking(true);
    utterance.onend = () => setIsAiSpeaking(false);
    utterance.onerror = () => setIsAiSpeaking(false);

    synthRef.speak(utterance);
  };

  const handleSendAnswer = async (text) => {
    if (!text || !isConnected || isTyping || !interviewId) return;

    setSubtitle(`You: ${text}`);
    setIsListening(false);
    if (recognitionRef.current) recognitionRef.current.stop();

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
          answer: text,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to submit answer');
      }

      if (data.status === 'completed') {
        setEvalResult(data.result);
        setSubtitle('Evaluation complete.');
        setIsConnected(false);
      } else {
        setSubtitle(data.next_question);
        speakText(data.next_question);
      }
    } catch (err) {
      setSubtitle(`Error: ${err.message}`);
    } finally {
      setIsTyping(false);
    }
  };

  const toggleMic = () => {
    if (isTyping || isAiSpeaking) return;

    if (isListening) {
      setIsListening(false);
      recognitionRef.current?.stop();
    } else {
      synthRef?.cancel();
      setIsListening(true);
      setInterimTranscript('');
      try {
        recognitionRef.current?.start();
      } catch {
        // Ignore startup races when recognition is already active.
      }
    }
  };

  const handleExit = async () => {
    if (!isConnected || isTyping || !interviewId) return;

    setIsListening(false);
    recognitionRef.current?.stop();
    synthRef?.cancel();
    setIsTyping(true);
    setSubtitle('Interview complete. AI is evaluating your performance...');

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

      setEvalResult(data.result);
      setSubtitle('Evaluation complete.');
      setIsConnected(false);
    } catch (err) {
      setSubtitle(`Error: ${err.message}`);
    } finally {
      setIsTyping(false);

      // Turn off camera explicitly
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    }
  };

  if (evalResult) {
    return (
      <div className="page-container" style={{ alignItems: 'center', paddingTop: '40px' }}>
        <h2>Session Complete</h2>
        <ChatBubble role="result" result={evalResult} />
        <button className="btn btn-primary" onClick={() => navigate('/dashboard')} style={{ marginTop: '20px' }}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: '1400px', padding: '20px' }}>
      <header className="chat-header" style={{ marginBottom: '20px', borderRadius: '12px' }}>
        <div className="chat-header-info">
          <h2>Face-to-Face Mock Interview</h2>
          <p>
            <span className={`connection-dot ${isConnected ? 'connected' : 'disconnected'}`} />
            {isConnected ? 'Connected' : (isTyping && !interviewId ? 'Starting...' : 'Disconnected')}
            {role && ` • Target: ${role}`}
          </p>
        </div>
        <button onClick={handleExit} className="btn btn-outline" style={{ borderColor: 'var(--error)', color: 'var(--error)' }}>
          End Interview
        </button>
      </header>

      <div style={{ position: 'relative' }}>
        <div className="video-layout">

          {/* AI Avatar Feed */}
          <div className="ai-avatar-container">
            <div className={`ai-avatar ${isAiSpeaking ? 'speaking' : ''}`}>
              🤖
            </div>
            {isAiSpeaking && (
              <div style={{ position: 'absolute', top: '20px', right: '20px', color: 'var(--accent)', fontSize: '0.9rem', fontWeight: 'bold' }}>
                <span className="connection-dot connected" style={{ marginRight: '6px', animation: 'dotPulse 1s infinite' }} />
                AI Speaking
              </div>
            )}
          </div>

          {/* User Camera Feed */}
          <div className="user-video-container" style={{ position: 'relative' }}>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="video-element"
            />
            {detectedEmotion && (
              <div style={{ position: 'absolute', bottom: '20px', left: '20px', backgroundColor: 'rgba(0,0,0,0.6)', padding: '6px 14px', borderRadius: '20px', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: 'bold', backdropFilter: 'blur(4px)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 10 }}>
                <span style={{ fontSize: '1.2rem' }}>
                  {detectedEmotion === 'happy' ? '😊'
                   : detectedEmotion === 'sad' ? '😢'
                   : detectedEmotion === 'angry' ? '😠'
                   : detectedEmotion === 'fearful' ? '😨'
                   : detectedEmotion === 'disgusted' ? '🤢'
                   : detectedEmotion === 'surprised' ? '😲'
                   : '😐'}
                </span>
                <span style={{ textTransform: 'capitalize', letterSpacing: '0.5px' }}>{detectedEmotion}</span>
              </div>
            )}
          </div>
          
        </div>

        {/* Global Cinematic Captions & Controls */}
        <div className="captions-overlay" style={{ pointerEvents: 'auto' }}>
          
          <div className="caption-text">
            {isListening && interimTranscript ? (
              <span style={{ color: 'var(--accent-light)' }}>You: {interimTranscript}</span>
            ) : (
              subtitle
            )}
            {isTyping && <span className="typing-cursor" style={{ height: '0.8em' }}></span>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
            <button 
              className={`mic-btn ${isListening ? 'active' : ''}`}
              onClick={toggleMic}
              disabled={isTyping || isAiSpeaking || !isConnected}
              title="Tap to speak"
            >
              🎤
            </button>
            {isListening ? (
              <span style={{ fontSize: '0.9rem', color: '#ff6b6b', fontWeight: 'bold' }}>
                Recording... Tap Mic to send
              </span>
            ) : (
              <span style={{ fontSize: '0.9rem', color: '#ffffff', opacity: 0.9 }}>
                {isAiSpeaking ? 'AI is speaking...' : 'Tap Mic to Answer'}
              </span>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
}
