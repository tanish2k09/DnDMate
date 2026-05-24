import type { ServerMessage } from "@dndmate/shared";

/** Minimal structural type for anything that can receive a text WebSocket frame. */
export interface WsClient {
  send(data: string): void;
}

/** Tracks connected WebSocket clients and broadcasts server messages to them. */
export class WsHub {
  private readonly clients = new Set<WsClient>();

  add(client: WsClient): void {
    this.clients.add(client);
  }

  remove(client: WsClient): void {
    this.clients.delete(client);
  }

  /** Number of currently-connected clients. */
  get size(): number {
    return this.clients.size;
  }

  /** Send a message to a single client. */
  send(client: WsClient, message: ServerMessage): void {
    client.send(JSON.stringify(message));
  }

  /** Send a message to every connected client. */
  broadcast(message: ServerMessage): void {
    const payload = JSON.stringify(message);
    for (const client of this.clients) {
      client.send(payload);
    }
  }
}
