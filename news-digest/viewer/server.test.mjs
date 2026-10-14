import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { listCountries } from "./server.mjs";

test("listCountries: 파일이 하나도 없으면 8개국 전부 updated=null", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "kculture-countries-"));
  try {
    const list = listCountries(dir);
    assert.equal(list.length, 8);
    assert.ok(list.every((c) => c.updated === null));
    assert.deepEqual(list.map((c) => c.code), ["vi", "th", "lo", "id", "my", "tl", "mn", "ru"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("listCountries: 파일이 있는 나라만 mtime을 돌려준다", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "kculture-countries-"));
  try {
    writeFileSync(path.join(dir, "vi.md"), "# 베트남 — SNS 리서치\n");
    const list = listCountries(dir);
    const vi = list.find((c) => c.code === "vi");
    const th = list.find((c) => c.code === "th");
    assert.ok(typeof vi.updated === "number" && vi.updated > 0);
    assert.equal(th.updated, null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
