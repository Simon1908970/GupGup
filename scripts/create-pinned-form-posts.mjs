// "내 월급" / "내 생활비" 고정 글 2개를 한국생활(life) 게시판에 한 번만
// 만드는 운영자용 1회성 스크립트. bots/publish-post.mjs, news-digest/
// publish-news.mjs와 같은 패턴 -- 서비스 롤 키로 직접 posts에 insert한다.
// 일반 회원 글쓰기 화면을 거치지 않는다 (고정 폼 글은 매번 새로 쓰는 게
// 아니라 딱 2개만 있으면 되므로).
//
// 이미 만들어진 뒤 다시 실행하면 중복으로 또 생기므로, 실행 전에
// `--dry-run`으로 한 번 확인하고, 이미 있는지는 사이트에서 직접 확인할 것
// (멱등성 체크를 걸지 않음 -- 운영자가 손으로 한 번만 돌리는 스크립트).
//
// Usage:
//   node --env-file=.env.local scripts/create-pinned-form-posts.mjs [--dry-run]

import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const POSTS = [
  {
    pinned_form_type: "salary",
    title: "💰 내 월급",
    body: "업종·지역별 실제 월급을 익명으로 공유하는 글입니다. 아래 양식을 채워서 제출하면 댓글로 카드가 올라갑니다.",
  },
  {
    pinned_form_type: "living_cost",
    title: "🧾 내 생활비",
    body: "지역별 실제 생활비를 익명으로 공유하는 글입니다. 아래 양식을 채워서 제출하면 댓글로 카드가 올라갑니다.",
  },
];

export function buildInsertPayload(post, authorId) {
  return {
    category: "life",
    sub_category: null,
    country: "etc",
    author_id: authorId,
    title: post.title,
    body: post.body,
    points_awarded: 0,
    is_notice: true,
    pinned_form_type: post.pinned_form_type,
    // 회원(로그인)만 볼 수 있게 -- 2026-11-09 사용자 요청. 비로그인 방문자는
    // 목록에도 안 뜨고 상세로 직접 들어가도 못 본다(0029 RLS).
    members_only: true,
  };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const authorId = process.env.NEWS_AUTHOR_ID;
  if (!authorId) {
    console.error("missing env: NEWS_AUTHOR_ID (운영 admin의 profiles.id)");
    process.exit(1);
  }

  const payloads = POSTS.map((p) => buildInsertPayload(p, authorId));

  if (dryRun) {
    console.log(JSON.stringify(payloads, null, 2));
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  for (const payload of payloads) {
    const { data, error } = await supabase.from("posts").insert(payload).select("id").single();
    if (error) {
      console.error(`insert failed (${payload.pinned_form_type}): ${error.message}`);
      process.exit(1);
    }
    console.log(JSON.stringify({ id: data.id, url: `/board/life/${data.id}`, type: payload.pinned_form_type }));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
