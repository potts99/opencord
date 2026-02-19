import { useParams } from 'react-router-dom';
import { useMessages, useSendMessage, useEditMessage, useDeleteMessage, useWSMessages, useWSPresence, useTypingIndicator } from '@/hooks/use-messages';
import { useChannels } from '@/hooks/use-channels';
import { useActiveConnection } from '@/hooks/use-connection';
import { useAuthStore } from '@/stores/auth-store';
import { MessageList } from '@/components/message-list';
import { MessageInput } from '@/components/message-input';
import { MemberSidebar } from '@/components/member-sidebar';
import { Skeleton } from '@/components/ui/skeleton';

function MessageSkeleton() {
  return (
    <div className="flex gap-4 px-2 py-2">
      <Skeleton className="size-8 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
    </div>
  );
}

export function ChannelPage() {
  const { channelId } = useParams<{ channelId: string }>();
  const connection = useActiveConnection();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const { data: channels } = useChannels();
  const channel = channels?.find((c) => c.id === channelId);

  const {
    data,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useMessages(channelId);
  useWSMessages(channelId);
  useWSPresence();

  const sendMessage = useSendMessage(channelId!);
  const editMessage = useEditMessage(channelId!);
  const deleteMessage = useDeleteMessage(channelId!);
  const typingNames = useTypingIndicator(channelId, currentUserId);

  const allMessages = data?.pages.flatMap((p) => p.data) ?? [];

  const handleSend = (content: string) => {
    sendMessage.mutate({ content });
  };

  const handleTyping = () => {
    connection?.sendTyping(channelId!);
  };

  const handleEdit = (messageId: string, content: string) => {
    editMessage.mutate({ messageId, content });
  };

  const handleDelete = (messageId: string) => {
    deleteMessage.mutate(messageId);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex">
        <div className="flex-1 flex flex-col">
          <div className="h-12 px-4 flex items-center border-b border-border gap-2">
            <span className="text-muted-foreground">#</span>
            <Skeleton className="h-5 w-24" />
          </div>
          <div className="flex-1 px-4 py-4 space-y-4">
            <MessageSkeleton />
            <MessageSkeleton />
            <MessageSkeleton />
            <MessageSkeleton />
            <MessageSkeleton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex">
      <div className="flex-1 flex flex-col">
        <div className="h-12 px-4 flex items-center border-b border-border gap-2">
          <span className="text-muted-foreground">#</span>
          <span className="font-semibold text-foreground">{channel?.name ?? 'Unknown'}</span>
        </div>

        <MessageList
          messages={allMessages}
          hasMore={!!hasNextPage}
          onLoadMore={() => fetchNextPage()}
          isLoading={isFetchingNextPage}
          currentUserId={currentUserId}
          onEditMessage={handleEdit}
          onDeleteMessage={handleDelete}
        />

        <div className="relative">
          {typingNames.length > 0 && (
            <div className="absolute -top-6 left-4 text-xs text-muted-foreground">
              {typingNames.length === 1
                ? `${typingNames[0]} is typing...`
                : typingNames.length === 2
                  ? `${typingNames[0]} and ${typingNames[1]} are typing...`
                  : `${typingNames[0]} and ${typingNames.length - 1} others are typing...`}
            </div>
          )}
          <MessageInput
            onSend={handleSend}
            onTyping={handleTyping}
            channelName={channel?.name}
          />
        </div>
      </div>

      <MemberSidebar />
    </div>
  );
}
