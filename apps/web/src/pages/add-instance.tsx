import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { InstanceConnection } from '@opencord/api-client';
import { useInstanceStore } from '@/stores/instance-store';
import { useAuthStore } from '@/stores/auth-store';
import { validateInstanceUrl } from '@opencord/shared';
import type { InstanceInfo } from '@opencord/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';

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
      const msg = 'Could not connect to instance. Check the URL and try again.';
      setError(msg);
      toast.error(msg);
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
      const msg = e.message ?? 'Failed to join instance';
      setError(msg);
      toast.error(msg);
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
      const msg = e.message ?? 'Authentication failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (step === 'url') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">Add an Instance</CardTitle>
            <CardDescription>
              Enter the URL of an OpenCord instance to connect to it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="instance-url">Instance URL</Label>
              <Input
                id="instance-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://chat.example.com"
                onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <Button
              onClick={handleConnect}
              disabled={loading}
              className="w-full mt-4"
            >
              {loading && <Spinner size="sm" className="text-primary-foreground" />}
              Connect
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'local-auth') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">
              {authMode === 'login' ? 'Log In' : 'Create Account'}
            </CardTitle>
            <CardDescription>
              {instanceInfo?.name ?? instanceUrl}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <p className="text-sm text-destructive mb-4">{error}</p>
            )}
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="local-email">Email</Label>
                <Input
                  id="local-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              {authMode === 'register' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="local-username">Username</Label>
                    <Input
                      id="local-username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="local-displayname">Display Name</Label>
                    <Input
                      id="local-displayname"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Display Name (optional)"
                    />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="local-password">Password</Label>
                <Input
                  id="local-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  onKeyDown={(e) => e.key === 'Enter' && handleLocalAuth()}
                />
              </div>
            </div>
            <Button onClick={handleLocalAuth} disabled={loading} className="w-full mt-4">
              {loading && <Spinner size="sm" className="text-primary-foreground" />}
              {authMode === 'login' ? 'Log In' : 'Create Account'}
            </Button>
            <button
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'register' : 'login');
                setError(null);
              }}
              className="w-full mt-3 text-sm text-muted-foreground hover:text-foreground/80"
            >
              {authMode === 'login' ? 'Need an account? Register' : 'Already have an account? Log in'}
            </button>
            <button
              onClick={() => { setStep('url'); setError(null); }}
              className="w-full mt-1 text-sm text-muted-foreground hover:text-foreground/80"
            >
              Back
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Join Instance</CardTitle>
          <CardDescription>
            Enter an invite code to join {instanceUrl}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="invite-code">Invite Code</Label>
            <Input
              id="invite-code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Enter invite code"
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <Button onClick={handleJoin} disabled={loading} className="w-full mt-4">
            {loading && <Spinner size="sm" className="text-primary-foreground" />}
            Join
          </Button>
          <button
            onClick={() => { setStep('url'); setError(null); }}
            className="w-full mt-3 text-sm text-muted-foreground hover:text-foreground/80"
          >
            Back
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
