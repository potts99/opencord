import { useMembers } from '@/hooks/use-messages';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getInitials, hashColor } from '@/lib/utils';

export function MemberSidebar() {
  const { data: members } = useMembers();

  const owners = members?.filter((m) => m.role === 'owner') ?? [];
  const admins = members?.filter((m) => m.role === 'admin') ?? [];
  const regular = members?.filter((m) => m.role === 'member') ?? [];

  return (
    <ScrollArea className="w-60 bg-card">
      <div className="px-2 py-4">
        {owners.length > 0 && (
          <MemberGroup title="Owner" members={owners} />
        )}
        {admins.length > 0 && (
          <MemberGroup title={`Admins - ${admins.length}`} members={admins} />
        )}
        {regular.length > 0 && (
          <MemberGroup title={`Members - ${regular.length}`} members={regular} />
        )}
      </div>
    </ScrollArea>
  );
}

function MemberGroup({ title, members }: { title: string; members: any[] }) {
  return (
    <div className="mb-4">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2 mb-1">
        {title}
      </h3>
      {members.map((m) => {
        const name = m.displayName ?? 'Unknown';
        return (
          <div
            key={m.id}
            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
          >
            <Avatar className="size-8">
              <AvatarImage src={m.avatarUrl ?? undefined} alt={name} />
              <AvatarFallback style={{ backgroundColor: hashColor(name) }} className="text-white text-xs">
                {getInitials(name)}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-foreground/80">{name}</span>
          </div>
        );
      })}
    </div>
  );
}
