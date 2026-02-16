import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Channel, CreateChannelRequest } from '@opencord/shared';
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
