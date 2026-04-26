import { create } from 'zustand';

interface ServerContextStore {
  activeServerId: string | null;
  /** Alias for activeServerId — used by pages that prefer the `currentServerId` naming */
  currentServerId: string | null;
  setActiveServer: (id: string) => void;
  /** Alias for setActiveServer — sets both activeServerId and currentServerId */
  setCurrentServerId: (id: string | null) => void;
  clearActiveServer: () => void;
}

export const useServerContext = create<ServerContextStore>((set) => ({
  activeServerId: null,
  currentServerId: null,
  setActiveServer: (id) => set({ activeServerId: id, currentServerId: id }),
  setCurrentServerId: (id) => set({ activeServerId: id, currentServerId: id }),
  clearActiveServer: () => set({ activeServerId: null, currentServerId: null }),
}));
