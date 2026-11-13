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
// Only the categories below are supported; anything else (housing,
// marketplace, meeting, ...) is rejected -- see CLAUDE.md's "범용 정보성
// 질문에 자동으로 댓글을 다는 기능... 비자/법률/병원 등 민감 카테고리에는
// 절대 자동 댓글을 달지 않는다" caution. life/* (other than life/qna) was
// added 2026-11-02 (user request) but only as REACTOR_TARGETS (short
// reaction, no web_search fact grounding). life/qna is QNA_TARGETS --
// 2026-11-11 the "한국생활 QnA" sub-category itself moved from
// community/qna to life/qna (user request), carrying its QnA treatment
// with it.
//
// Usage:
//   node --env-file=.env.local bots/generate-answer.mjs \
//     --postId <uuid> --author r1 --category life --subCategory qna \
//     --title "질문 제목" --body "질문 본문" \
//     [--out bots/drafts/answer-1.json] [--dry-run]
//
// Required env: ANTHROPIC_API_KEY (add to .env.local)

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { genderToneNoteForAccount } from "./gender-tone.mjs";

const MODEL = "claude-opus-5-5";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REPLY_ACCOUNTS_PATH = fileURLToPath(new URL("./reply-accounts.json", import.meta.url));

const QNA_TARGETS = new Set(["life/qna", "university/qna"]);
const REACTOR_TARGETS = new Set([
  "news",
  "community/free",
  "community/travel",
  "community/dating",
  "university/general",
  // 2026-11-02 사용자 요청으로 life/* 추가 -- 가벼운 반응형 댓글만 허용, QnA(web_search로
  // 사실관계 확인 후 답변)는 아님. life/hospital처럼 민감한 서브카테고리도 포함되므로,
  // 실제 회원 글이 아니라 self-seed된 글에만 쓰는 운영 원칙(CLAUDE.md "국가별 커뮤니티
  // 봇" 섹션)을 반드시 지킬 것. life/qna는 예외 -- 2026-11-11 community/qna에서
  // 통째로 옮겨왔으므로 QNA_TARGETS 쪽에 있다 (위 참고).
  "life/marriage-childcare",
  "life/restaurant",
  "life/hospital",
  "life/mobile",
  "life/admin",
  "life/etc",
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
// 조사해 얻은 결과를 반영한, 국가별 말투 보정. 베트남/태국/라오스(태국 재사용)는
// 2026-10-30에 틱톡 댓글창을 직접 읽어서 확인했고(베트남은 페이스북도 함께 확인), 신뢰도
// 높음. 인도네시아/필리핀/미얀마/몽골/크메르 5개는 2026-11-13에 Claude Browser로 실제
// 틱톡(일부는 페이스북 시도) 댓글창을 직접 읽어 WebSearch 전용 조사보다 신뢰도를 끌어
// 올렸다 -- 다만 비자 초과체류·벌금·주소변경신고처럼 이 사이트가 실제로 다루는 민감한
// 화제의 실사례는 다섯 언어 모두 공통적으로 표본이 얕았으니(대부분 취업/급여/생활 얘기
// 위주였음), 그 주제 전용 표현은 여전히 미검증으로 남겨뒀다 -- 각 블록 안의 출처/확신도
// 메모를 보고, 더 깊이 조사할 기회가 있으면 교체할 것. (배경: 베트남 페르소나 답변이
// 실제 댓글창보다 훨씬 길고 "교과서적"이라는 피드백 -> TONE_RULE만으로는 부족해서
// 언어별 보정을 추가.) **이 조사 결과는 이 스크립트의 자동 생성뿐 아니라, Claude가
// 채팅에서 직접 번역해서 페르소나 글/댓글을 올릴 때도 반드시 참고해야 한다** -- 자동
// 생성 경로에만 연결해두고 수동 번역 경로에서 빠뜨렸다가 사용자에게 지적받은 전례가
// 있음(memory: gupgup-manual-translation-sns-check).
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

  id: `인도네시아어로 쓸 때 추가로 지킬 것 (2026-11-13 실제 틱톡 댓글창 직접 조사 결과 --
한국 이주노동자(TKI/PMI) 커뮤니티 영상 댓글 다수 확인, 신뢰도 중상. 페이스북은 로그인
장벽으로 확인 못함):
- 모음 생략형 줄임말을 자연스럽게 섞는다: yg(yang), bgt/bnget(banget, "완전/진짜"),
  tp/tpi(tapi), ga/gak/ngga/gk(tidak), udh/ud(sudah), pngen(pengen), tkut(takut),
  tmn(teman), tmpat(tempat), dgn(dengan), mslh(masalah), hdup(hidup), emg(emang).
  "2"를 반복 표시로 쓴다: rata2(그럭저럭/평균적으로), kira2(대략).
- 돈 액수는 "jt"(juta, 백만)·"rb"(ribu, 천) 단위로 줄여 쓴다("2jt won", "30rb"). 원(won)과
  루피아를 헷갈리는 댓글이 실제로 흔해서, 통화 단위는 명확히 붙여 쓰는 게 자연스럽다.
- 호칭: 여성 크리에이터·상대에게 "kak/ka/kk", 남성 사이에는 "mas"/"bang", 여성에게는
  "mbak" -- 베트남어 chị/anh처럼 절대적 규칙은 아니고 경향성이다.
- 감정·과장 반응은 "wkwk"(웃음)보다 😭(우는 이모지)가 실제로는 더 흔하게 관찰됐다.
  🗿(모아이 석상)은 무심하게 "할 말 없음"을 비꼬는 반응으로 쓴다. 강조할 땐 모음을 늘려
  쓴다(jugaaa, kaaa).
- 이번 조사는 자바 사투리(ora, dewe, kiro2 등)가 섞인 영상 위주였다 -- 자바 사투리 자체를
  표준 인도네시아어 기본값으로 쓰지 않는다, 지역색일 뿐이다.`,

  ph: `필리핀어(타갈로그/Taglish)로 쓸 때 추가로 지킬 것 (2026-11-13 실제 틱톡 댓글창 직접
조사 결과 -- OFW/EPS코리아 커뮤니티 영상 댓글 다수 확인, 신뢰도 중상. 페이스북은 로그인
장벽으로 확인 못함):
- Taglish(타갈로그+영어 혼용)가 기본이고, "po/opo"(존대 어미), "ba"(의문 조사, "poba"로도
  붙여 씀)는 모르는 사람에게도 자연스럽게 흔히 쓴다.
- 문자 메시지식 줄임말이 흔하다: lng(lang), nmn(naman), d(hindi/di), k(ka), s(sa),
  kme(kami), ksma(kasama), pgod(pagod), trabho(trabaho), nyo(ninyo), sya/nya(siya/niya),
  gano'n(ganoon).
- 돈은 "80k", "100k"처럼 줄여 쓴다(완전히 풀어 쓰지 않는다). 급여 자랑 게시물에
  "paldo"/"naol ~ paldo" 같은 밈성 표현이 종종 보이지만 정확한 뜻이 검증되지 않았으니
  쓰지 않는다.
- 웃음은 "lol"이 아니라 대문자 "HAHAHA"(또는 소문자 hahaha)가 훨씬 자연스럽다.
- 상황에 맞을 때만: "sana all"(부럽다), "charot"(농담이었다는 걸 밝히는 말), "grabe"(좋을
  때도 나쁠 때도 쓰는 "헐/대박"급 감탄사, 유행어라기보다 일상어). "lodi"/"petmalu"/
  "werpa"는 2017년 전후 유행어라 요즘엔 옛날 말투로 들릴 수 있다.
- 호칭: "bro"/"brod"/"boss"/"sir"/"kuya"가 남성 쪽에는 직접 확인됐지만, 여성 전용
  호칭·자기 지칭("ate" 등)은 이번 조사에서 표본이 적어 확신도가 낮다 -- 여성 페르소나는
  신중하게 쓸 것.
- 비자 초과체류·주소신고 관련 실제 댓글은 이번 조사에서 거의 못 찾았다(대부분 EPS
  지원·급여 얘기였음) -- 그런 주제 전용 표현은 아직 검증 안 됨.`,

  mm: `미얀마어로 쓸 때 참고 (2026-11-13 실제 틱톡 댓글창 직접 조사 결과, 신뢰도 중 --
비자/취업 관련 영상 다수 확인. 페이스북은 로그인 장벽으로 확인 못함. 여전히 검증 안 된
유행어는 지어내지 않는다):
- 문장 끝에 성별 무관하게 거의 보편적으로 붙는 완화 어미 "နော်"(~이지?/~해줘 느낌)를
  자주 쓴다.
- 호칭: 낯선 연상이 연하 남성에게 쓰는 다정한 "ညီလေးရေ"(남동생아), "မောင်လေး", 또래
  사이의 무뚝뚝한 "ကွာ/ကွ"(야/자식아), 여성에게 "ညီမရေ".
- 영어·한국 비자 용어를 번역 없이 그대로 섞어 쓰는 경향이 강하다: "form တင်ရသေးလား",
  "part-time job", visa 코드(E-9/E-7/F-3/D2/D4/G1)를 그대로 쓰고, 농담할 때 "bro"도
  그대로 차용한다.
- 웃음·반응은 단어가 아니라 이모지를 두세 번 겹쳐 쓰는 게 기본이다(😂😂, 🤣🤣, 😁😁) --
  태국어 "555"나 한국어 "ㅋㅋ"에 대응하는 미얀마어 전용 웃음 표기는 확인되지 않았다.
- 금액은 줄임 표기 없이 미얀마 숫자로 그대로 풀어 쓴다(예: ၁၀,၇၀၀). "သိန်း"(짯 10만
  단위)는 짯화 비교에만 쓰이고 원화 전용 줄임말은 아니다 -- 원화에 별도 축약 표기를
  지어내지 않는다.`,

  mn: `몽골어로 쓸 때 참고 (2026-11-13 실제 틱톡 댓글창 직접 조사로 보강, 신뢰도 중 --
페이스북은 로그인 장벽으로 이번에도 확인 못함. 비자 집행·벌금 관련 실제 댓글은 거의 못
찾아 그 주제 전용 표현은 여전히 미검증):
- 로마자(라틴 문자) 표기를 키릴 문자보다 선호하는 젊은 층 습관은 변함없이 확인된다.
- 줄임말: bna/bln/bgn(байна), gsn/gj(гэсэн/гэж), shd, "ymuu"(юмуу, "~려나?"),
  "yg"(яг, "바로 그"), "gdgn"(гэдэг нь), "oochirluul-"(зуучлуулах, 브로커·알선업체를
  통해 취업하다 -- 구직 얘기에 자주 나옴).
- 웃음은 "hha". 질문 조사 "be/vэ"(бэ/вэ)를 문장 끝에 붙인다.
- 돈은 줄임 단위 없이 "15,000,000вон"처럼 콤마로, 또는 "21.000won"처럼 마침표로 전액을
  그대로 쓴다 -- "k"식 축약은 확인되지 않았으니 지어내지 않는다.
- 반응 이모지로 🥀(시든 장미)를 "답이 없다/씁쓸하다"는 뜻으로 비꼬듯 쓰는 경우가 있다.
- 감탄사 "Гоё"(goy, "멋지다/좋다")는 기존처럼 자연스러운 맥락에서 써도 된다.`,

  // 라오스는 2026-10-31부터 라오어 대신 태국어로 쓴다(generate-question.mjs의
  // LANGUAGE_BY_COUNTRY.la 참고) -- 질문이 이미 태국어로 올라오니 "질문 언어 그대로
  // 답한다" 규칙에 따라 답변도 태국어가 되므로, 태국 노트를 그대로 재사용한다.
  la: `태국어로 쓸 때 추가로 지킬 것 (실제 태국 틱톡 댓글창 관찰 결과):
- 웃음은 "ㅋㅋㅋ"가 아니라 "555" 또는 "55555"로 쓴다 -- 태국어 숫자 5(ห้า)의 발음이
  "하"와 비슷해서 생긴 관습. 가벼운 웃음·재밌다는 반응에 자연스럽게 섞는다.
- 존댓말 어미를 줄여 쓰는 습관이 흔하다: ครับ(남성 존댓말 어미)→คับ, ค่ะ(여성 존댓말
  어미)→ค, ไหม(의문 어미)→ไม/มั้ย. 반말 페르소나보다는 존댓말 쓰는 페르소나에 어울린다.
- 실제 댓글은 "สวย"(예쁘다), "น่ารัก"(귀엽다)처럼 한두 단어짜리 짧은 감탄·칭찬이
  압도적으로 많고, 텍스트 없이 스티커·이모지만 다는 경우도 흔하다. 긴 설명형 반응은
  거의 없다 -- 위 TONE_RULE의 "1~2문장"조차 길 수 있다는 걸 기억한다.
- 지역 사투리(특히 이싼 방언)가 섞인 댓글도 실제로는 흔하지만, 봇은 표준 태국어로 쓰고
  사투리를 억지로 흉내 내지 않는다.`,

  kh: `크메르어(캄보디아)로 쓸 때 참고 (2026-11-13 실제 틱톡 댓글창 직접 조사로 보강,
신뢰도 중 -- 페이스북은 이번에도 로그인 장벽으로 확인 못함(캄보디아는 페이스북이
주력 플랫폼이라는 점은 여전히 미확인 상태). 벌금·주소변경신고 관련 실제 댓글은 거의
못 찾아 그 주제 전용 표현은 여전히 미검증):
- 돈은 달러 표기가 흔하다: 숫자 뒤에 "$"를 띄어쓰기 없이 바로 붙인다(예: "212$"). 리엘은
  "លាន"(백만)·"មុឺន"(만) 단위로 줄여 쓰는데, 댓글에서도 원/리엘/달러 환산을 헷갈려하는
  반응이 흔히 보인다 -- 봇도 억지로 정확한 환산을 하려 하지 않는다.
- 질문 꼬리표 "ម៉ាន/ម៉ាន់"(=ប៉ុន្មាន, 얼마)는 "...ដែរបង?"처럼 한 단어로 붙여 쓰는 게 흔하고,
  구직·취업 관련 글에서는 호칭이 ចែ보다 "បង"(형/언니뻘, 성별 무관하게 더 자주 씀)이
  우세하다.
- "ហា"를 문장 앞에 독립적으로 붙여 "허/헐"같은 웃음·황당함 반응으로 쓴다. 🙏(합장
  이모지)를 2~5번 반복해서 비자·축원 같은 진지하고 공손한 내용에 다는 경우가 많다 --
  평소 캐주얼한 대화의 🥰🥺 이모지와는 결이 다른 반응이다.
- 가벼운 오타도 장르적 특징이다(ក៏→ក៌, ច្រើន→ច្រេីន 등) -- 너무 깔끔한 철자가 오히려
  부자연스럽다.`,
};

// 국가 코드(country)만으로 COUNTRY_TONE_NOTES를 바로 조회 -- reply-accounts.json 계정이
// 없는 다른 스크립트(예: generate-question.mjs)에서도 같은 SNS 조사 결과를 재사용할 수
// 있게 분리해둔다.
export function countryToneNoteForCountry(country) {
  return country ? (COUNTRY_TONE_NOTES[country] ?? "") : "";
}

// 언어별 공통 톤(COUNTRY_TONE_NOTES) 뒤에, 계정 아바타로 판단한 성별 말투(gender-tone.mjs)를
// 덧붙인다 -- CLAUDE.md "페르소나 말투 가이드 — 언어별 남/여" 참고.
export function countryToneNote(authorKey) {
  const account = loadReplyAccount(authorKey);
  const base = countryToneNoteForCountry(account?.country);
  const gender = genderToneNoteForAccount(account);
  return [base, gender].filter(Boolean).join("\n");
}

const TONE_RULE = `실제 인터넷 댓글창처럼 써라 -- 서로 얼굴 안 보고 쓰는 공간이라 다들 무례하고
단답식이다. 번호 매겨 항목을 나열하거나, 여러 사실을 친절하게 순서대로 설명하는
"교과서적인" 답변은 절대 쓰지 않는다. 핵심 하나만 툭 던지고 끝낸다. (단, 위
페르소나가 원래 다정하거나 친절한 성격으로 적혀 있으면 그 톤은 그대로 유지한다 --
이 규칙은 그 페르소나에는 적용되지 않는다.)
실제 인터넷 댓글은 매우 짧다 -- 길어야 짧은 문장 2개, 보통은 1문장(심지어 한 단어짜리
감탄사)으로 끝난다. 페르소나의 취미·특징(비유, 드립 등)을 억지로 끼워 넣어서 문장을
늘리지 않는다 -- 그 페르소나다운 말투나 단어 선택은 살리되, 상황에 안 맞는 비유를
만들어 붙이거나 부연 설명을 추가하지 않는다. 쓸 말이 짧으면 짧게 끝낸다.`;

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
3. 짧은 문장 최대 2개 -- 그보다 길어지면 안 된다. 1문장으로 끝나는 쪽을 기본으로 한다.
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
      'usage: node --env-file=.env.local bots/generate-answer.mjs --postId <uuid> --author <accounts.json/reply-accounts.json key> --category <news|community|life|university> [--subCategory <free|travel|dating|marriage-childcare|restaurant|hospital|mobile|admin|etc|qna|general>] --title "<...>" --body "<...>" [--out <path>] [--dry-run]',
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
