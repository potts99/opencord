import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { useChannels, useCreateChannel, useUpdateChannel, useDeleteChannel } from '@/hooks/use-channels';
import { useInstanceStore } from '@/stores/instance-store';
import { useAuthStore } from '@/stores/auth-store';
import type { Channel } from '@opencord/shared';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from '@/components/ui/context-menu';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { hashColor } from '@/lib/utils';
import { toast } from 'sonner';

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
  const updateChannel = useUpdateChannel();
  const deleteChannel = useDeleteChannel();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [editTarget, setEditTarget] = useState<Channel | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Channel | null>(null);

  const handleCreateChannel = () => {
    const name = newChannelName.trim();
    if (!name) return;
    createChannel.mutate(
      { name, type: 'text' },
      {
        onSuccess: () => {
          setNewChannelName('');
          setDialogOpen(false);
        },
        onError: (e: any) => {
          toast.error(e.message ?? 'Failed to create channel');
        },
      }
    );
  };

  const handleRename = () => {
    const name = editName.trim();
    if (!name || !editTarget) return;
    updateChannel.mutate(
      { id: editTarget.id, name },
      {
        onSuccess: () => {
          setEditTarget(null);
          setEditName('');
        },
        onError: (e: any) => {
          toast.error(e.message ?? 'Failed to rename channel');
        },
      }
    );
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    const deletedId = deleteTarget.id;
    deleteChannel.mutate(deletedId, {
      onSuccess: () => {
        setDeleteTarget(null);
        if (channelId === deletedId && activeUrl) {
          const remaining = channels?.filter((c) => c.id !== deletedId);
          if (remaining && remaining.length > 0) {
            navigate(`/instance/${encodeURIComponent(activeUrl)}/channel/${remaining[0].id}`);
          }
        }
      },
      onError: (e: any) => {
        toast.error(e.message ?? 'Failed to delete channel');
      },
    });
  };

  const navigateToChannel = (ch: Channel) => {
    if (!activeUrl) return;
    const encoded = encodeURIComponent(activeUrl);
    navigate(`/instance/${encoded}/channel/${ch.id}`);
  };

  const userName = displayUser?.displayName ?? 'Not logged in';

  const renderChannelButton = (ch: Channel, icon: React.ReactNode) => (
    <ContextMenu key={ch.id}>
      <ContextMenuTrigger asChild>
        <button
          onClick={() => navigateToChannel(ch)}
          className={`w-full px-2 py-1.5 rounded text-left text-sm flex items-center gap-2 ${
            channelId === ch.id
              ? 'bg-secondary text-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground/80'
          }`}
        >
          {icon}
          {ch.name}
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => { setEditTarget(ch); setEditName(ch.name); }}>
          Edit Channel
        </ContextMenuItem>
        <ContextMenuItem
          variant="destructive"
          onSelect={() => setDeleteTarget(ch)}
        >
          Delete Channel
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );

  return (
    <div className="w-60 bg-card flex flex-col">
      <div className="h-12 px-4 flex items-center border-b border-border font-semibold text-foreground">
        {activeInstance?.info?.name ?? 'OpenCord'}
      </div>

      <ScrollArea className="flex-1">
        <div className="px-2 py-2">
          <div className="flex items-center justify-between px-2 mb-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Text Channels
            </span>
            <button
              onClick={() => setDialogOpen(true)}
              className="text-muted-foreground hover:text-foreground text-lg leading-none"
            >
              +
            </button>
          </div>

          {channels
            ?.filter((ch) => ch.type === 'text')
            .map((ch) => renderChannelButton(ch, <span className="text-muted-foreground">#</span>))}

          {channels?.some((ch) => ch.type === 'voice') && (
            <>
              <div className="flex items-center px-2 mt-4 mb-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Voice Channels
                </span>
              </div>
              {channels
                .filter((ch) => ch.type === 'voice')
                .map((ch) => renderChannelButton(ch,
                  <svg className="w-4 h-4 text-muted-foreground" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" />
                  </svg>
                ))}
            </>
          )}
        </div>
      </ScrollArea>

      <div className="h-14 px-2 flex items-center bg-background/50 border-t border-border">
        <div className="flex items-center gap-2 px-2">
          <Avatar className="size-8">
            <AvatarFallback style={{ backgroundColor: hashColor(userName) }} className="text-white text-xs font-semibold">
              {displayUser?.displayName?.[0]?.toUpperCase() ?? '?'}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground leading-tight">
              {displayUser?.displayName ?? 'Not logged in'}
            </span>
            <span className="text-xs text-muted-foreground leading-tight">
              {displayUser?.username ?? ''}
            </span>
          </div>
        </div>
      </div>

      {/* Create Channel Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) setNewChannelName('');
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Channel</DialogTitle>
            <DialogDescription>
              Add a new text channel to this instance.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="channel-name">Channel Name</Label>
            <Input
              id="channel-name"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateChannel()}
              placeholder="new-channel"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateChannel}
              disabled={!newChannelName.trim() || createChannel.isPending}
            >
              {createChannel.isPending && <Spinner size="sm" className="text-primary-foreground" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Channel Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => {
        if (!open) { setEditTarget(null); setEditName(''); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Channel</DialogTitle>
            <DialogDescription>
              Rename this channel.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="edit-channel-name">Channel Name</Label>
            <Input
              id="edit-channel-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleRename}
              disabled={!editName.trim() || updateChannel.isPending}
            >
              {updateChannel.isPending && <Spinner size="sm" className="text-primary-foreground" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Channel Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete #{deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this channel and all its messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
