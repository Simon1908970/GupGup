"use client";

import { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

type DocLang = "ko" | "en";

const CONTACT_EMAIL = "gupguptalk@gmail.com";

// User data deletion instructions page.
// Required by Meta (Facebook Login) as the "Data Deletion Instructions URL".
export default function DataDeletionPage() {
  const { t } = useLanguage();
  const [lang, setLang] = useState<DocLang>("ko");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 text-sm leading-relaxed">
      <div className="mb-2 flex items-start justify-between gap-3">
        <h1 className="text-lg font-bold">
          {lang === "ko" ? "사용자 데이터 삭제 안내" : "User Data Deletion Instructions"}
        </h1>
        <LangToggle lang={lang} onChange={setLang} />
      </div>
      <p className="mb-6 rounded-md bg-[var(--color-border-gray-light)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
        {t("legal.translateNotice")}
      </p>

      {lang === "ko" ? <DeletionKo /> : <DeletionEn />}
    </div>
  );
}

function LangToggle({
  lang,
  onChange,
}: {
  lang: DocLang;
  onChange: (lang: DocLang) => void;
}) {
  return (
    <div className="flex shrink-0 overflow-hidden rounded-md border border-[var(--color-border-gray)] text-xs">
      <button
        type="button"
        onClick={() => onChange("ko")}
        aria-pressed={lang === "ko"}
        className={
          lang === "ko"
            ? "bg-[var(--color-brand-red)] px-3 py-1.5 text-white"
            : "bg-white px-3 py-1.5 text-[var(--color-text-muted)]"
        }
      >
        한국어
      </button>
      <button
        type="button"
        onClick={() => onChange("en")}
        aria-pressed={lang === "en"}
        className={
          lang === "en"
            ? "bg-[var(--color-brand-red)] px-3 py-1.5 text-white"
            : "bg-white px-3 py-1.5 text-[var(--color-text-muted)]"
        }
      >
        English
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 font-semibold">{title}</h2>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function Email() {
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} className="text-[var(--color-brand-red)] underline">
      {CONTACT_EMAIL}
    </a>
  );
}

function DeletionKo() {
  return (
    <>
      <p className="mb-6 text-[var(--color-text-muted)]">
        줍줍(Gup Gup)은 이용자가 언제든지 자신의 계정과 개인정보 삭제를 요청할 수 있도록 아래 방법을
        제공합니다. 구글·페이스북·이메일 중 어떤 방법으로 가입했든 동일하게 적용됩니다.
      </p>

      <Section title="1. 사이트에서 직접 탈퇴하기 (가장 빠른 방법)">
        <ol className="list-decimal space-y-1 pl-5">
          <li>줍줍에 로그인합니다.</li>
          <li>
            오른쪽 위 내 닉네임을 눌러{" "}
            <Link href="/profile" className="text-[var(--color-brand-red)] underline">
              내 프로필
            </Link>
            로 이동합니다.
          </li>
          <li>화면 아래의 &ldquo;회원탈퇴&rdquo;를 눌러 탈퇴를 완료합니다.</li>
        </ol>
        <p>탈퇴하면 계정 정보(이메일, 소셜 로그인 식별자, 닉네임, 국가, 프로필 사진)가 즉시 삭제됩니다.</p>
      </Section>

      <Section title="2. 이메일로 삭제 요청하기">
        <p>
          로그인할 수 없거나 직접 탈퇴가 어려우면 <Email />로 삭제를 요청해 주세요. 메일에는 가입한 이메일
          주소 또는 닉네임, 가입 방법(구글/페이스북/이메일)을 적어 주시면 됩니다. 본인 확인 후 영업일 기준
          7일 이내에 처리하고 결과를 회신해 드립니다.
        </p>
      </Section>

      <Section title="3. 페이스북으로 가입한 경우">
        <p>
          페이스북에서 줍줍 앱 연결을 끊으려면 페이스북 &ldquo;설정 및 개인정보&rdquo; → &ldquo;설정&rdquo; →
          &ldquo;앱 및 웹사이트&rdquo;에서 Gup Gup을 찾아 &ldquo;삭제&rdquo;를 누르세요. 연결을 끊은 뒤 위 1번
          또는 2번 방법으로 줍줍에 저장된 데이터 삭제를 요청할 수 있습니다.
        </p>
      </Section>

      <Section title="4. 삭제되는 정보와 유지되는 정보">
        <ul className="list-disc space-y-1 pl-5">
          <li>삭제: 이메일 주소, 소셜 로그인 식별자, 닉네임, 국가, 프로필 사진 등 계정 정보</li>
          <li>
            유지: 작성한 게시글·댓글은 다른 이용자의 대화 흐름을 위해 삭제되지 않고, 작성자 표시만
            &ldquo;탈퇴한 회원입니다&rdquo;로 바뀝니다. 게시글·댓글 자체의 삭제를 원하면 탈퇴 전에 직접
            삭제하거나 <Email />로 요청해 주세요.
          </li>
        </ul>
        <p>
          자세한 내용은{" "}
          <Link href="/privacy" className="text-[var(--color-brand-red)] underline">
            개인정보처리방침
          </Link>
          을 참고해 주세요.
        </p>
      </Section>
    </>
  );
}

function DeletionEn() {
  return (
    <>
      <p className="mb-6 text-[var(--color-text-muted)]">
        GupGup lets users request deletion of their account and personal data at any time using the
        methods below. They apply the same way whether you signed up with Google, Facebook, or email.
      </p>

      <Section title="1. Delete your account on the site (fastest)">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Log in to GupGup.</li>
          <li>
            Tap your nickname at the top right and go to{" "}
            <Link href="/profile" className="text-[var(--color-brand-red)] underline">
              My Profile
            </Link>
            .
          </li>
          <li>Tap &ldquo;Delete account&rdquo; at the bottom of the page to finish.</li>
        </ol>
        <p>
          Your account information (email, social login identifier, nickname, country, profile photo)
          is deleted immediately.
        </p>
      </Section>

      <Section title="2. Request deletion by email">
        <p>
          If you cannot log in, email <Email /> with your sign-up email address or nickname and how you
          signed up (Google / Facebook / email). After verifying your identity, we will process the
          request within 7 business days and reply to you.
        </p>
      </Section>

      <Section title="3. If you signed up with Facebook">
        <p>
          To remove the GupGup app from Facebook, go to Facebook &ldquo;Settings &amp; privacy&rdquo; →
          &ldquo;Settings&rdquo; → &ldquo;Apps and websites&rdquo;, find Gup Gup and tap
          &ldquo;Remove&rdquo;. Then use method 1 or 2 above to delete the data stored on GupGup.
        </p>
      </Section>

      <Section title="4. What is deleted and what remains">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Deleted: account information such as email address, social login identifier, nickname,
            country and profile photo.
          </li>
          <li>
            Kept: posts and comments you wrote remain so other users&rsquo; conversations stay intact,
            with the author shown as &ldquo;Deleted user.&rdquo; To have them removed, delete them before
            leaving or email <Email />.
          </li>
        </ul>
        <p>
          See the{" "}
          <Link href="/privacy" className="text-[var(--color-brand-red)] underline">
            Privacy Policy
          </Link>{" "}
          for details.
        </p>
      </Section>
    </>
  );
}
