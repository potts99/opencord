import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { InstanceConnection } from '@opencord/api-client';
import { Button, Input } from '@opencord/ui';
import { useInstanceStore } from '@/stores/instance-store';
import { validateInstanceUrl } from '@opencord/shared';

export function AddInstancePage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'url' | 'auth'>('url');
  const [instanceUrl, setInstanceUrl] = useState('');
  const [isLogin, setIsLogin] = useState(true);

  // Auth form
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');

  const addInstance = useInstanceStore((s) => s.addInstance);
  const setInstanceAuth = useInstanceStore((s) => s.setInstanceAuth);
  const setInstanceConnection = useInstanceStore((s) => s.setInstanceConnection);
  const navigate = useNavigate();

  const handleConnect = async () => {
    const validationError = validateInstanceUrl(url);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const conn = new InstanceConnection(url);
      const info = await conn.getInstanceInfo();
      addInstance(url, info);
      setInstanceUrl(url);
      setStep('auth');
    } catch {
      setError('Could not connect to instance. Check the URL and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      const conn = new InstanceConnection(instanceUrl);
      let authResp;

      if (isLogin) {
        authResp = await conn.login({ email, password });
      } else {
        authResp = await conn.register({ email, username, displayName, password });
      }

      setInstanceAuth(instanceUrl, authResp.user, authResp.accessToken, authResp.refreshToken);
      conn.connectWS();
      setInstanceConnection(instanceUrl, conn);
      navigate('/');
    } catch (e: any) {
      setError(e.message ?? 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'url') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 p-8 rounded-xl w-full max-w-md">
          <h1 className="text-2xl font-bold text-white mb-2">Add an Instance</h1>
          <p className="text-gray-400 mb-6">
            Enter the URL of an OpenCord instance to connect to it.
          </p>
          <Input
            label="Instance URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://chat.example.com"
            error={error}
            onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
          />
          <Button
            onClick={handleConnect}
            loading={loading}
            className="w-full mt-4"
          >
            Connect
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-gray-800 p-8 rounded-xl w-full max-w-md">
        <h1 className="text-2xl font-bold text-white mb-2">
          {isLogin ? 'Sign In' : 'Create Account'}
        </h1>
        <p className="text-gray-400 mb-6">
          {isLogin ? 'Sign in to' : 'Create an account on'} {instanceUrl}
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
          />
        </div>

        <Button onClick={handleAuth} loading={loading} className="w-full mt-6">
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
