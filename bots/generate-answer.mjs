// Generates one "answer comment" draft responding to an existing post --
// either the QnA "경험자 선배" persona (한국생활 QnA / 대학 QnA) or a casual
// "반응형" reaction persona (뉴스 / 자유게시판 / 여행맛집 / 연애 정보 / 한국대학),
// chosen by category/subCategory. See CLAUDE.md's "국가별 커뮤니티 봇" section.
//
// For a QnA answer, the --author's entry in reply-accounts.json supplies a
// distinct tone/personality (r1..r5 each have their own "persona" line) so
// five self-seeded threads don't all sound like the same AI voice. All five
// still share the same base rule: answer in whatever language the question
// was written in, never a fixed language.
//
// QnA answers also get Anthropic's web_search tool (see
// https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool)
// so cost/fee/procedure claims are grounded in an actual search instead of
// guessed -- a draft generated before this had a wrong 외국인등록증 재발급
// fee (3만원 vs the real ~35,000원) because nothing forced a lookup. Search
// results aren't published as part of the comment body; they're only logged
// to the console so a human can spot-check the sources before approving.
//
// Like generate-question.mjs, this only PRODUCES a draft -- it never reads
// the board or publishes. You give it the target post's title/body yourself
// (copy it from the site, or from a generate-question.mjs draft for a
// self-seeded Q&A), review the printed answer, then run
// bots/publish-comment.mjs on the --out file (its shape -- {postId, author,
// body} -- is already what that script expects).
//
// Only the categories below are supported; anything else (housing, life/*,
// marketplace, meeting, ...) is rejected -- see CLAUDE.md's "범용 정보성
// 질문에 자동으로 댓글을 다는 기능... 비자/법률/병원 등 민감 카테고리에는
// 절대 자동 댓글을 달지 않는다" caution.
//
// Usage:
//   node --env-file=.env.local bots/generate-answer.mjs \
//     --postId <uuid> --author r1 --category community --subCategory qna \
//     --title "질문 제목" --body "질문 본문" \
//     [--out bots/drafts/answer-1.json] [--dry-run]
//
// Required env: ANTHROPIC_API_KEY (add to .env.local)

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const MODEL = "claude-opus-5-5";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REPLY_ACCOUNTS_PATH = fileURLToPath(new URL("./reply-accounts.json", import.meta.url));

const QNA_TARGETS = new Set(["community/qna", "university/qna"]);
const REACTOR_TARGETS = new Set([
  "news",
  "community/free",
  "community/travel",
  "community/dating",
  "university/general",
]);
const ALLOWED_TARGETS = new Set([...QNA_TARGETS, ...REACTOR_TARGETS]);

function targetKey(category, subCategory) {
  return subCategory ? `${category}/${subCategory}` : category;
}

export function isAllowedTarget(category, subCategory) {
  return ALLOWED_TARGETS.has(targetKey(category, subCategory));
}

export function isQnaTarget(category, subCategory) {
  return QNA_TARGETS.has(targetKey(category, subCategory));
}

const DEFAULT_QNA_PERSONA = "너의 말투/성격: 담백하고 직설적인 보통의 선배.";

function loadReplyAccount(authorKey) {
  try {
    const accounts = JSON.parse(readFileSync(REPLY_ACCOUNTS_PATH, "utf8"));
    return accounts[authorKey] ?? null;
  } catch {
    return null;
  }
}

export function loadReplyPersona(authorKey) {
  return loadReplyAccount(authorKey)?.persona ?? null;
}

