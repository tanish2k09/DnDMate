import type { GameState, PreviewMessage, ServerMessage } from "@dndmate/shared";
import { useEffect, useState } from "react";

export type ConnectionStatus = "connecting" | "open" | "closed";

/** Delay before attempting to reconnect after the socket drops. */
const RECONNECT_DELAY_MS = 1500;

/** Build the WebSocket URL for the same origin the page was served from. */
function socketUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

export interface PixooConnection {
  status: ConnectionStatus;
  preview: PreviewMessage | null;
  state: GameState | null;
}

/**
 * Maintain a WebSocket to the DnDMate server, auto-reconnecting if it drops,
 * and expose the latest preview frame and game state.
 */
export function usePixooConnection(): PixooConnection {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [preview, setPreview] = useState<PreviewMessage | null>(null);
  const [state, setState] = useState<GameState | null>(null);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const connect = () => {
      setStatus("connecting");
      socket = new WebSocket(socketUrl());

      socket.onopen = () => setStatus("open");

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as ServerMessage;
          if (message.type === "preview") {
            setPreview(message);
          } else if (message.type === "state") {
            setState(message.state);
          }
        } catch {
          // Ignore malformed frames.
        }
      };

      socket.onclose = () => {
        setStatus("closed");
        if (!disposed) {
          reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
        }
      };

      socket.onerror = () => socket?.close();
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);

  return { status, preview, state };
}
