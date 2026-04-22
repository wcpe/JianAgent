import { useMemo } from 'react';
import { useWsRoom } from './useWsRoom.js';

export function useServerRealtime(
  serverId: string | null,
  channels: readonly ('output' | 'status' | 'bots')[],
): void {
  const rooms = useMemo(() => {
    if (!serverId) return [];
    const result: string[] = [];
    if (channels.includes('output') || channels.includes('status')) {
      result.push(`server:${serverId}`);
    }
    if (channels.includes('status')) {
      result.push('servers:status');
    }
    if (channels.includes('bots')) {
      result.push(`bots:status:${serverId}`);
    }
    return result;
  }, [serverId, channels.join(',')]);

  useWsRoom(rooms);
}
