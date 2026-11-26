import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const EMAIL_OTP_TYPES: EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

function isEmailOtpType(v: string | null): v is EmailOtpType {
  return v !== null && (EMAIL_OTP_TYPES as string[]).includes(v);
}

// Behind a reverse proxy (e.g. Hostinger), request.url carries the internal
// address the Node server listens on (http://0.0.0.0:3000), not the public
// domain. Rebuild the public origin from the forwarded headers instead.
function publicOrigin(request: Request, fallback: string): string {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host");
  if (!host || host.startsWith("0.0.0.0") || host.startsWith("127.0.0.1")) {
    return fallback;
  }
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = forwardedProto || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function GET(request: Request) {
  const { searchParams, origin: requestOrigin } = new URL(request.url);
  const origin = publicOrigin(request, requestOrigin);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const explicitNext = searchParams.get("next");

  // Only allow same-site relative paths (blocks "//evil.com" style redirects).
  const safeNext =
    explicitNext && explicitNext.startsWith("/") && !explicitNext.startsWith("//")
      ? explicitNext
      : null;
  let next = safeNext ?? "/onboarding";

  const supabase = await createClient();
  let userId: string | null = null;

  if (tokenHash && isEmailOtpType(type)) {
    // Email links (confirm signup, password recovery, magic link, email change).
    // verifyOtp needs no PKCE code verifier, so the link works even when it is
    // opened in a different browser or device than the one that started signup.
    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) userId = data.user?.id ?? null;
  } else if (code) {
    // OAuth (Google / Facebook) and any PKCE flow that still sends ?code=.
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) userId = data.user?.id ?? null;
  }

  if (!safeNext && userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    next = profile ? "/" : "/onboarding";
  }

  return NextResponse.redirect(`${origin}${next}`);
}
