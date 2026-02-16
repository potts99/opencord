import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthClient } from '@opencord/api-client';
import { Button, Input } from '@opencord/ui';
import { useAuthStore } from '@/stores/auth-store';
import { validateEmail, validatePassword, validateUsername, validateDisplayName } from '@opencord/shared';

const DEFAULT_AUTH_URL = import.meta.env.VITE_AUTH_SERVER_URL || 'http://localhost:9090';

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');

  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  const handleSubmit = async () => {
    setError(null);

    const emailErr = validateEmail(email);
    if (emailErr) { setError(emailErr); return; }
    const passErr = validatePassword(password);
    if (passErr) { setError(passErr); return; }

    if (!isLogin) {
      const usernameErr = validateUsername(username);
      if (usernameErr) { setError(usernameErr); return; }
      const nameErr = validateDisplayName(displayName);
      if (nameErr) { setError(nameErr); return; }
    }

    setLoading(true);
    try {
      const client = new AuthClient(DEFAULT_AUTH_URL);
      let authResp;

      if (isLogin) {
        authResp = await client.login({ email, password });
      } else {
        authResp = await client.register({ email, username, displayName, password });
      }

      setAuth(DEFAULT_AUTH_URL, authResp.user, authResp.accessToken, authResp.refreshToken);
      navigate('/');
    } catch (e: any) {
      setError(e.message ?? 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-gray-800 p-8 rounded-xl w-full max-w-md">
        <h1 className="text-2xl font-bold text-white mb-2">
          {isLogin ? 'Welcome Back' : 'Create Account'}
        </h1>
        <p className="text-gray-400 mb-6">
          {isLogin ? 'Sign in to your OpenCord account.' : 'Create your OpenCord account to get started.'}
        </p>

        <div className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {!isLogin && (
            <>
              <Input
                label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <Input
                label="Display Name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </>
          )}
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
        </div>

        <Button onClick={handleSubmit} loading={loading} className="w-full mt-6">
          {isLogin ? 'Sign In' : 'Create Account'}
        </Button>

        <p className="text-center mt-4 text-sm text-gray-400">
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
            }}
            className="text-indigo-400 hover:text-indigo-300"
          >
            {isLogin ? 'Sign Up' : 'Sign In'}
          </button>
        </p>
      </div>
    </div>
  );
}
