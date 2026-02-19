import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthClient } from '@opencord/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { validateEmail, validatePassword, validateUsername, validateDisplayName } from '@opencord/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';

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
      const msg = e.message ?? 'Authentication failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </CardTitle>
          <CardDescription>
            {isLogin ? 'Sign in to your OpenCord account.' : 'Create your OpenCord account to get started.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          </div>

          <Button onClick={handleSubmit} disabled={loading} className="w-full mt-6">
            {loading && <Spinner size="sm" className="text-primary-foreground" />}
            {isLogin ? 'Sign In' : 'Create Account'}
          </Button>

          <p className="text-center mt-4 text-sm text-muted-foreground">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
              }}
              className="text-primary hover:text-primary/80"
            >
              {isLogin ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
