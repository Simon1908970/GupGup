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

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const explicitNext = searchParams.get("next");

  let next = explicitNext ?? "/onboarding";

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

  if (!explicitNext && userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    next = profile ? "/" : "/onboarding";
  }

  return NextResponse.redirect(`${origin}${next}`);
}
