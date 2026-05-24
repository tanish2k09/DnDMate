import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { SnapshotRepository } from "./snapshot-repository";
import { defaultState, type PersistedState } from "./state-repository";

function sampleState(): PersistedState {
  return {
    ...defaultState(),
    party: [{ id: "p1", name: "Grog", currentHp: 30, maxHp: 30, charClass: "barbarian" }],
    enemies: [{ id: "e1", name: "Goblin", currentHp: 7, maxHp: 7, charClass: "other" }],
  };
}

describe("SnapshotRepository", () => {
  let dir: string;
  let repo: SnapshotRepository;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "dndmate-snap-"));
    repo = new SnapshotRepository(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test("save round-trips through load with party + enemies preserved", async () => {
    const meta = await repo.save("Friday Game", sampleState());
    expect(meta.name).toBe("Friday Game");
    const loaded = await repo.load(meta.id);
    expect(loaded).not.toBeNull();
    const state = SnapshotRepository.toPersistedState(loaded!.payload);
    expect(state.party[0]).toEqual({
      id: "p1",
      name: "Grog",
      currentHp: 30,
      maxHp: 30,
      charClass: "barbarian",
    });
    expect(state.enemies[0]).toEqual({
      id: "e1",
      name: "Goblin",
      currentHp: 7,
      maxHp: 7,
      charClass: "other",
    });
  });

  test("list returns newest-first metadata only (no payload)", async () => {
    const a = await repo.save("A", sampleState());
    await new Promise((r) => setTimeout(r, 5));
    const b = await repo.save("B", sampleState());
    const list = await repo.list();
    expect(list.map((s) => s.id)).toEqual([b.id, a.id]);
    // No payload leak in the listing type.
    expect("payload" in list[0]).toBe(false);
  });

  test("delete removes a slot and is silent on missing", async () => {
    const meta = await repo.save("Tmp", sampleState());
    await repo.delete(meta.id);
    expect(await repo.load(meta.id)).toBeNull();
    await expect(repo.delete(meta.id)).resolves.not.toThrow();
  });

  test("export writes a valid envelope that import can re-parse", async () => {
    const file = join(dir, "exported.json");
    await repo.exportToFile(file, "Backup", sampleState());
    const text = await readFile(file, "utf-8");
    const parsed = JSON.parse(text);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.name).toBe("Backup");

    const imported = await repo.importFromFile(file);
    expect(imported?.name).toBe("Backup");
    const state = SnapshotRepository.toPersistedState(imported!.payload);
    expect(state.party[0].name).toBe("Grog");
  });

  test("forward-compat: a payload with an unknown future field loads cleanly", async () => {
    const meta = await repo.save("FromFuture", sampleState());
    // Hand-edit the file to inject a field this version doesn't know.
    const path = join(dir, `${meta.id}.json`);
    const raw = JSON.parse(await readFile(path, "utf-8"));
    raw.payload.future_field = { something: "new" };
    const { writeFile } = await import("node:fs/promises");
    await writeFile(path, JSON.stringify(raw));
    const loaded = await repo.load(meta.id);
    expect(loaded).not.toBeNull();
    const state = SnapshotRepository.toPersistedState(loaded!.payload);
    // Unknown field is dropped; known fields survive.
    expect(state.party[0].name).toBe("Grog");
    expect((state as unknown as { future_field?: unknown }).future_field).toBeUndefined();
  });

  test("malformed file is ignored in list and load returns null", async () => {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(join(dir, "garbage.json"), "{not valid json");
    expect(await repo.list()).toEqual([]);
    expect(await repo.load("garbage")).toBeNull();
  });
});
