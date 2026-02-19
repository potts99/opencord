import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import type { CreateMessageRequest, UpdateMessageRequest, UpdateMemberRequest } from '@opencord/shared';
import { useActiveConnection } from './use-connection';
import { useInstanceStore } from '@/stores/instance-store';
import { useEffect, useState, useCallback } from 'react';

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

export function useEditMessage(channelId: string) {
  const connection = useActiveConnection();
  const activeUrl = useInstanceStore((s) => s.activeInstanceUrl);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ messageId, content }: { messageId: string; content: string }) =>
      connection!.updateMessage(messageId, { content } as UpdateMessageRequest),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [activeUrl, 'messages', channelId] });
    },
  });
}

export function useDeleteMessage(channelId: string) {
  const connection = useActiveConnection();
  const activeUrl = useInstanceStore((s) => s.activeInstanceUrl);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageId: string) => connection!.deleteMessage(messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [activeUrl, 'messages', channelId] });
    },
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

export function useTypingIndicator(channelId: string | undefined) {
  const connection = useActiveConnection();
  const [typers, setTypers] = useState<Map<string, { name: string; timeout: ReturnType<typeof setTimeout> }>>(new Map());

  useEffect(() => {
    if (!connection || !channelId) return;

    const unsubscribe = connection.onWSEvent((event) => {
      if (event.event === 'typing_start') {
        const data = event.data as { userId: string; username: string; channelId: string };
        if (data.channelId !== channelId) return;

        setTypers((prev) => {
          const next = new Map(prev);
          const existing = next.get(data.userId);
          if (existing) clearTimeout(existing.timeout);
          const timeout = setTimeout(() => {
            setTypers((p) => {
              const n = new Map(p);
              n.delete(data.userId);
              return n;
            });
          }, 5000);
          next.set(data.userId, { name: data.username, timeout });
          return next;
        });
      }
    });

    return () => {
      unsubscribe();
      setTypers((prev) => {
        for (const v of prev.values()) clearTimeout(v.timeout);
        return new Map();
      });
    };
  }, [connection, channelId]);

  const names = Array.from(typers.values()).map((t) => t.name);
  return names;
}

export function useUpdateMemberRole() {
  const connection = useActiveConnection();
  const activeUrl = useInstanceStore((s) => s.activeInstanceUrl);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'admin' | 'member' }) =>
      connection!.updateMemberRole(userId, { role } as UpdateMemberRequest),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [activeUrl, 'members'] });
    },
  });
}

export function useWSPresence() {
  const connection = useActiveConnection();
  const activeUrl = useInstanceStore((s) => s.activeInstanceUrl);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!connection) return;

    const unsubscribe = connection.onWSEvent((event) => {
      if (event.event === 'presence_update') {
        queryClient.invalidateQueries({ queryKey: [activeUrl, 'members'] });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [connection, activeUrl, queryClient]);
}
