# K-컬처 & 라이프 주간 다이제스트

주 1회, 앱 취지(한국 거주 동남아·중앙아 외국인)에 맞는 문화·라이프 소식을 한 페이지로
정리한다. 기존 `news-digest/`(네이버 일일 요약)와 **별개** 파이프라인이다.

## 4개 섹션 (고정 순서)
1. K-pop 소식
2. K-drama 소식
3. 한국인과의 연애 후기
4. 동남아 쇼츠 — 베트남·태국·인도네시아·필리핀, 각국 YouTube Shorts 조회수 상위 2개
   (검색어가 한국 스코프를 잡음(키워드 게이트 없음), 최근 7일 → 14일 → 90일 순 폴백,
   그래도 없으면 "조건 충족 영상 없음" note)

## 실행 모델 (하이브리드)
- `news-digest/fetch-kculture.mjs` 가 Exa 웹검색 + RSS + YouTube Shorts 를 모아
  `kculture/raw-kculture-<날짜>.json` 을 만든다. `.env.local` 불필요.
  `node news-digest/fetch-kculture.mjs`
- 사용자가 "K컬처 요약해줘" 류로 요청하면, 이 세션이 Reddit·TikTok 을 보태고 전체를
  `kculture/<날짜>.md` 로 요약한다.
- 생성물(`raw-kculture-*.json`, `<날짜>.md`)은 **로컬 전용 — git commit 안 함.**

## 요약 요청 시 절차 (Claude용)

1. 날짜 태그 = 실행일 KST `YYYY-MM-DD`. `kculture/raw-kculture-<날짜>.json` 이 없거나
   7일 넘게 오래됐으면 먼저 `node news-digest/fetch-kculture.mjs` 실행.
2. **Reddit (연애 후기):** `kculture/sources.json` 의 `reddit` 항목마다
   `opencli reddit search "<query>" -f yaml` (필요 시 서브레딧 지정). opencli 데몬
   다운 / `AUTH_REQUIRED` 면 `redditStatus = "미수집 (로그인/연결 실패)"` 로 기록하고 계속.
   히트 → `{ source: "reddit:<sub>", keyword: "dating", title, description(본문 발췌), link, date }`.
3. **TikTok (보조, best-effort):** `opencli tiktok search "<query>" -f yaml` — K-pop /
   K-drama / "dating in korea" 류. 실패하면 조용히 스킵.
   히트 → `{ source: "tiktok", keyword, title, description, link, views }`.
4. 2·3 결과를 `kculture/raw-kculture-<날짜>.json` 에 같은 스키마로 append.
5. **원문 읽기:** 후보 기사(쇼츠·틱톡 제외)마다 `curl -s "https://r.jina.ai/<link>"` 로
   본문을 확보한 뒤 요약. 최대 약 15건.
6. **`kculture/<날짜>.md` 작성** (`TEMPLATE.md` 형식):
   - 각 항목: `**<원어 제목>** (<한국어 번역>)` + 한국어 요약 1~2문장 + `원문: <link>`
   - 쇼츠: 국가별 소제목, 최대 2개, 각 `조회수 N만 · <채널>` + 링크. note가 있으면 그대로 표기.
   - `redditStatus` 가 미수집이면 "한국인과의 연애 후기" 섹션 머리에 그 사실을 적는다.
7. **로컬 전용:** git add / commit / push 하지 않는다.
8. 대화창에 섹션별 하이라이트만 짧게 보고. 60일 지나 삭제한 `<날짜>.md` 가 있으면 언급.

## 편집 규칙
- 루머·미확인·낚시성 제외. K-pop 열애설/해체설 등은 공식 확인된 것만.
- **연애 후기: 개인 식별정보(닉네임·구체 신상·사진) 제거.** 개별 사연을 나열하지 말고
  주제·팁·경향 단위로 묶어 요약하고, 대표 출처 링크만 몇 개 남긴다.
  (프로젝트 CLAUDE.md "만남" 카테고리 주의사항과 동일선상.)
- 광고·협찬·명백한 개인 홍보 제외.
- 원문 전문 복사 금지 — 제목 + 1~2문장 + 링크만.

## 60일 정리
요약 세션에서 `kculture/` 안의 날짜형 `<YYYY-MM-DD>.md` 중 오늘 KST 기준 60일보다
오래된 것을 삭제한다. (`raw-kculture-*.json` 은 `fetch-kculture.mjs` 가 자체적으로 정리.)

## seen-topics
v1 없음. K-pop/드라마 섹션이 매주 같은 내용을 반복하면 그때 `kculture-seen.json` 도입 검토.
