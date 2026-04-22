import { create } from 'zustand';

export interface SessionSummaryState {
  readonly id: string;
  readonly name: string;
  readonly state: string;
  readonly currentPhase?: string | null;
  readonly createdAt?: string;
}

interface SessionState {
  readonly sessions: readonly SessionSummaryState[];
  readonly selectedSessionId: string | null;
  readonly loading: boolean;
  setSessions: (sessions: SessionSummaryState[]) => void;
  selectSession: (id: string | null) => void;
  setLoading: (v: boolean) => void;
  updateSessionState: (id: string, state: string, currentPhase?: string | null) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessions: [],
  selectedSessionId: null,
  loading: false,
  setSessions: (sessions) => set({ sessions }),
  selectSession: (id) => set({ selectedSessionId: id }),
  setLoading: (v) => set({ loading: v }),
  updateSessionState: (id, state, currentPhase) =>
    set((prev) => ({
      sessions: prev.sessions.map((s) =>
        s.id === id ? { ...s, state, currentPhase: currentPhase ?? s.currentPhase } : s,
      ),
    })),
}));
