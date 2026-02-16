import { Routes, Route, Navigate } from 'react-router-dom';
import { useInstanceStore } from './stores/instance-store';
import { Layout } from './components/layout';
import { LoginPage } from './pages/login';
import { RegisterPage } from './pages/register';
import { AddInstancePage } from './pages/add-instance';
import { ChannelPage } from './pages/channel';
import { WelcomePage } from './pages/welcome';

export function App() {
  const instances = useInstanceStore((s) => s.instances);
  const hasInstances = instances.size > 0;

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/add-instance" element={<AddInstancePage />} />
      <Route path="/" element={hasInstances ? <Layout /> : <Navigate to="/add-instance" />}>
        <Route index element={<WelcomePage />} />
        <Route path="instance/:encodedUrl/channel/:channelId" element={<ChannelPage />} />
      </Route>
    </Routes>
  );
}