// 실제 틱톡(한국 생활/유학 관련 영상)과 페이스북(그룹 게시물·릴스)의 댓글·질문·답글을
// 2026-10-30에 조사해 얻은 결과를 반영한, 국가별 말투 보정. 베트남/태국은 틱톡 댓글창을
// 직접 읽어서 확인했고(베트남은 페이스북도 함께 확인), 나머지 6개는 WebSearch 기반
// 조사라 확신도가 낮아 보수적으로 적었다 -- 각 블록 안의 출처/확신도 메모를 보고, 더
// 깊이 조사할 기회가 있으면 교체할 것. (배경: 베트남 페르소나 답변이 실제 댓글창보다
// 훨씬 길고 "교과서적"이라는 피드백 -> TONE_RULE만으로는 부족해서 언어별 보정을 추가.)
const COUNTRY_TONE_NOTES = {
  vn: `베트남어로 쓸 때 추가로 지킬 것 (실제 베트남 틱톡·페이스북 댓글창 관찰 결과):
- 길이: 실제 댓글은 완전한 문장이 아닌 경우가 더 많다. 3~10단어짜리 토막 하나로
  끝내는 게 기본값이다. 안부 인사나 맺음말 없이 핵심만 던지고 끝낸다. 위 TONE_RULE의
  "1~2문장" 조차 길 수 있다는 걸 기억한다.
- 구어체 줄임 철자를 문맥에 맞게 한두 개만 자연스럽게 섞는다(전부 다 쓰면 오히려
  부자연스럽다): không→k/ko, vậy→z, rồi→r, được→dc, gì→j, mình→mik, quá→qá,
  bạn→b, anh→a, chị→c, em→e.
- 문장 끝의 "ạ"/시작의 "dạ"(존대 어투)는 반말 페르소나에는 넣지 않는다 -- 다정하거나
  손님 응대형 페르소나만 자연스러운 선에서 섞어도 된다. 페이스북 그룹의 서비스성 댓글은
  틱톡보다 "ạ/dạ" 존대가 훨씬 잦다는 점도 참고.
- 요즘 유행어는 상황에 자연스럽게 맞을 때만 쓴다(억지로 끼워 넣지 않는다): "gét gô"
  (가보자/해보자는 추임새), "phông bạt"(허세 부리다/있어 보이게 꾸미다), "flex"(자랑하다),
  "gato"(배 아파하다·질투), "u là trời"/"ủa"(놀람, "어 이게 뭐야"), "mãi keo"(인정한다는
  감탄), "cợt nhả"(장난스럽게 가볍게 받아치는 태도).
- 질문에 대한 반응이 긍정/부정 한마디나 되묻는 말 한 줄로 끝나는 경우가 흔하다.
  정보를 여러 개 풀어서 설명하는 대신, 가장 궁금해할 한 조각만 짧게 던진다.`,

  th: `태국어로 쓸 때 추가로 지킬 것 (실제 태국 틱톡 댓글창 관찰 결과):
- 웃음은 "ㅋㅋㅋ"가 아니라 "555" 또는 "55555"로 쓴다 -- 태국어 숫자 5(ห้า)의 발음이
  "하"와 비슷해서 생긴 관습. 가벼운 웃음·재밌다는 반응에 자연스럽게 섞는다.
- 존댓말 어미를 줄여 쓰는 습관이 흔하다: ครับ(남성 존댓말 어미)→คับ, ค่ะ(여성 존댓말
  어미)→ค, ไหม(의문 어미)→ไม/มั้ย. 반말 페르소나보다는 존댓말 쓰는 페르소나에 어울린다.
- 실제 댓글은 "สวย"(예쁘다), "น่ารัก"(귀엽다)처럼 한두 단어짜리 짧은 감탄·칭찬이
  압도적으로 많고, 텍스트 없이 스티커·이모지만 다는 경우도 흔하다. 긴 설명형 반응은
  거의 없다 -- 위 TONE_RULE의 "1~2문장"조차 길 수 있다는 걸 기억한다.
- 지역 사투리(특히 이싼 방언)가 섞인 댓글도 실제로는 흔하지만, 봇은 표준 태국어로 쓰고
  사투리를 억지로 흉내 내지 않는다.`,

  id: `인도네시아어로 쓸 때 추가로 지킬 것 (2026-10-30 웹 조사 결과 -- 실제 댓글 직접
관찰은 아직 없어 베트남/태국 노트보다 보수적으로 다룰 것):
- 채팅 줄임말을 자연스러운 선에서 섞는다: gak papa→gpp("괜찮아"), banget→bgt("완전/
  진짜"), by the way→btw, get well soon→GWS("빨리 낫길").
- 상황에 자연스럽게 맞을 때만: "skiber"(귀찮아서 하기 싫다), "TBL"(완전 무섭다/쫄았다),
  "anak skena"(인디 음악·비주류 모임 다니는 애들을 가리키는 말). 뜻이 불분명하거나
  출처가 엇갈리는 2026년 밈 유래 표현("six seven", "clock it", "aura farming" 등)은
  쓰지 않는다.`,

  ph: `필리핀어(타갈로그/Taglish)로 쓸 때 추가로 지킬 것 (2026-10-30 웹 조사 결과 --
실제 댓글 직접 관찰은 아직 없어 베트남/태국 노트보다 보수적으로 다룰 것):
- 타갈로그와 영어를 자연스럽게 섞어 쓰는 "Taglish"가 기본이다 -- 한 문장 안에서 영어
  단어와 타갈로그 단어가 섞여도 어색하지 않다.
- 웃음은 "lol" 대신 대문자로 "HAHAHA"라고 쓰는 쪽이 더 자연스럽다.
- 상황에 맞을 때만: "charot"(농담이었다는 걸 밝히며 문장 끝에 붙임), "grabe"(좋을
  때도 나쁠 때도 쓰는 강한 감탄사, "헐/대박"에 가까움), "sana all"(부럽다/나도
  그랬으면), "slr"(sorry, late reply). "lodi"/"petmalu"/"werpa"는 여전히 쓰이지만
  2017년 전후 유행어라 요즘 10대에겐 살짝 옛날 말투로 들릴 수 있어, 다정한 페르소나가
  가볍게 격려할 때 정도로만 쓴다.`,

  mm: `미얀마어로 쓸 때 참고 (신뢰할 만한 자료가 거의 없어 보수적으로 적용 -- 없는
유행어를 지어내 쓰지 않는다): 기본은 TONE_RULE 그대로, 여러 사실을 나열하는 교과서적
답변 대신 1~2문장으로 핵심만 짧게 던진다. 확인된 구어체 표현 중 자연스러운 맥락에서만
드물게 쓸 수 있는 것: "ပေါက်သွားတယ်"(화제가 되다/입소문나다), "ဂျင်းမိတယ်"(속아
넘어가다/손해 봤다). 이 두 표현 외에 검증 안 된 은어는 쓰지 않는다.`,

  mn: `몽골어로 쓸 때 참고 (신뢰할 만한 최신 은어 자료를 찾지 못해 보수적으로 적용 --
없는 유행어를 지어내 쓰지 않는다): 기본은 TONE_RULE 그대로, 번호 매겨 설명하는
교과서적 답변 대신 1~2문장으로 핵심만 짧게 던진다. 널리 쓰이는 구어체 감탄사
"Гоё"(goy, "멋지다/좋다")는 자연스러운 맥락에서 써도 되지만, 그 밖의 구체적
신조어·줄임말은 검증되지 않았으니 넣지 않는다.`,

  la: `라오스어로 쓸 때 참고 (신뢰할 만한 라오스어 자체 유행어 자료를 찾지 못해 특정
단어를 지어내 넣지 않는다): 길이는 TONE_RULE 기본대로 짧고 완결되지 않은 문장을
기본으로 하되, 베트남어처럼 구체적인 줄임 철자 목록은 아직 검증되지 않았다. 라오스
젊은 층이 학교·TV를 통해 태국어에 많이 노출된다는 보고가 있어 태국어 영향을 받은
캐주얼한 어감 정도는 무리가 아니지만, 실제 태국어 단어를 그대로 섞어 쓰지는 않는다.
추가 조사가 필요한 상태임을 기억할 것.`,

  kh: `크메르어(캄보디아)로 쓸 때 참고 (신뢰할 만한 캄보디아 자체 유행어 자료를 찾지
못해 특정 단어를 지어내 넣지 않는다): 캄보디아는 페이스북이 압도적 주력 플랫폼이고
틱톡은 도시 청년층 위주라서, 베트남 틱톡 조사에서 나온 "짧고 teencode가 강한" 톤보다는
이 프로젝트의 베트남 페이스북 조사에서 관찰된 "그룹·서비스성 댓글은 더 공손하고
차분하다"는 쪽에 더 가까울 가능성이 높다. 줄임 철자·최신 은어는 검증된 자료가 없어
비워두고, 길이만 실제 SNS 댓글 평균에 맞춰 짧게 유지한다. 추가 조사가 필요한 상태임을
기억할 것.`,
};

