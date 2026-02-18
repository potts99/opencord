import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { InstanceConnection } from '@opencord/api-client';
import { Button, Input } from '@opencord/ui';
import { useInstanceStore } from '@/stores/instance-store';
import { useAuthStore } from '@/stores/auth-store';
import { validateInstanceUrl } from '@opencord/shared';
import type { InstanceInfo } from '@opencord/shared';

export function AddInstancePage() {
  const [url, setUrl] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'url' | 'join' | 'local-auth'>('url');
  const [instanceUrl, setInstanceUrl] = useState('');
  const [instanceInfo, setInstanceInfo] = useState<InstanceInfo | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');

  const addInstance = useInstanceStore((s) => s.addInstance);
  const setInstanceConnection = useInstanceStore((s) => s.setInstanceConnection);
  const setInstanceAuth = useInstanceStore((s) => s.setInstanceAuth);
  const accessToken = useAuthStore((s) => s.accessToken);
  const authServerUrl = useAuthStore((s) => s.authServerUrl);
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

      setInstanceInfo(info);
      addInstance(url, info);
      setInstanceUrl(url);

      if (info.authServerUrl) {
        // Central auth: verify same auth server, then invite code flow
        if (authServerUrl && info.authServerUrl !== authServerUrl) {
          setError('This instance uses a different auth server than your account.');
          return;
        }
        setStep('join');
      } else {
        // Local auth: inline login/register
        setStep('local-auth');
      }
    } catch {
      setError('Could not connect to instance. Check the URL and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) {
      setError('Invite code is required');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const conn = new InstanceConnection(instanceUrl, {
        accessToken: accessToken ?? undefined,
      });

      await conn.joinWithInvite(inviteCode.trim());
      conn.connectWS();
      setInstanceConnection(instanceUrl, conn);
      navigate('/');
    } catch (e: any) {
      setError(e.message ?? 'Failed to join instance');
    } finally {
      setLoading(false);
    }
  };

  const handleLocalAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      const conn = new InstanceConnection(instanceUrl);
      let resp;

      if (authMode === 'register') {
        if (!email || !username || !password) {
          setError('All fields are required');
          setLoading(false);
          return;
        }
        resp = await conn.register({
          email,
          username,
          displayName: displayName || username,
          password,
        });
      } else {
        if (!email || !password) {
          setError('Email and password are required');
          setLoading(false);
          return;
        }
        resp = await conn.login({ email, password });
      }

      setInstanceAuth(instanceUrl, resp.user, resp.accessToken, resp.refreshToken);
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

  if (step === 'local-auth') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 p-8 rounded-xl w-full max-w-md">
          <h1 className="text-2xl font-bold text-white mb-2">
            {authMode === 'login' ? 'Log In' : 'Create Account'}
          </h1>
          <p className="text-gray-400 mb-6">
            {instanceInfo?.name ?? instanceUrl}
          </p>
          {error && (
            <p className="text-red-400 text-sm mb-4">{error}</p>
          )}
          <div className="space-y-3">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            {authMode === 'register' && (
              <>
                <Input
                  label="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username"
                />
                <Input
                  label="Display Name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Display Name (optional)"
                />
              </>
            )}
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              onKeyDown={(e) => e.key === 'Enter' && handleLocalAuth()}
            />
          </div>
          <Button onClick={handleLocalAuth} loading={loading} className="w-full mt-4">
            {authMode === 'login' ? 'Log In' : 'Create Account'}
          </Button>
          <button
            onClick={() => {
              setAuthMode(authMode === 'login' ? 'register' : 'login');
              setError(null);
            }}
            className="w-full mt-3 text-sm text-gray-400 hover:text-gray-300"
          >
            {authMode === 'login' ? 'Need an account? Register' : 'Already have an account? Log in'}
          </button>
          <button
            onClick={() => { setStep('url'); setError(null); }}
            className="w-full mt-1 text-sm text-gray-400 hover:text-gray-300"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-gray-800 p-8 rounded-xl w-full max-w-md">
        <h1 className="text-2xl font-bold text-white mb-2">Join Instance</h1>
        <p className="text-gray-400 mb-6">
          Enter an invite code to join {instanceUrl}
        </p>
        <Input
          label="Invite Code"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          placeholder="Enter invite code"
          error={error}
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
        />
        <Button onClick={handleJoin} loading={loading} className="w-full mt-4">
          Join
        </Button>
        <button
          onClick={() => { setStep('url'); setError(null); }}
          className="w-full mt-3 text-sm text-gray-400 hover:text-gray-300"
        >
          Back
        </button>
      </div>
    </div>
  );
}
