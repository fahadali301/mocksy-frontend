export default function ChatBubble({ role, text, streaming, result }) {

  // ── Status indicator (thinking / evaluating) ──
  if (role === 'status') {
    return (
      <div className="status-indicator">
        <div className="thinking-dots">
          <span /><span /><span />
        </div>
        <span>{text}</span>
      </div>
    );
  }

  // ── Evaluation result card ──
  if (role === 'result' && result) {
    return (
      <div className="result-card glass-card">
        <div className="result-score">
          <div className="score-number">{result.overall_score ?? '—'}</div>
          <div className="score-label">out of 10</div>
        </div>

        {result.summary && (
          <p className="result-summary">{result.summary}</p>
        )}

        {result.strengths?.length > 0 && (
          <div className="result-section strengths">
            <h4>✦ Strengths</h4>
            <ul>
              {result.strengths.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
        )}

        {result.improvements?.length > 0 && (
          <div className="result-section improvements">
            <h4>△ Areas to Improve</h4>
            <ul>
              {result.improvements.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // ── AI or User chat bubble ──
  const isAI = role === 'ai';

  return (
    <div className={`bubble-wrapper ${isAI ? 'ai' : 'user'}`}>
      <div className={`bubble-avatar ${isAI ? 'ai' : 'user'}`}>
        {isAI ? 'AI' : 'U'}
      </div>
      <div className="bubble-content">
        {text}
        {streaming && <span className="typing-cursor" />}
      </div>
    </div>
  );
}
