import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import ThemeSwitcher from '../components/common/ThemeSwitcher.jsx';
import '../components/Auth/Auth.css';

export default function LoginPage() {
  const { login, signInWithGoogle, googleAvailable, googleError } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(username, password);
      navigate('/chat');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-theme-picker">
        <ThemeSwitcher />
      </div>
      <div className="auth-card">
        <div className="auth-logo">
          <MessageCircle size={30} />
        </div>
        <h1>Welcome back</h1>
        <p className="subtitle">Log in to ChatterBox to keep chatting</p>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="error-text">{error}</p>}
          {googleError && <p className="error-text">{googleError}</p>}
          <button className="btn auth-submit" disabled={busy} type="submit">
            {busy ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        {/* Offered alongside the username and password, not instead of them.
            Existing accounts keep working exactly as before; the server takes
            either kind of token and resolves both to the same local user. */}
        {googleAvailable && (
          <>
            <div className="auth-divider"><span>or</span></div>
            <button className="btn auth-google" type="button" onClick={signInWithGoogle}>
              Continue with Google
            </button>
          </>
        )}

        <div className="auth-switch">
          New here?
          <Link to="/register" className="auth-switch-link">Create an account</Link>
        </div>
      </div>
    </div>
  );
}
