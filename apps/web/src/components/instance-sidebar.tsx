import { useNavigate } from 'react-router-dom';
import { useInstanceStore } from '@/stores/instance-store';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { getInitials, hashColor } from '@/lib/utils';

export function InstanceSidebar() {
  const instances = useInstanceStore((s) => s.instances);
  const activeUrl = useInstanceStore((s) => s.activeInstanceUrl);
  const setActive = useInstanceStore((s) => s.setActiveInstance);
  const navigate = useNavigate();

  return (
    <div className="w-[72px] bg-background flex flex-col items-center py-3 gap-2 overflow-y-auto">
      {Array.from(instances.entries()).map(([url, state]) => {
        const name = state.info?.name ?? url;
        return (
          <Tooltip key={url}>
            <TooltipTrigger asChild>
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
            </TooltipTrigger>
            <TooltipContent side="right">
              {name}
            </TooltipContent>
          </Tooltip>
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
    </div>
  );
}
