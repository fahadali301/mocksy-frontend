import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

const API_BASE = import.meta.env.VITE_API_BASE || `http://${window.location.hostname}:8000`;

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('mocksy_token'));
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('mocksy_user');
    return saved ? JSON.parse(saved) : null;
  });

  const isAuthenticated = !!token;

  const login = async (email, password) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.detail || 'Login failed');
    }
    const data = await res.json();
    localStorage.setItem('mocksy_token', data.access_token);
    localStorage.setItem('mocksy_user', JSON.stringify({ email }));
    setToken(data.access_token);
    setUser({ email });
    return data;
  };

  const register = async (name, email, password, designation) => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, designation }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.detail || 'Registration failed');
    }
    return await res.json();
  };

  const logout = () => {
    localStorage.removeItem('mocksy_token');
    localStorage.removeItem('mocksy_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, isAuthenticated, login, register, logout, API_BASE }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
