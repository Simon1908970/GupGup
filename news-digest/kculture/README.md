# K-컬처 & 라이프 주간 다이제스트

주 1회, 앱 취지(한국 거주 동남아·중앙아 외국인)에 맞는 문화·라이프 소식을 한 페이지로
정리한다. 기존 `news-digest/`(네이버 일일 요약)와 **별개** 파이프라인이다.

## 3개 섹션 (고정 순서)
1. K-pop 소식
2. K-drama 소식
3. 한국인과의 연애 후기

> 동남아 쇼츠 섹션은 v1 에서 제외했다. YouTube 키워드 검색(`ytsearch`)이 관련도순만
> 지원하고 최신순 정렬이 없어, 최근에 올라온 ≤60초 한국 Shorts 가 사실상 잡히지 않았다.
> (필요해지면 최근 6~12개월 창 + 노출 이력 제외 방식으로 되살릴 수 있음.)

## 실행 모델 (하이브리드)
- `news-digest/fetch-kculture.mjs` 가 Exa 웹검색 + RSS 를 모아
  `kculture/raw-kculture-<날짜>.json` 을 만든다. `.env.local` 불필요.
  `node news-digest/fetch-kculture.mjs`
- 사용자가 "K컬처 요약해줘" 류로 요청하면, 이 세션이 Reddit·TikTok 을 보태고 전체를
  `kculture/<날짜>.md` 로 요약한다.
- 생성물(`raw-kculture-*.json`, `<날짜>.md`)은 **로컬 전용 — git commit 안 함.**
- 수집 범위는 `kculture/sources.json` 에서 조절한다. `rss` 항목의 `freshnessDays`(기본 7)
  는 며칠치를 볼지, `limit` 은 피드당 최대 몇 건을 남길지(최신순으로 자름)를 정한다.
  한 피드(soompi)가 전체 결과를 독식하지 않도록 하는 장치다.

### 플래그
| 플래그 | 동작 |
|---|---|
| (없음) | 전체 수집 → `kculture/raw-kculture-<KST 날짜>.json` 기록 + 60일 지난 raw json 정리 |
| `--dry-run` | exa 1개 쿼리 · 전체 RSS 를 돌려 앞 5건을 출력. **파일을 쓰지 않음** |
| `--section=kpop\|kdrama\|dating` | 해당 섹션의 exa 쿼리만 실행 |
| `--section=exa` | exa 쿼리 전체만 실행 |
| `--section=rss` | RSS 만 실행 |

- `--section=…` 은 정의상 부분 실행이라 **canonical `raw-kculture-<날짜>.json` 을
  덮어쓰지 않는다** (수집 결과만 출력). 요약 세션이 append 한 Reddit·TikTok 항목은
  재생성이 불가능하므로 부분 실행 결과로 날려서는 안 된다. 디버깅·점검용 플래그다.
- 수집 결과가 0건이면 파일을 쓰지 않고 **exit 1**.
  기존 raw json 은 그대로 둔다. `run-fetch-kculture.ps1` 이 이 종료 코드를 로그에 남긴다.

## 요약 요청 시 절차 (Claude용)

1. 날짜 태그 = 실행일 KST `YYYY-MM-DD`.
   **원본 데이터 확보:** `kculture/raw-kculture-*.json` 을 훑어 **파일명 날짜가 가장 최신인
   것 하나**를 고른다. (파일명 날짜는 수집 시점이지 오늘이 아니다 — 스케줄러가 월요일에
   미리 받아둔 파일이 그대로 쓰인다.)
   - 그런 파일이 하나도 없거나, 가장 최신 파일의 날짜가 오늘(KST)보다 **7일 넘게** 오래됐으면
     먼저 `node news-digest/fetch-kculture.mjs` 를 실행해 새로 받는다.
   - 그 외에는 다시 받지 말고 **찾은 최신 파일**을 이후 절차(2~6번)의 입력으로 쓴다.
2. **Reddit (연애 후기):** `kculture/sources.json` 의 `reddit` 항목마다
   `opencli reddit search "<query>" -f yaml` (필요 시 서브레딧 지정). opencli 데몬
   다운 / `AUTH_REQUIRED` 면 `redditStatus = "미수집 (로그인/연결 실패)"` 로 기록하고 계속.
   히트 → `{ source: "reddit:<sub>", keyword: "dating", title, description(본문 발췌), link, date }`.
3. **TikTok (보조, best-effort):** `opencli tiktok search "<query>" -f yaml` — K-pop /
   K-drama / "dating in korea" 류. 실패하면 조용히 스킵.
   히트 → `{ source: "tiktok", keyword, title, description, link, views }`.
4. 2·3 결과를 **1번에서 고른 raw json 파일**에 같은 스키마로 append.
   (이 append 분은 재생성이 불가능하므로, 이후 `fetch-kculture.mjs` 를 다시 돌리지 않는다.)
5. **원문 읽기:** 후보 기사(틱톡 제외)마다 `curl.exe -s "https://r.jina.ai/<link>"` 로
   본문을 확보한 뒤 요약. 최대 약 15건.
   (PowerShell 에서 `curl` 은 `Invoke-WebRequest` 별칭이므로 반드시 `curl.exe` 로 호출.)
6. **`kculture/<날짜>.md` 작성** (`TEMPLATE.md` 형식):
   - 각 항목: `**<원어 제목>** (<한국어 번역>)` + 한국어 요약 1~2문장 + `원문: <link>`
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
