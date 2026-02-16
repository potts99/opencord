import { useParams } from 'react-router-dom';
import { useMessages, useSendMessage, useWSMessages } from '@/hooks/use-messages';
import { useChannels } from '@/hooks/use-channels';
import { useActiveConnection } from '@/hooks/use-connection';
import { MessageList } from '@/components/message-list';
import { MessageInput } from '@/components/message-input';
import { MemberSidebar } from '@/components/member-sidebar';
import { Spinner } from '@opencord/ui';

export function ChannelPage() {
  const { channelId } = useParams<{ channelId: string }>();
  const connection = useActiveConnection();
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

  const sendMessage = useSendMessage(channelId!);

  const allMessages = data?.pages.flatMap((p) => p.data) ?? [];

  const handleSend = (content: string) => {
    sendMessage.mutate({ content });
  };

  const handleTyping = () => {
    connection?.sendTyping(channelId!);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex-1 flex">
      <div className="flex-1 flex flex-col">
        <div className="h-12 px-4 flex items-center border-b border-gray-900 gap-2">
          <span className="text-gray-500">#</span>
          <span className="font-semibold text-white">{channel?.name ?? 'Unknown'}</span>
        </div>

        <MessageList
          messages={allMessages}
          hasMore={!!hasNextPage}
          onLoadMore={() => fetchNextPage()}
          isLoading={isFetchingNextPage}
        />

        <MessageInput
          onSend={handleSend}
          onTyping={handleTyping}
          channelName={channel?.name}
        />
      </div>

      <MemberSidebar />
    </div>
  );
}
