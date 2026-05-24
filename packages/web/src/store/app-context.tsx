import type { GameState, PreviewMessage } from "@dndmate/shared";
import { createContext, type ReactNode, useContext } from "react";
import { type RestClient, restClient } from "../api/rest-client";
import { type ConnectionStatus, usePixooConnection } from "../api/ws-client";

interface AppContextValue {
  status: ConnectionStatus;
  preview: PreviewMessage | null;
  state: GameState | null;
  actions: RestClient;
}

const AppContext = createContext<AppContextValue | null>(null);

/** Provides the live connection (status, preview, state) and the REST actions. */
export function AppProvider({ children }: { children: ReactNode }) {
  const connection = usePixooConnection();
  const value: AppContextValue = { ...connection, actions: restClient };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

/** Access the app's connection state and actions. */
export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
