import { create } from 'zustand';
import type { AlertDto, AlertSummaryDto, AlertRuleDto, CreateAlertRuleDto } from '@jian-agent/shared-domain';
import { alertsApi } from './alerts.api.js';

interface AlertsState {
  readonly alerts: readonly AlertDto[];
  readonly summary: AlertSummaryDto | null;
  readonly rules: readonly AlertRuleDto[];
  readonly loading: boolean;
  readonly error: string | null;
}

interface AlertsActions {
  fetchAlerts: () => Promise<void>;
  fetchSummary: () => Promise<void>;
  fetchRules: () => Promise<void>;
  acknowledgeAlert: (id: string) => Promise<void>;
  createRule: (dto: CreateAlertRuleDto) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  pushAlert: (alert: AlertDto) => void;
}

const MAX_ALERTS = 200;

export const useAlertsStore = create<AlertsState & AlertsActions>((set, get) => ({
  alerts: [],
  summary: null,
  rules: [],
  loading: false,
  error: null,

  fetchAlerts: async () => {
    set({ loading: true });
    try {
      const res = await alertsApi.listAlerts();
      const alerts = Array.isArray(res) ? res : (res as any)?.data ?? [];
      set({ alerts, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  fetchSummary: async () => {
    try {
      const summary = await alertsApi.getSummary();
      set({ summary });
    } catch {
      // silent
    }
  },

  fetchRules: async () => {
    try {
      const res = await alertsApi.listRules();
      const rules = Array.isArray(res) ? res : (res as any)?.data ?? [];
      set({ rules });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  acknowledgeAlert: async (id) => {
    await alertsApi.acknowledge(id);
    set((s) => ({
      alerts: s.alerts.map((a) =>
        a.id === id ? { ...a, acknowledged: true } : a,
      ),
    }));
    get().fetchSummary();
  },

  createRule: async (dto) => {
    await alertsApi.createRule(dto);
    get().fetchRules();
  },

  deleteRule: async (id) => {
    await alertsApi.deleteRule(id);
    get().fetchRules();
  },

  pushAlert: (alert) => {
    set((s) => ({
      alerts: [alert, ...s.alerts].slice(0, MAX_ALERTS),
    }));
    get().fetchSummary();
  },
}));
