import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, utimesSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { kstDate, stripTags, purgeOldFiles } from "./_lib.mjs";

test("kstDate: YYYY-MM-DD 형식", () => {
  assert.match(kstDate(new Date("2026-08-29T00:00:00Z")), /^\d{4}-\d{2}-\d{2}$/);
});

test("kstDate: Asia/Seoul(UTC+9) — UTC 20:00은 다음날 KST", () => {
  assert.equal(kstDate(new Date("2026-08-29T20:00:00Z")), "2026-08-30");
});

test("stripTags: 태그 제거 + 엔티티 디코드", () => {
  assert.equal(stripTags("<b>A</b> &amp; <i>B</i>"), "A & B");
  assert.equal(stripTags("  &lt;tag&gt; &quot;q&quot;  "), '<tag> "q"');
});

test("purgeOldFiles: 오래되고 패턴 매칭하는 파일만 삭제, 삭제 목록 반환", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "purge-"));
  const old = path.join(dir, "raw-2020-01-01.json");
  const fresh = path.join(dir, "raw-2099-01-01.json");
  const other = path.join(dir, "keep.txt");
  writeFileSync(old, "{}");
  writeFileSync(fresh, "{}");
  writeFileSync(other, "x");
  const oldSecs = Date.now() / 1000 - 70 * 24 * 60 * 60;
  utimesSync(old, oldSecs, oldSecs);

  const purged = purgeOldFiles(dir, /^raw-\d{4}-\d{2}-\d{2}\.json$/, 60);

  assert.deepEqual(purged, ["raw-2020-01-01.json"]);
  assert.ok(!existsSync(old), "old 삭제됨");
  assert.ok(existsSync(fresh), "fresh 유지");
  assert.ok(existsSync(other), "비매칭 파일 유지");
});

test("purgeOldFiles: 없는 디렉터리는 [] 반환", () => {
  assert.deepEqual(
    purgeOldFiles(path.join(tmpdir(), "nope-" + Date.now()), /./, 1),
    [],
  );
});