function countryToneNote(authorKey) {
  const country = loadReplyAccount(authorKey)?.country;
  return country ? (COUNTRY_TONE_NOTES[country] ?? "") : "";
}

const TONE_RULE = `실제 인터넷 댓글창처럼 써라 -- 서로 얼굴 안 보고 쓰는 공간이라 다들 무례하고
단답식이다. 번호 매겨 항목을 나열하거나, 여러 사실을 친절하게 순서대로 설명하는
"교과서적인" 답변은 절대 쓰지 않는다. 핵심 하나만 툭 던지고 끝낸다. (단, 위
페르소나가 원래 다정하거나 친절한 성격으로 적혀 있으면 그 톤은 그대로 유지한다 --
이 규칙은 그 페르소나에는 적용되지 않는다.)`;

function buildQnaSystemPrompt(author) {
  const persona = loadReplyPersona(author) ?? DEFAULT_QNA_PERSONA;
  const toneNote = countryToneNote(author);
  return `너는 한국에 거주하는 이주민 커뮤니티의 경험 많은 선배야. 아래 후배의 질문에
답글을 하나 작성해.

${persona}

1. 질문에 쓰인 언어를 그대로 파악해서, 반드시 그 언어로만 답변을 작성한다. 검색은
   한국어로 해도 되지만(공식 정보가 대부분 한국어라서), 최종 답변은 검색 결과를
   질문과 같은 언어로 옮겨서 쓴다.
2. "도움이 되셨으면 좋겠습니다" 같은 AI스러운 인사나 뻔한 위로 없이 쓴다. ${TONE_RULE}${toneNote ? `\n${toneNote}` : ""}
3. 수수료/기간/절차처럼 바뀔 수 있는 구체적인 사실은 기억에 의존해 추측하지 말고
   web_search로 하이코리아·출입국·외국인청·법무부 등 공식/신뢰도 높은 출처를 먼저
   찾아보고, 그 결과에 맞춰 답변한다. 검색해도 확실하지 않으면 지어내지 말고
   정확한 기관에 확인해보라고 솔직하게 안내한다. 단, 찾은 사실은 위 1번 톤 그대로
   짧게 녹여서 말하고, 여러 사실을 줄줄이 나열하지 않는다 -- 질문자가 가장 궁금해할
   핵심 한두 개만 골라 말한다.
4. <cite> 같은 인용 태그, 각주 번호, 출처 표시를 본문에 절대 넣지 않는다 -- 검색으로
   확인한 내용도 그냥 자연스러운 문장으로 녹여서 쓴다. 출처는 커뮤니티 댓글에
   안 어울린다.
5. 1~3문장, 커뮤니티 댓글 분량을 넘지 않는다. 다정한 페르소나가 아니라면 2문장을
   넘기지 않는 쪽을 기본으로 한다.
6. 검색을 했든 안 했든, 마지막 출력은 반드시 아래 JSON 객체 하나만 -- 다른 설명,
   마크다운, 코드블록 없이:
{"body": "<답변 본문>"}`;
}

