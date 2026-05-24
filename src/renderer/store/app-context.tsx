import { createContext, type ReactNode, useContext } from "react";
import type { GameState, PreviewMessage } from "../../shared";
import {
  type ConnectionStatus,
  type IpcClient,
  ipcClient,
  usePixooConnection,
} from "../api/ipc-client";

interface AppContextValue {
  status: ConnectionStatus;
  preview: PreviewMessage | null;
  state: GameState | null;
  actions: IpcClient;
}

const AppContext = createContext<AppContextValue | null>(null);

/** Provides the live IPC connection (status, preview, state) and action client. */
export function AppProvider({ children }: { children: ReactNode }) {
  const connection = usePixooConnection();
  const value: AppContextValue = { ...connection, actions: ipcClient };
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
