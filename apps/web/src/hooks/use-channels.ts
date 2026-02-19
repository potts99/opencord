import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Channel, CreateChannelRequest, UpdateChannelRequest } from '@opencord/shared';
import { useActiveConnection } from './use-connection';
import { useInstanceStore } from '@/stores/instance-store';

export function useChannels() {
  const connection = useActiveConnection();
  const activeUrl = useInstanceStore((s) => s.activeInstanceUrl);

  return useQuery({
    queryKey: [activeUrl, 'channels'],
    queryFn: () => connection!.getChannels(),
    enabled: !!connection,
  });
}

export function useCreateChannel() {
  const connection = useActiveConnection();
  const activeUrl = useInstanceStore((s) => s.activeInstanceUrl);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (req: CreateChannelRequest) => connection!.createChannel(req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [activeUrl, 'channels'] });
    },
  });
}

export function useUpdateChannel() {
  const connection = useActiveConnection();
  const activeUrl = useInstanceStore((s) => s.activeInstanceUrl);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...req }: UpdateChannelRequest & { id: string }) =>
      connection!.updateChannel(id, req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [activeUrl, 'channels'] });
    },
  });
}

export function useDeleteChannel() {
  const connection = useActiveConnection();
  const activeUrl = useInstanceStore((s) => s.activeInstanceUrl);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => connection!.deleteChannel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [activeUrl, 'channels'] });
    },
  });
}
