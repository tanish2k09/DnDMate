import { describe, expect, test } from "bun:test";
import { PicIdManager } from "./pic-id-manager";

describe("PicIdManager", () => {
  test("hands out strictly increasing ids", () => {
    const manager = new PicIdManager(32);
    expect(manager.next()).toBe(1);
    expect(manager.next()).toBe(2);
    expect(manager.next()).toBe(3);
  });

  test("signals a reset after the configured number of pushes", () => {
    const manager = new PicIdManager(3);
    expect(manager.shouldReset()).toBe(false);
    manager.next();
    manager.next();
    expect(manager.shouldReset()).toBe(false);
    manager.next();
    expect(manager.shouldReset()).toBe(true);
  });

  test("markReset restarts the counter", () => {
    const manager = new PicIdManager(3);
    manager.next();
    manager.next();
    manager.next();
    manager.markReset();
    expect(manager.shouldReset()).toBe(false);
    expect(manager.next()).toBe(1);
  });

  test("seed re-bases the counter above the device value", () => {
    const manager = new PicIdManager(32);
    manager.seed(40);
    expect(manager.next()).toBe(41);
  });
});
