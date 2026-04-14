import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Don't show navbar on auth pages
  if (['/login', '/register'].includes(location.pathname)) return null;
  if (!isAuthenticated) return null;

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 32px',
      borderBottom: '1px solid var(--border-glass)',
      background: 'rgba(10, 14, 26, 0.8)',
      backdropFilter: 'blur(20px)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <Link to="/dashboard" style={{
        fontSize: '1.25rem',
        fontWeight: 800,
        background: 'var(--accent-gradient)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        letterSpacing: '-0.02em',
      }}>
        ◆ Mocksy
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <Link to="/dashboard" style={{
          fontSize: '0.85rem',
          color: location.pathname === '/dashboard' ? 'var(--accent)' : 'var(--text-secondary)',
          fontWeight: 500,
        }}>
          Dashboard
        </Link>

        <span style={{
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
        }}>
          {user?.email}
        </span>

        <button
          onClick={handleLogout}
          className="btn btn-outline"
          style={{ padding: '6px 16px', fontSize: '0.8rem' }}
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
