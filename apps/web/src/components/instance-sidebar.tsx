import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInstanceStore } from '@/stores/instance-store';
import { useAuthStore } from '@/stores/auth-store';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
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
import { getInitials, hashColor } from '@/lib/utils';
import { toast } from 'sonner';

export function InstanceSidebar() {
  const instances = useInstanceStore((s) => s.instances);
  const activeUrl = useInstanceStore((s) => s.activeInstanceUrl);
  const setActive = useInstanceStore((s) => s.setActiveInstance);
  const removeInstance = useInstanceStore((s) => s.removeInstance);
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.user?.id);

  const [leaveTarget, setLeaveTarget] = useState<{ url: string; name: string } | null>(null);

  async function handleLeave(url: string) {
    const state = instances.get(url);
    if (!state?.connection || !userId) return;

    try {
      await state.connection.kickMember(userId);
      removeInstance(url);
      toast.success('Left instance');
      if (instances.size <= 1) {
        navigate('/add-instance');
      }
    } catch {
      toast.error('Failed to leave instance. Owners cannot leave.');
    } finally {
      setLeaveTarget(null);
    }
  }

  return (
    <div className="w-[72px] bg-background flex flex-col items-center py-3 gap-2 overflow-y-auto">
      {Array.from(instances.entries()).map(([url, state]) => {
        const name = state.info?.name ?? url;
        return (
          <ContextMenu key={url}>
            <Tooltip>
              <TooltipTrigger asChild>
                <ContextMenuTrigger asChild>
                  <button
                    onClick={() => setActive(url)}
                    className={`relative rounded-2xl hover:rounded-xl transition-all duration-200 ${
                      url === activeUrl ? 'rounded-xl' : ''
                    }`}
                  >
                    {url === activeUrl && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-1 h-10 bg-foreground rounded-r-full" />
                    )}
                    <Avatar className="size-12">
                      <AvatarImage src={state.info?.iconUrl ?? undefined} alt={name} />
                      <AvatarFallback style={{ backgroundColor: hashColor(name) }} className="text-white text-lg font-semibold">
                        {getInitials(name)}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </ContextMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="right">
                {name}
              </TooltipContent>
            </Tooltip>
            <ContextMenuContent>
              <ContextMenuItem
                variant="destructive"
                onSelect={() => setLeaveTarget({ url, name })}
              >
                Leave Instance
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        );
      })}

      <Separator className="w-8 my-1" />

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => navigate('/add-instance')}
            className="w-12 h-12 rounded-full bg-accent hover:bg-green-600 text-green-500 hover:text-white flex items-center justify-center text-2xl transition-colors"
          >
            +
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          Add Instance
        </TooltipContent>
      </Tooltip>

      <AlertDialog open={!!leaveTarget} onOpenChange={(open) => !open && setLeaveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave {leaveTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll need a new invite to rejoin this instance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => leaveTarget && handleLeave(leaveTarget.url)}
            >
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
