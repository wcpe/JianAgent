import { useEffect, useState } from 'react';
import { wsClient } from '../../ws/ws-client.js';

export function WsStatusBanner() {
  const [disconnected, setDisconnected] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setDisconnected(!wsClient.connected && wsClient.reconnecting);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  if (!disconnected) return null;

  return (
    <div className="bg-yellow-600 text-yellow-100 text-sm text-center py-1.5 px-4">
      实时连接已断开，正在重连…
    </div>
  );
}
