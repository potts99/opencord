import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import type { CreateMessageRequest } from '@opencord/shared';
import { useActiveConnection } from './use-connection';
import { useInstanceStore } from '@/stores/instance-store';
import { useEffect } from 'react';

export function useMessages(channelId: string | undefined) {
  const connection = useActiveConnection();
  const activeUrl = useInstanceStore((s) => s.activeInstanceUrl);

  return useInfiniteQuery({
    queryKey: [activeUrl, 'messages', channelId],
    queryFn: ({ pageParam }) =>
      connection!.getMessages(channelId!, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || lastPage.data.length === 0) return undefined;
      return lastPage.data[lastPage.data.length - 1].id;
    },
    enabled: !!connection && !!channelId,
  });
}

export function useSendMessage(channelId: string) {
  const connection = useActiveConnection();

  return useMutation({
    mutationFn: (req: CreateMessageRequest) => connection!.sendMessage(channelId, req),
  });
}

export function useWSMessages(channelId: string | undefined) {
  const connection = useActiveConnection();
  const activeUrl = useInstanceStore((s) => s.activeInstanceUrl);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!connection || !channelId) return;

    connection.subscribeChannel(channelId);

    const unsubscribe = connection.onWSEvent((event) => {
      if (event.event === 'message_create') {
        queryClient.invalidateQueries({ queryKey: [activeUrl, 'messages', channelId] });
      }
      if (event.event === 'message_update') {
        queryClient.invalidateQueries({ queryKey: [activeUrl, 'messages', channelId] });
      }
      if (event.event === 'message_delete') {
        queryClient.invalidateQueries({ queryKey: [activeUrl, 'messages', channelId] });
      }
    });

    return () => {
      connection.unsubscribeChannel(channelId);
      unsubscribe();
    };
  }, [connection, channelId, activeUrl, queryClient]);
}

export function useMembers() {
  const connection = useActiveConnection();
  const activeUrl = useInstanceStore((s) => s.activeInstanceUrl);

  return useQuery({
    queryKey: [activeUrl, 'members'],
    queryFn: () => connection!.getMembers(),
    enabled: !!connection,
  });
}
