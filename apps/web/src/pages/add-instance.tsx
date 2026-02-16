import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { InstanceConnection } from '@opencord/api-client';
import { Button, Input } from '@opencord/ui';
import { useInstanceStore } from '@/stores/instance-store';
import { useAuthStore } from '@/stores/auth-store';
import { validateInstanceUrl } from '@opencord/shared';

export function AddInstancePage() {
  const [url, setUrl] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'url' | 'join'>('url');
  const [instanceUrl, setInstanceUrl] = useState('');

  const addInstance = useInstanceStore((s) => s.addInstance);
  const setInstanceConnection = useInstanceStore((s) => s.setInstanceConnection);
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

      // Verify the instance trusts the same auth server
      if (info.authServerUrl && authServerUrl && info.authServerUrl !== authServerUrl) {
        setError('This instance uses a different auth server than your account.');
        return;
      }

      addInstance(url, info);
      setInstanceUrl(url);
      setStep('join');
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
