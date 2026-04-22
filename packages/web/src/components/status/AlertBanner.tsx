import { useState, useCallback } from 'react';
import { useWsChannel } from '../../ws/use-ws-channel.js';

interface AlertPayload {
  readonly alert: {
    readonly id: string;
    readonly level: string;
    readonly message: string;
  };
}

const LEVEL_STYLES: Record<string, string> = {
  CRITICAL: 'bg-red-600 text-white',
  WARNING: 'bg-yellow-500 text-black',
  INFO: 'bg-blue-500 text-white',
};

export function AlertBanner() {
  const [latestAlert, setLatestAlert] = useState<AlertPayload['alert'] | null>(null);

  const handleAlert = useCallback((payload: AlertPayload) => {
    if (payload?.alert) {
      setLatestAlert(payload.alert);
      setTimeout(() => setLatestAlert(null), 5000);
    }
  }, []);

  useWsChannel('alert:fired', handleAlert);

  if (!latestAlert) return null;

  return (
    <div
      className={`px-4 py-2 text-sm font-medium ${
        LEVEL_STYLES[latestAlert.level] ?? 'bg-gray-500 text-white'
      }`}
    >
      [{latestAlert.level}] {latestAlert.message}
    </div>
  );
}
