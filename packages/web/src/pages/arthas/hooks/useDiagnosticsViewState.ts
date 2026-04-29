import { useCallback, useState } from 'react';
import type { DiagnosticsEvent, DiagnosticsViewState } from '../types/diagnostics-view.js';

export function useDiagnosticsViewState(): DiagnosticsViewState {
  const [events, setEvents] = useState<DiagnosticsEvent[]>([]);

  const pushEvent = useCallback((event: DiagnosticsEvent) => {
    setEvents((prev) => [...prev, event]);
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return {
    events,
    pushEvent,
    clearEvents,
  };
}
