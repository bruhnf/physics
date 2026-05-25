/**
 * App-wide settings store.
 *
 * Currently in-memory only — state resets on app launch. Adding persistence
 * (expo-secure-store or AsyncStorage) requires a native rebuild, so it'll
 * land alongside the next dev/prod build cycle.
 *
 * `showInstructions` is the global "show or don't show experiment overlays"
 * toggle. `dismissedThisSession` tracks per-level dismissals from the OK
 * button so the overlay doesn't re-appear when the player navigates back
 * into a level they've already seen — but a fresh app launch shows them
 * again (intentional until persistence lands).
 */
import { create } from 'zustand';

type SettingsState = {
  showInstructions: boolean;
  dismissedThisSession: Record<string, boolean>;
  setShowInstructions: (v: boolean) => void;
  dismissLevel: (id: string) => void;
  clearAllDismissals: () => void;
};

export const useSettings = create<SettingsState>((set) => ({
  showInstructions: true,
  dismissedThisSession: {},
  setShowInstructions: (v) => set({ showInstructions: v }),
  dismissLevel: (id) =>
    set((state) => ({
      dismissedThisSession: { ...state.dismissedThisSession, [id]: true },
    })),
  clearAllDismissals: () => set({ dismissedThisSession: {}, showInstructions: true }),
}));
