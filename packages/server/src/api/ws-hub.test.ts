import { describe, expect, test } from "bun:test";
import type { PreviewMessage } from "@dndmate/shared";
import { type WsClient, WsHub } from "./ws-hub";

const SAMPLE: PreviewMessage = { type: "preview", width: 1, height: 1, data: "AAAA" };

function fakeClient(): { client: WsClient; sent: string[] } {
  const sent: string[] = [];
  return {
    sent,
    client: {
      send(data: string) {
        sent.push(data);
      },
    },
  };
}

describe("WsHub", () => {
  test("broadcasts to every connected client", () => {
    const hub = new WsHub();
    const a = fakeClient();
    const b = fakeClient();
    hub.add(a.client);
    hub.add(b.client);

    hub.broadcast(SAMPLE);

    expect(hub.size).toBe(2);
    expect(a.sent).toHaveLength(1);
    expect(b.sent).toHaveLength(1);
    expect(JSON.parse(a.sent[0])).toEqual(SAMPLE);
  });

  test("stops sending to a removed client", () => {
    const hub = new WsHub();
    const a = fakeClient();
    hub.add(a.client);
    hub.remove(a.client);

    hub.broadcast(SAMPLE);

    expect(hub.size).toBe(0);
    expect(a.sent).toHaveLength(0);
  });

  test("send targets a single client", () => {
    const hub = new WsHub();
    const a = fakeClient();
    const b = fakeClient();
    hub.add(a.client);
    hub.add(b.client);

    hub.send(a.client, SAMPLE);

    expect(a.sent).toHaveLength(1);
    expect(b.sent).toHaveLength(0);
  });
});
