import { Routes, Route, Navigate } from 'react-router-dom';
import { useInstanceStore } from './stores/instance-store';
import { useAuthStore } from './stores/auth-store';
import { Layout } from './components/layout';
import { AuthPage } from './pages/auth';
import { AddInstancePage } from './pages/add-instance';
import { ChannelPage } from './pages/channel';
import { WelcomePage } from './pages/welcome';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  if (!accessToken) {
    return <Navigate to="/auth" replace />;
  }
  return <>{children}</>;
}

export function App() {
  const instances = useInstanceStore((s) => s.instances);
  const hasInstances = instances.size > 0;

  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route
        path="/add-instance"
        element={
          <RequireAuth>
            <AddInstancePage />
          </RequireAuth>
        }
      />
      <Route
        path="/"
        element={
          <RequireAuth>
            {hasInstances ? <Layout /> : <Navigate to="/add-instance" />}
          </RequireAuth>
        }
      >
        <Route index element={<WelcomePage />} />
        <Route path="instance/:encodedUrl/channel/:channelId" element={<ChannelPage />} />
      </Route>
    </Routes>
  );
}
