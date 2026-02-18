import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { useChannels, useCreateChannel } from '@/hooks/use-channels';
import { useInstanceStore } from '@/stores/instance-store';
import { useAuthStore } from '@/stores/auth-store';
import type { Channel } from '@opencord/shared';

export function ChannelSidebar() {
  const { channelId } = useParams();
  const navigate = useNavigate();
  const activeUrl = useInstanceStore((s) => s.activeInstanceUrl);
  const activeInstance = useInstanceStore((s) =>
    s.activeInstanceUrl ? s.instances.get(s.activeInstanceUrl) : null
  );
  const centralUser = useAuthStore((s) => s.user);
  const isLocalAuth = !activeInstance?.info?.authServerUrl;
  const displayUser = isLocalAuth ? activeInstance?.user : centralUser;
  const { data: channels } = useChannels();
  const createChannel = useCreateChannel();
  const [showCreate, setShowCreate] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');

  const handleCreateChannel = () => {
    if (!newChannelName.trim()) return;
    createChannel.mutate(
      { name: newChannelName.trim(), type: 'text' },
      {
        onSuccess: () => {
          setNewChannelName('');
          setShowCreate(false);
        },
      }
    );
  };

  const navigateToChannel = (ch: Channel) => {
    if (!activeUrl) return;
    const encoded = encodeURIComponent(activeUrl);
    navigate(`/instance/${encoded}/channel/${ch.id}`);
  };

  return (
    <div className="w-60 bg-gray-800 flex flex-col">
      <div className="h-12 px-4 flex items-center border-b border-gray-900 font-semibold text-white">
        {activeInstance?.info?.name ?? 'OpenCord'}
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        <div className="flex items-center justify-between px-2 mb-1">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Text Channels
          </span>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="text-gray-400 hover:text-white text-lg leading-none"
          >
            +
          </button>
        </div>

        {showCreate && (
          <div className="px-2 mb-2">
            <input
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateChannel()}
              placeholder="new-channel"
              className="w-full px-2 py-1 text-sm bg-gray-900 border border-gray-600 rounded text-white"
              autoFocus
            />
          </div>
        )}

        {channels
          ?.filter((ch) => ch.type === 'text')
          .map((ch) => (
            <button
              key={ch.id}
              onClick={() => navigateToChannel(ch)}
              className={`w-full px-2 py-1.5 rounded text-left text-sm flex items-center gap-2 ${
                channelId === ch.id
                  ? 'bg-gray-600 text-white'
                  : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
              }`}
            >
              <span className="text-gray-500">#</span>
              {ch.name}
            </button>
          ))}

        {channels?.some((ch) => ch.type === 'voice') && (
          <>
            <div className="flex items-center px-2 mt-4 mb-1">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Voice Channels
              </span>
            </div>
            {channels
              .filter((ch) => ch.type === 'voice')
              .map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => navigateToChannel(ch)}
                  className={`w-full px-2 py-1.5 rounded text-left text-sm flex items-center gap-2 ${
                    channelId === ch.id
                      ? 'bg-gray-600 text-white'
                      : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                  }`}
                >
                  <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" />
                  </svg>
                  {ch.name}
                </button>
              ))}
          </>
        )}
      </div>

      <div className="h-14 px-2 flex items-center bg-gray-900/50 border-t border-gray-900">
        <div className="flex items-center gap-2 px-2">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-semibold">
            {displayUser?.displayName?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-white leading-tight">
              {displayUser?.displayName ?? 'Not logged in'}
            </span>
            <span className="text-xs text-gray-400 leading-tight">
              {displayUser?.username ?? ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