export function buildReactorSystemPrompt(author) {
  const persona = loadReplyPersona(author);
  const personaBlock = persona ? `\n${persona}\n` : "";
  const toneNote = countryToneNote(author);
  return `너는 이 커뮤니티의 평범한 유저야. 아래 올라온 글에 짧은 반응 댓글을 하나 남겨.
${personaBlock}
1. 글에 쓰인 언어를 그대로 파악해서, 반드시 그 언어로만 댓글을 작성한다.
2. ${TONE_RULE}${toneNote ? `\n${toneNote}` : ""}
3. 1~2문장을 넘지 않는다.
4. 출력은 반드시 아래 JSON 객체 하나만 -- 다른 설명, 마크다운, 코드블록 없이:
{"body": "<댓글 본문>"}`;
}

export function buildSystemPrompt(category, subCategory, author) {
  return isQnaTarget(category, subCategory)
    ? buildQnaSystemPrompt(author)
    : buildReactorSystemPrompt(author);
}

export function parseArgs(argv) {
  const rest = argv.slice(2);
  const get = (flag) => {
    const i = rest.indexOf(flag);
    return i === -1 ? undefined : rest[i + 1];
  };
  return {
    postId: get("--postId"),
    author: get("--author"),
    category: get("--category"),
    subCategory: get("--subCategory"),
    title: get("--title"),
    body: get("--body"),
    out: get("--out"),
    dryRun: rest.includes("--dry-run"),
  };
}

