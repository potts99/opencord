import { useMembers } from '@/hooks/use-messages';
import { Avatar } from '@opencord/ui';

export function MemberSidebar() {
  const { data: members } = useMembers();

  const owners = members?.filter((m) => m.role === 'owner') ?? [];
  const admins = members?.filter((m) => m.role === 'admin') ?? [];
  const regular = members?.filter((m) => m.role === 'member') ?? [];

  return (
    <div className="w-60 bg-gray-800 overflow-y-auto px-2 py-4">
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
  );
}

function MemberGroup({ title, members }: { title: string; members: any[] }) {
  return (
    <div className="mb-4">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2 mb-1">
        {title}
      </h3>
      {members.map((m) => (
        <div
          key={m.id}
          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-700 cursor-pointer"
        >
          <Avatar src={m.avatarUrl} name={m.displayName} size="sm" />
          <span className="text-sm text-gray-300">{m.displayName}</span>
        </div>
      ))}
    </div>
  );
}
