import { randomUUID } from "node:crypto";
import { readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import {
  APP_VERSION,
  type SavedSnapshot,
  type SavedSnapshotMetadata,
  SNAPSHOT_SCHEMA_VERSION,
} from "../../shared";
import { readJson, writeJson } from "./json-store";
import { defaultState, normalizePersistedState, type PersistedState } from "./state-repository";

/**
 * Persists named snapshots of the game state into one JSON file per slot.
 *
 * Forward compatibility: every load runs through {@link normalizePersistedState},
 * which fills in defaults for missing fields. Adding a new field to
 * {@link PersistedState} therefore does not break old save files — the new
 * field simply uses its default until the user resaves.
 */
export class SnapshotRepository {
  constructor(private readonly dir: string) {}

  /** List all saved snapshots, newest first. Missing/corrupted files are skipped. */
  async list(): Promise<SavedSnapshotMetadata[]> {
    let entries: string[];
    try {
      entries = await readdir(this.dir);
    } catch {
      return [];
    }
    const results: SavedSnapshotMetadata[] = [];
    for (const file of entries) {
      if (!file.endsWith(".json")) continue;
      const snap = await this.readFile(join(this.dir, file));
      if (snap) results.push(stripPayload(snap));
    }
    results.sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
    return results;
  }

  /** Load a snapshot by id. Returns null if the file is missing or corrupted. */
  async load(id: string): Promise<SavedSnapshot | null> {
    return this.readFile(join(this.dir, `${id}.json`));
  }

  /** Save the given state as a new slot with a fresh id. */
  async save(name: string, state: PersistedState): Promise<SavedSnapshotMetadata> {
    const id = randomUUID();
    const snap: SavedSnapshot = {
      id,
      name: name.trim() || "Untitled",
      savedAt: new Date().toISOString(),
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      appVersion: APP_VERSION,
      payload: state as unknown as Record<string, unknown>,
    };
    await writeJson(join(this.dir, `${id}.json`), snap);
    return stripPayload(snap);
  }

  /** Delete a slot by id. Silent if the slot is already gone. */
  async delete(id: string): Promise<void> {
    try {
      await unlink(join(this.dir, `${id}.json`));
    } catch {
      // already gone — fine
    }
  }

  /** Write a snapshot envelope to an arbitrary path (Export to file…). */
  async exportToFile(path: string, name: string, state: PersistedState): Promise<void> {
    const snap: SavedSnapshot = {
      id: randomUUID(),
      name: name.trim() || "Untitled",
      savedAt: new Date().toISOString(),
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      appVersion: APP_VERSION,
      payload: state as unknown as Record<string, unknown>,
    };
    await writeJson(path, snap);
  }

  /** Read a snapshot envelope from an arbitrary path (Import from file…). */
  async importFromFile(path: string): Promise<SavedSnapshot | null> {
    return parseEnvelope(await readJson<unknown>(path, null));
  }

  /** Normalize a payload from any source back into a valid PersistedState. */
  static toPersistedState(payload: Record<string, unknown>): PersistedState {
    return normalizePersistedState(payload);
  }

  // -------------------------------------------------------------- internals

  private async readFile(path: string): Promise<SavedSnapshot | null> {
    return parseEnvelope(await readJson<unknown>(path, null));
  }
}

function stripPayload(snap: SavedSnapshot): SavedSnapshotMetadata {
  return {
    id: snap.id,
    name: snap.name,
    savedAt: snap.savedAt,
    schemaVersion: snap.schemaVersion,
    appVersion: snap.appVersion,
  };
}

function parseEnvelope(raw: unknown): SavedSnapshot | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Partial<SavedSnapshot>;
  if (typeof r.id !== "string" || typeof r.name !== "string") return null;
  if (typeof r.payload !== "object" || r.payload === null) return null;
  return {
    id: r.id,
    name: r.name,
    savedAt: typeof r.savedAt === "string" ? r.savedAt : new Date().toISOString(),
    schemaVersion: typeof r.schemaVersion === "number" ? r.schemaVersion : 1,
    appVersion: typeof r.appVersion === "string" ? r.appVersion : "0.0.0",
    payload: r.payload as Record<string, unknown>,
  };
}

// Re-export for tests that want a fresh default state.
export { defaultState };
