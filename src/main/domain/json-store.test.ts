import { rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { readJson, writeJson } from "./json-store";

describe("json-store", () => {
  const path = join(tmpdir(), `dndmate-test-${crypto.randomUUID()}.json`);

  afterEach(async () => {
    await rm(path, { force: true });
  });

  test("round-trips data", async () => {
    await writeJson(path, { hello: "world", n: 7 });
    expect(await readJson<{ hello: string; n: number } | null>(path, null)).toEqual({
      hello: "world",
      n: 7,
    });
  });

  test("returns the fallback when the file is missing", async () => {
    const missing = join(tmpdir(), `dndmate-missing-${crypto.randomUUID()}.json`);
    expect(await readJson(missing, { fallback: true })).toEqual({ fallback: true });
  });

  test("returns the fallback when the file is invalid JSON", async () => {
    await writeFile(path, "{ not json");
    expect(await readJson(path, "fallback")).toBe("fallback");
  });
});
