import { useRef, useEffect } from 'react';
import type { Message } from '@opencord/shared';
import { Avatar } from '@opencord/ui';

interface MessageListProps {
  messages: Message[];
  hasMore: boolean;
  onLoadMore: () => void;
  isLoading: boolean;
}

export function MessageList({ messages, hasMore, onLoadMore, isLoading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Reverse messages since they come newest-first from API
  const sortedMessages = [...messages].reverse();

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-4">
      {hasMore && (
        <div className="flex justify-center py-2">
          <button
            onClick={onLoadMore}
            disabled={isLoading}
            className="text-sm text-indigo-400 hover:text-indigo-300"
          >
            {isLoading ? 'Loading...' : 'Load older messages'}
          </button>
        </div>
      )}

      {sortedMessages.map((msg, i) => {
        const prevMsg = i > 0 ? sortedMessages[i - 1] : null;
        const showHeader = !prevMsg || prevMsg.authorId !== msg.authorId ||
          new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() > 5 * 60 * 1000;

        return (
          <div
            key={msg.id}
            className={`group flex gap-4 px-2 py-0.5 hover:bg-gray-800/30 rounded ${
              showHeader ? 'mt-4' : ''
            }`}
          >
            {showHeader ? (
              <Avatar
                src={msg.author?.avatarUrl}
                name={msg.author?.displayName ?? 'Unknown'}
                size="sm"
              />
            ) : (
              <div className="w-8" />
            )}
            <div className="flex-1 min-w-0">
              {showHeader && (
                <div className="flex items-baseline gap-2">
                  <span className="font-medium text-white">
                    {msg.author?.displayName ?? 'Unknown'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(msg.createdAt).toLocaleString()}
                  </span>
                </div>
              )}
              <p className="text-gray-300 break-words">{msg.content}</p>
              {msg.imageUrl && (
                <img
                  src={msg.imageUrl}
                  alt=""
                  className="mt-2 max-w-md max-h-80 rounded-lg"
                />
              )}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
