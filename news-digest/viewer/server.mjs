// 줍줍 뉴스 뷰어 — news-digest 폴더의 결과를 http://localhost:3030 에서 보여주는 로컬 서버.
// 외부 패키지 없이 Node 내장 모듈만 사용. 127.0.0.1 에만 열리므로 내 컴퓨터에서만 접속 가능.
//   실행:  node news-digest/viewer/server.mjs        (보통은 "open-viewer.bat" 더블클릭)
//   옵션:  --no-open  브라우저 자동 열기 안 함 / PORT 환경변수로 포트 변경

import http from "node:http";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { exec } from "node:child_process";
import { COUNTRIES } from "../kculture/countries/_lib.mjs";

const PORT = Number(process.env.PORT) || 3030; // 3000은 줍줍 Next.js 개발 서버와 겹칠 수 있어 3030 사용
const HOST = "127.0.0.1";
const VIEWER_DIR = path.dirname(fileURLToPath(import.meta.url));
const DIGEST_DIR = path.resolve(VIEWER_DIR, "..");
const URL_ = `http://localhost:${PORT}`;

const SECTIONS = {
  daily: {
    label: "Daily 뉴스",
    dir: path.join(DIGEST_DIR, "daily"),
    summary: /^(\d{4}-\d{2}-\d{2})\.md$/,
    raw: /^raw-(\d{4}-\d{2}-\d{2})\.json$/,
    log: path.join(DIGEST_DIR, "daily", "fetch.log"),
  },
  kculture: {
    label: "K-컬처",
    dir: path.join(DIGEST_DIR, "kculture"),
    summary: /^(\d{4}-\d{2}-\d{2})\.md$/,
    raw: /^raw-kculture-(\d{4}-\d{2}-\d{2})\.json$/,
    log: path.join(DIGEST_DIR, "kculture", "fetch.log"),
  },
};

const COUNTRIES_DIR = path.join(DIGEST_DIR, "kculture", "countries");

export function listCountries(dir = COUNTRIES_DIR) {
  return COUNTRIES.map(({ code, label }) => {
    const file = path.join(dir, `${code}.md`);
    let updated = null;
    try {
      updated = statSync(file).mtimeMs;
    } catch {
      // 아직 이 나라는 조사 전
    }
    return { code, label, updated };
  });
}

function readText(p) {
  return readFileSync(p, "utf8").replace(/^﻿/, "");
}

function listSection(key) {
  const s = SECTIONS[key];
  const days = new Map();
  let names = [];
  try { names = readdirSync(s.dir); } catch { /* 폴더 없음 */ }
  for (const name of names) {
    let m, kind;
    if ((m = name.match(s.summary))) kind = "summary";
    else if ((m = name.match(s.raw))) kind = "raw";
    else continue;
    const date = m[1];
    const st = statSync(path.join(s.dir, name));
    const d = days.get(date) || { date };
    d[kind] = { file: name, size: st.size, mtime: st.mtimeMs };
    days.set(date, d);
  }
  return [...days.values()].sort((a, b) => b.date.localeCompare(a.date));
}

function tailLog(p, lines = 40) {
  if (!existsSync(p)) return null;
  const all = readText(p).split(/\r?\n/).filter(Boolean);
  return all.slice(-lines).join("\n");
}

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  try {
    const u = new URL(req.url, URL_);
    const parts = u.pathname.split("/").filter(Boolean);

    if (u.pathname === "/" || u.pathname === "/index.html") {
      return send(res, 200, readFileSync(path.join(VIEWER_DIR, "index.html")), "text/html; charset=utf-8");
    }

    // GET /api/list  → 두 섹션의 날짜 목록 + 최근 로그
    if (u.pathname === "/api/list") {
      const out = {};
      for (const key of Object.keys(SECTIONS)) {
        out[key] = { label: SECTIONS[key].label, days: listSection(key), log: tailLog(SECTIONS[key].log) };
      }
      out.kculture.countries = listCountries();
      return send(res, 200, out);
    }

    // GET /api/summary/:section/:date   → 요약 md 원문
    // GET /api/raw/:section/:date       → 수집 원본 json
    if (parts[0] === "api" && (parts[1] === "summary" || parts[1] === "raw") && parts.length === 4) {
      const [, kind, key, date] = parts;
      const s = SECTIONS[key];
      if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return send(res, 400, { error: "bad request" });
      const day = listSection(key).find((d) => d.date === date);
      const entry = day && day[kind];
      if (!entry) return send(res, 404, { error: "not found" });
      const text = readText(path.join(s.dir, entry.file));
      if (kind === "summary") return send(res, 200, { file: entry.file, mtime: entry.mtime, markdown: text });
      return send(res, 200, text);
    }

    // GET /api/country/:code → 국가별 누적 SNS 리서치 파일 원문
    if (parts[0] === "api" && parts[1] === "country" && parts.length === 3) {
      const code = parts[2];
      if (!COUNTRIES.some((c) => c.code === code)) return send(res, 400, { error: "bad request" });
      const file = path.join(COUNTRIES_DIR, `${code}.md`);
      if (!existsSync(file)) return send(res, 404, { error: "not found" });
      return send(res, 200, { file: `${code}.md`, mtime: statSync(file).mtimeMs, markdown: readText(file) });
    }

    send(res, 404, { error: "not found" });
  } catch (err) {
    console.error(err);
    send(res, 500, { error: String(err.message || err) });
  }
});

function openBrowser() {
  if (process.argv.includes("--no-open")) return;
  const cmd = process.platform === "win32" ? `start "" "${URL_}"`
    : process.platform === "darwin" ? `open "${URL_}"` : `xdg-open "${URL_}"`;
  exec(cmd, () => {});
}

function start() {
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      // 이미 켜져 있으면 브라우저만 열고 종료
      console.log(`이미 실행 중입니다 → ${URL_}`);
      openBrowser();
      setTimeout(() => process.exit(0), 500);
    } else {
      console.error(err);
      process.exit(1);
    }
  });

  server.listen(PORT, HOST, () => {
    console.log(`줍줍 뉴스 뷰어 실행 중 → ${URL_}`);
    console.log(`보는 폴더: ${DIGEST_DIR}`);
    console.log("이 창을 닫으면 뷰어가 꺼집니다.");
    openBrowser();
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  start();
}
