import { create } from 'zustand';

export interface PromptHistoryItem {
  id: string;
  prompt: string;
  timestamp: Date;
  page: string;
  response?: string;
}

export interface PilotState {
  pilotMode: boolean;
  electrolyzerLoad: number; // MW
  hyshiftEnabled: boolean;
  promptHistory: PromptHistoryItem[];
  reportOpen: boolean;

  // Actions
  togglePilotMode: () => void;
  setElectrolyzerLoad: (mw: number) => void;
  setHyshiftEnabled: (enabled: boolean) => void;
  submitPrompt: (prompt: string, page: string, response?: string) => void;
  toggleReport: () => void;
  setReportOpen: (isOpen: boolean) => void;
}

export const usePilotStore = create<PilotState>((set) => ({
  pilotMode: true,
  electrolyzerLoad: 65,
  hyshiftEnabled: true,
  promptHistory: [],
  reportOpen: false,

  togglePilotMode: () => set((state) => ({ pilotMode: !state.pilotMode })),

  setElectrolyzerLoad: (mw) => set({ electrolyzerLoad: mw }),

  setHyshiftEnabled: (enabled) => set({ hyshiftEnabled: enabled }),

  submitPrompt: (prompt, page, response) =>
  set((state) => ({
    promptHistory: [
    {
      id: Date.now().toString(),
      prompt,
      timestamp: new Date(),
      page,
      response
    },
    ...state.promptHistory]

  })),

  toggleReport: () => set((state) => ({ reportOpen: !state.reportOpen })),

  setReportOpen: (isOpen) => set({ reportOpen: isOpen })
}));