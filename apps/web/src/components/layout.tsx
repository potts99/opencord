import { Outlet } from 'react-router-dom';
import { InstanceSidebar } from './instance-sidebar';
import { ChannelSidebar } from './channel-sidebar';
import { useInitConnections } from '@/hooks/use-connection';

export function Layout() {
  useInitConnections();

  return (
    <div className="flex h-screen overflow-hidden">
      <InstanceSidebar />
      <ChannelSidebar />
      <main className="flex-1 flex flex-col bg-gray-700">
        <Outlet />
      </main>
    </div>
  );
}
