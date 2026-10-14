// K컬처 "국가별 SNS 리서치" 로테이션/중복억제/파일누적 순수 로직.
// 실제 SNS 브라우징(Claude in Chrome)은 이 모듈을 쓰는 에이전트 세션이 담당한다.

export const COUNTRIES = [
  { code: "vi", label: "베트남" },
  { code: "th", label: "태국" },
  { code: "lo", label: "라오스" },
  { code: "id", label: "인도네시아" },
  { code: "my", label: "미얀마" },
  { code: "tl", label: "필리핀" },
  { code: "mn", label: "몽골" },
  { code: "ru", label: "기타(중앙아시아 등)" },
];

export function countryLabel(code) {
  const found = COUNTRIES.find((c) => c.code === code);
  return found ? found.label : code;
}

export function nextCountry(rotation) {
  return rotation.order[rotation.nextIndex % rotation.order.length];
}

export function advanceRotation(rotation, country, date) {
  const idx = rotation.order.indexOf(country);
  if (idx === -1) throw new Error(`advanceRotation: unknown country code "${country}" (not in order)`);
  return {
    ...rotation,
    nextIndex: (idx + 1) % rotation.order.length,
    history: [...rotation.history, { country, date }],
  };
}

export function filterNewItems(seen, country, items) {
  const seenUrls = new Set(Object.keys(seen[country] || {}));
  const batchUrls = new Set();
  const result = [];
  for (const item of items) {
    if (seenUrls.has(item.url) || batchUrls.has(item.url)) continue;
    batchUrls.add(item.url);
    result.push(item);
  }
  return result;
}

export function markSeen(seen, country, items, date) {
  const updated = { ...seen, [country]: { ...(seen[country] || {}) } };
  for (const item of items) updated[country][item.url] = date;
  return updated;
}

function renderItems(items) {
  return items.length
    ? items.map((it) => `- **${it.title}** — ${it.summary} [출처](${it.url})`).join("\n")
    : "- (이번 라운드엔 새로 찾은 항목 없음)";
}

export function renderCountrySection(date, practicalItems, fandomItems) {
  return [
    `## ${date} 수집`,
    "### 실용정보 (비자·서류·장학금·유학생 등)",
    renderItems(practicalItems),
    "",
    "### 연애·팬덤 (K-pop/K-drama 반응, 국제커플)",
    renderItems(fandomItems),
  ].join("\n");
}

export function appendCountryFile(existingMarkdown, label, date, practicalItems, fandomItems) {
  const section = renderCountrySection(date, practicalItems, fandomItems);
  if (!existingMarkdown || !existingMarkdown.trim()) {
    return `# ${label} — SNS 리서치\n\n${section}\n`;
  }
  return `${existingMarkdown.trimEnd()}\n\n${section}\n`;
}
