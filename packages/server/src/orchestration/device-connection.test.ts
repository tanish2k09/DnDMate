import { describe, expect, test } from "bun:test";
import { Framebuffer } from "../render";
import { DeviceConnection } from "./device-connection";

describe("DeviceConnection", () => {
  test("is offline when no host is configured", () => {
    const connection = new DeviceConnection();
    connection.update({ host: null, brightness: 75, model: "pixoo-max" });
    expect(connection.health).toBe("offline");
  });

  test("drops frame pushes when offline without throwing", () => {
    const connection = new DeviceConnection();
    connection.update({ host: null, brightness: 75, model: "pixoo-max" });
    expect(() => connection.push(new Framebuffer(32, 32))).not.toThrow();
  });

  test("creates a client when a host is configured", () => {
    const connection = new DeviceConnection();
    connection.update({ host: "127.0.0.1:65535", brightness: 75, model: "pixoo-max" });
    expect(connection.health).not.toBe("offline");
    connection.dispose();
  });
});
