import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { wsClient } from '../../ws/ws-client.js';

export function WsStatusBanner() {
  const { t } = useTranslation();
  const [disconnected, setDisconnected] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setDisconnected(!wsClient.connected && wsClient.reconnecting);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  if (!disconnected) return null;

  return (
    <div className="bg-warning-600 text-warning-100 text-sm text-center py-1.5 px-4">
      {t('wsStatus.disconnected')}
    </div>
  );
}
