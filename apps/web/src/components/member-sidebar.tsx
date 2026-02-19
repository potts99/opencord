import { useMembers, useUpdateMemberRole } from '@/hooks/use-messages';
import { useAuthStore } from '@/stores/auth-store';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuLabel,
} from '@/components/ui/context-menu';
import { getInitials, hashColor } from '@/lib/utils';
import { toast } from 'sonner';
import type { Member } from '@opencord/shared';

export function MemberSidebar() {
  const { data: members } = useMembers();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const currentMember = members?.find((m) => m.userId === currentUserId);
  const isOwner = currentMember?.role === 'owner';

  const owners = members?.filter((m) => m.role === 'owner') ?? [];
  const admins = members?.filter((m) => m.role === 'admin') ?? [];
  const regular = members?.filter((m) => m.role === 'member') ?? [];

  return (
    <ScrollArea className="w-60 shrink-0 bg-card">
      <div className="px-2 py-4">
        {owners.length > 0 && (
          <MemberGroup title="Owner" members={owners} isOwner={isOwner} currentUserId={currentUserId} />
        )}
        {admins.length > 0 && (
          <MemberGroup title={`Admins - ${admins.length}`} members={admins} isOwner={isOwner} currentUserId={currentUserId} />
        )}
        {regular.length > 0 && (
          <MemberGroup title={`Members - ${regular.length}`} members={regular} isOwner={isOwner} currentUserId={currentUserId} />
        )}
      </div>
    </ScrollArea>
  );
}

function MemberGroup({ title, members, isOwner, currentUserId }: {
  title: string;
  members: Member[];
  isOwner: boolean;
  currentUserId?: string;
}) {
  const updateRole = useUpdateMemberRole();

  const handleRoleChange = (userId: string, role: 'admin' | 'member') => {
    updateRole.mutate({ userId, role }, {
      onError: (e: any) => {
        toast.error(e.message ?? 'Failed to update role');
      },
    });
  };

  return (
    <div className="mb-4">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2 mb-1">
        {title}
      </h3>
      {members.map((m) => {
        const name = m.displayName ?? 'Unknown';
        const isSelf = m.userId === currentUserId;
        const canManage = isOwner && !isSelf && m.role !== 'owner';

        return (
          <ContextMenu key={m.id}>
            <ContextMenuTrigger asChild>
              <div
                className={`flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer${
                  m.online ? '' : ' opacity-50'
                }`}
              >
                <div className="relative">
                  <Avatar className="size-8">
                    <AvatarImage src={m.avatarUrl ?? undefined} alt={name} />
                    <AvatarFallback style={{ backgroundColor: hashColor(name) }} className="text-white text-xs">
                      {getInitials(name)}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className={`absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-card ${
                      m.online ? 'bg-emerald-500' : 'bg-zinc-500'
                    }`}
                  />
                </div>
                <span className="text-sm text-foreground/80">{name}</span>
              </div>
            </ContextMenuTrigger>
            {canManage && (
              <ContextMenuContent>
                <ContextMenuLabel>{name}</ContextMenuLabel>
                <ContextMenuSeparator />
                {m.role === 'member' && (
                  <ContextMenuItem onSelect={() => handleRoleChange(m.userId, 'admin')}>
                    Promote to Admin
                  </ContextMenuItem>
                )}
                {m.role === 'admin' && (
                  <ContextMenuItem onSelect={() => handleRoleChange(m.userId, 'member')}>
                    Demote to Member
                  </ContextMenuItem>
                )}
              </ContextMenuContent>
            )}
          </ContextMenu>
        );
      })}
    </div>
  );
}
