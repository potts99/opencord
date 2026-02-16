import { useNavigate } from 'react-router-dom';
import { useInstanceStore } from '@/stores/instance-store';
import { Avatar } from '@opencord/ui';

export function InstanceSidebar() {
  const instances = useInstanceStore((s) => s.instances);
  const activeUrl = useInstanceStore((s) => s.activeInstanceUrl);
  const setActive = useInstanceStore((s) => s.setActiveInstance);
  const navigate = useNavigate();

  return (
    <div className="w-[72px] bg-gray-900 flex flex-col items-center py-3 gap-2 overflow-y-auto">
      {Array.from(instances.entries()).map(([url, state]) => (
        <button
          key={url}
          onClick={() => setActive(url)}
          className={`relative rounded-2xl hover:rounded-xl transition-all duration-200 ${
            url === activeUrl ? 'rounded-xl' : ''
          }`}
          title={state.info?.name ?? url}
        >
          {url === activeUrl && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-1 h-10 bg-white rounded-r-full" />
          )}
          <Avatar
            src={state.info?.iconUrl}
            name={state.info?.name ?? url}
            size="lg"
          />
        </button>
      ))}

      <div className="w-12 h-[2px] bg-gray-700 rounded-full my-1" />

      <button
        onClick={() => navigate('/add-instance')}
        className="w-12 h-12 rounded-full bg-gray-700 hover:bg-green-600 text-green-500 hover:text-white flex items-center justify-center text-2xl transition-colors"
        title="Add Instance"
      >
        +
      </button>
    </div>
  );
}
