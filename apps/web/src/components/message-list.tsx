import { useRef, useEffect } from 'react';
import type { Message } from '@opencord/shared';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getInitials, hashColor } from '@/lib/utils';

interface MessageListProps {
  messages: Message[];
  hasMore: boolean;
  onLoadMore: () => void;
  isLoading: boolean;
}

export function MessageList({ messages, hasMore, onLoadMore, isLoading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Reverse messages since they come newest-first from API
  const sortedMessages = [...messages].reverse();

  return (
    <ScrollArea className="flex-1">
      <div className="px-4 py-4">
        {hasMore && (
          <div className="flex justify-center py-2">
            <button
              onClick={onLoadMore}
              disabled={isLoading}
              className="text-sm text-primary hover:text-primary/80"
            >
              {isLoading ? 'Loading...' : 'Load older messages'}
            </button>
          </div>
        )}

        {sortedMessages.map((msg, i) => {
          const prevMsg = i > 0 ? sortedMessages[i - 1] : null;
          const showHeader = !prevMsg || prevMsg.authorId !== msg.authorId ||
            new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() > 5 * 60 * 1000;

          const authorName = msg.author?.displayName ?? 'Unknown';

          return (
            <div
              key={msg.id}
              className={`group flex gap-4 px-2 py-0.5 hover:bg-accent/30 rounded ${
                showHeader ? 'mt-4' : ''
              }`}
            >
              {showHeader ? (
                <Avatar className="size-8">
                  <AvatarImage src={msg.author?.avatarUrl ?? undefined} alt={authorName} />
                  <AvatarFallback style={{ backgroundColor: hashColor(authorName) }} className="text-white text-xs">
                    {getInitials(authorName)}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div className="w-8" />
              )}
              <div className="flex-1 min-w-0">
                {showHeader && (
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium text-foreground">
                      {authorName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(msg.createdAt).toLocaleString()}
                    </span>
                  </div>
                )}
                <p className="text-foreground/80 break-words">{msg.content}</p>
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
    </ScrollArea>
  );
}
