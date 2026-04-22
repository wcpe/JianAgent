import { useEffect, useRef } from 'react';
import { wsClient } from '../ws/ws-client.js';

export function useWsRoom(rooms: readonly string[]): void {
  const joinedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    wsClient.connect();

    const toJoin = rooms.filter((r) => !joinedRef.current.has(r));
    const toLeave = [...joinedRef.current].filter((r) => !rooms.includes(r));

    for (const room of toLeave) {
      wsClient.send({ type: 'unsubscribe', room });
      joinedRef.current.delete(room);
    }

    for (const room of toJoin) {
      wsClient.send({ type: 'subscribe', room });
      joinedRef.current.add(room);
    }

    return () => {
      for (const room of joinedRef.current) {
        wsClient.send({ type: 'unsubscribe', room });
      }
      joinedRef.current.clear();
    };
  }, [rooms.join(',')]);
}