export function validateArgs(a) {
  if (!a.postId || !UUID_RE.test(a.postId)) return "invalid/missing: --postId";
  if (!a.author || !a.author.trim()) return "missing: --author";
  if (!a.category || !isAllowedTarget(a.category, a.subCategory)) {
    return "invalid/unsupported: --category/--subCategory";
  }
  if (!a.title || !a.title.trim()) return "missing: --title";
  if (!a.body || !a.body.trim()) return "missing: --body";
  return null;
}

function extractSources(content) {
  const sources = [];
  for (const block of content ?? []) {
    if (block.type !== "web_search_tool_result" || !Array.isArray(block.content)) continue;
    for (const result of block.content) {
      if (result.type === "web_search_result") {
        sources.push({ url: result.url, title: result.title });
      }
    }
  }
  return sources;
}

export function parseModelResponse(data) {
  if (data.stop_reason === "refusal") {
    throw new Error(`model refused: ${data.stop_details?.category ?? "unknown"}`);
  }
  if (data.stop_reason === "max_tokens") {
    throw new Error("response truncated at max_tokens");
  }
  // With web_search enabled, Claude may emit an earlier "I'll search for..."
  // text block before the tool call -- the final JSON answer is always the
  // LAST text block, after any search result blocks.
  const textBlocks = (data.content ?? []).filter((b) => b.type === "text");
  const textBlock = textBlocks[textBlocks.length - 1];
  if (!textBlock) throw new Error("no text block in response");

  const jsonText = textBlock.text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(`model did not return valid JSON: ${textBlock.text}`);
  }
  if (typeof parsed.body !== "string") {
    throw new Error(`missing body in model output: ${jsonText}`);
  }
  return { body: parsed.body.trim(), sources: extractSources(data.content) };
}

export async function generateAnswer(
  { category, subCategory, author, title, body },
  apiKey,
  fetchImpl = fetch,
) {
  const isQna = isQnaTarget(category, subCategory);
  const res = await fetchImpl(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "server-side-fallback-2026-07-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: isQna ? 2048 : 400,
      output_config: { effort: "low" },
      fallbacks: "default",
      system: buildSystemPrompt(category, subCategory, author),
      messages: [{ role: "user", content: `제목: ${title}\n본문: ${body}` }],
      ...(isQna ? { tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }] } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }

  return parseModelResponse(await res.json());
}

async function main() {
  const args = parseArgs(process.argv);
  const reason = validateArgs(args);
  if (reason) {
    console.error(
      'usage: node --env-file=.env.local bots/generate-answer.mjs --postId <uuid> --author <accounts.json/reply-accounts.json key> --category <news|community|university> [--subCategory <free|travel|dating|qna|general>] --title "<...>" --body "<...>" [--out <path>] [--dry-run]',
    );
    console.error(reason);
    process.exit(1);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("missing env: ANTHROPIC_API_KEY");
    process.exit(1);
  }

  if (args.dryRun) {
    console.log(
      JSON.stringify(
        { system: buildSystemPrompt(args.category, args.subCategory, args.author), title: args.title },
        null,
        2,
      ),
    );
    return;
  }

  const { body, sources } = await generateAnswer(args, apiKey);

  const draft = { postId: args.postId, author: args.author, body };
  console.log(JSON.stringify(draft, null, 2));
  if (sources?.length) {
    console.error("검색 출처 (발행되는 본문엔 포함 안 됨, 사실관계 확인용):");
    for (const s of sources) console.error(`  - ${s.title}: ${s.url}`);
  }

  if (args.out) {
    writeFileSync(args.out, JSON.stringify(draft, null, 2));
    console.error(`written to ${args.out} -- review it, then run bots/publish-comment.mjs on it`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
