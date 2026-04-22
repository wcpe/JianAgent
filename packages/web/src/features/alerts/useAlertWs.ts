import { useCallback } from 'react';
import { useAlertsStore } from './alerts.store.js';
import { useWsChannel } from '../../ws/use-ws-channel.js';
import type { AlertDto } from '@jian-agent/shared-domain';

export function useAlertWs(): void {
  const pushAlert = useAlertsStore((s) => s.pushAlert);
  const handleAlert = useCallback(
    (payload: { alert: AlertDto }) => {
      if (payload?.alert) pushAlert(payload.alert);
    },
    [pushAlert],
  );
  useWsChannel('alert:fired', handleAlert);
}
