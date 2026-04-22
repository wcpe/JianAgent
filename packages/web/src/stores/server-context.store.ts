import { create } from 'zustand';

interface ServerContextStore {
  activeServerId: string | null;
  setActiveServer: (id: string) => void;
  clearActiveServer: () => void;
}

export const useServerContext = create<ServerContextStore>((set) => ({
  activeServerId: null,
  setActiveServer: (id) => set({ activeServerId: id }),
  clearActiveServer: () => set({ activeServerId: null }),
}));
