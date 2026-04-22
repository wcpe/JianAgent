import type { ServerWithStatusDto } from '@jian-agent/shared-domain';
import { ServerCard } from './ServerCard.js';

interface ServerCardGridProps {
  readonly servers: readonly ServerWithStatusDto[];
  readonly onEdit: (server: ServerWithStatusDto) => void;
  readonly onTerminal: (serverId: string) => void;
  readonly selectedIds?: ReadonlySet<string>;
  readonly onToggleSelect?: (serverId: string) => void;
}

export function ServerCardGrid({ servers, onEdit, onTerminal, selectedIds, onToggleSelect }: ServerCardGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {servers.map((server, index) => (
        <ServerCard
          key={server.id}
          server={server}
          index={index}
          onEdit={() => onEdit(server)}
          onTerminal={() => onTerminal(server.id)}
          isSelected={selectedIds?.has(server.id)}
          onToggleSelect={onToggleSelect ? () => onToggleSelect(server.id) : undefined}
        />
      ))}
    </div>
  );
}
