import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { token, API_BASE } = useAuth();
  const [cvs, setCvs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedCv, setSelectedCv] = useState(null);
  const [role, setRole] = useState('');
  const [mode, setMode] = useState('chat');
  const navigate = useNavigate();

  const fetchCvs = async () => {
    try {
      const res = await fetch(`${API_BASE}/cv/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCvs(data);
      }
    } catch (err) {
      console.error("Failed to fetch CVs", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCvs();
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/cv/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      if (res.ok) {
        fetchCvs();
      } else {
        const data = await res.json();
        setError(data.detail || 'Upload failed');
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      setUploadLoading(false);
    }
  };

  const startInterview = (cv) => {
    setSelectedCv(cv);
    setShowModal(true);
  };

  const confirmStart = (e) => {
    e.preventDefault();
    navigate(`/interview?cv_id=${selectedCv.id}&role=${encodeURIComponent(role)}&mode=${mode}`);
  };

  return (
    <div className="page-container">
      <header className="page-header">
        <h1>Your Dashboard</h1>
        <p>Manage your CVs and prepare for your next interview</p>
      </header>

      {error && <div className="error-msg" style={{ marginBottom: '24px' }}>{error}</div>}

      <div className="dashboard-grid">
        <label className="upload-zone glass-card">
          <input type="file" onChange={handleFileUpload} accept=".pdf" style={{ display: 'none' }} />
          {uploadLoading ? (
            <div className="spinner" style={{ margin: '0 auto' }} />
          ) : (
            <>
              <h3>+ Upload New CV</h3>
              <p>PDF only, max 5MB</p>
            </>
          )}
        </label>

        {loading ? (
          [1, 2].map(i => <div key={i} className="cv-card glass-card" style={{ height: '160px', opacity: 0.5 }} />)
        ) : (
          cvs.map(cv => (
            <div key={cv.id} className="cv-card glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span className="badge badge-completed">CV #{cv.id}</span>
              </div>
              <h3>{cv.file_path.split('/').pop().split('_').slice(1).join('_') || 'Resume'}</h3>
              <p className="cv-preview">
                {cv.text_preview?.substring(0, 100)}...
              </p>
              <div className="cv-actions">
                <button 
                  onClick={() => startInterview(cv)} 
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                >
                  Start Mock Interview
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-card">
            <h2>Start Interview</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '0.9rem' }}>
              Specify the role you are interviewing for to get tailored questions.
            </p>
            <form onSubmit={confirmStart}>
              
              <div className="mode-selector">
                <div 
                  className={`mode-card ${mode === 'chat' ? 'selected' : ''}`}
                  onClick={() => setMode('chat')}
                >
                  <h4>💬 Text Chat</h4>
                  <p>Standard typing</p>
                </div>
                <div 
                  className={`mode-card ${mode === 'video' ? 'selected' : ''}`}
                  onClick={() => setMode('video')}
                >
                  <h4>📸 Video Call</h4>
                  <p>Immersive experience</p>
                </div>
              </div>

              <div className="input-group">
                <label>Target Role</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. Senior Frontend Engineer"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Begin Session</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
