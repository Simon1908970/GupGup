"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

type DocLang = "ko" | "en";

export default function PrivacyPage() {
  const { t } = useLanguage();
  const [lang, setLang] = useState<DocLang>("ko");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 text-sm leading-relaxed">
      <div className="mb-2 flex items-start justify-between gap-3">
        <h1 className="text-lg font-bold">
          {lang === "ko" ? "개인정보처리방침" : "Privacy Policy"}
        </h1>
        <LangToggle lang={lang} onChange={setLang} />
      </div>
      <p className="mb-4 rounded-md bg-[var(--color-border-gray-light)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
        {t("legal.translateNotice")}
      </p>

      {lang === "ko" ? (
        <p className="mb-6 text-[var(--color-text-muted)]">
          줍줍(이하 &ldquo;운영자&rdquo;)은 이용자의 개인정보를 중요시하며, 「개인정보보호법」 등 관련 법령을
          준수하고 있습니다. 운영자는 이 개인정보처리방침을 통해 이용자가 제공하는 개인정보가 어떠한 목적과
          방식으로 이용되고 있으며, 개인정보보호를 위해 어떠한 조치가 취해지고 있는지 알려드립니다.
        </p>
      ) : (
        <p className="mb-6 text-[var(--color-text-muted)]">
          GupGup (the &ldquo;Operator&rdquo;) values users&rsquo; personal information and complies
          with the Personal Information Protection Act and other related laws. Through this Privacy
          Policy, the Operator informs users of the purposes and manner in which personal information
          provided by users is used, and the measures taken to protect it.
        </p>
      )}

      {lang === "ko" ? <PrivacyKo /> : <PrivacyEn />}

      <p className="mt-8 text-xs text-[var(--color-text-muted)]">
        {lang === "ko"
          ? "공고일자: 2026년 10월 1일 / 시행일자: 2026년 10월 1일"
          : "Announced: October 1, 2026 / Effective: October 1, 2026"}
      </p>
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

function PrivacyKo() {
  return (
    <>
      <Section title="1. 수집하는 개인정보의 항목 및 수집방법">
        <p className="font-medium">가. 회원가입 시</p>
        <ul className="list-disc space-y-1 pl-5 pb-2">
          <li>이메일 로그인: 이메일 주소, 비밀번호(암호화 저장)</li>
          <li>구글·페이스북 로그인: 소셜 계정의 고유 식별자, 이메일 주소</li>
          <li>공통: 닉네임, 국가(선택)</li>
        </ul>
        <p className="font-medium">나. 서비스 이용 과정에서 생성되는 정보</p>
        <ul className="list-disc space-y-1 pl-5 pb-2">
          <li>프로필 사진(선택 업로드, 미설정 시 기본 아바타 자동 배정)</li>
          <li>게시글, 댓글, 쪽지, 문의 내용</li>
          <li>접속 로그, 접속 IP 정보, 쿠키, 서비스 이용기록</li>
        </ul>
        <p className="font-medium">다. 수집방법</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>회원가입, 서비스 이용 과정에서 이용자가 직접 입력</li>
          <li>구글, 페이스북 등 소셜 로그인 시 해당 사업자로부터 제공받음(각 사업자의 개인정보처리방침이 함께 적용됩니다)</li>
        </ul>
      </Section>

      <Section title="2. 개인정보의 수집 및 이용목적">
        <ul className="list-disc space-y-1 pl-5">
          <li>회원 식별 및 가입 의사 확인, 부정 이용 방지</li>
          <li>서비스 제공(게시판, 쪽지, 문의사항 등) 및 콘텐츠 제공</li>
          <li>회원 간 신고·차단 기능 운영, 부정 이용자 제재</li>
          <li>문의사항 응대 및 공지사항 전달</li>
        </ul>
      </Section>

      <Section title="3. 개인정보의 보유 및 이용기간">
        <ul className="list-disc space-y-1 pl-5">
          <li>원칙적으로 회원 탈퇴 시까지 보유하며, 탈퇴 즉시 파기합니다.</li>
          <li>다만 회원이 작성한 게시물·댓글은 탈퇴 후에도 삭제되지 않고 유지되며, 작성자 표시만 &ldquo;탈퇴한 회원입니다&rdquo;로 대체됩니다.</li>
          <li>관계 법령에 따라 보존이 필요한 경우 아래와 같이 별도 보관합니다.</li>
        </ul>
        <ul className="list-disc space-y-1 pl-9 pt-1">
          <li>통신비밀보호법에 따른 서비스 이용기록, 접속 로그: 3개월</li>
          <li>부정 이용, 신고 처리와 관련된 기록: 처리 완료 후 최대 6개월</li>
        </ul>
      </Section>

      <Section title="4. 개인정보의 제3자 제공">
        <p>운영자는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만 다음의 경우는 예외로 합니다.</p>
        <ul className="list-disc space-y-1 pl-5 pt-1">
          <li>이용자가 사전에 동의한 경우</li>
          <li>법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</li>
        </ul>
      </Section>

      <Section title="5. 개인정보처리의 위탁">
        <p>운영자는 안정적인 서비스 제공을 위해 아래와 같이 개인정보 처리업무를 위탁하고 있습니다.</p>
        <ul className="list-disc space-y-1 pl-5 pt-1">
          <li>수탁업체: Supabase, Inc.</li>
          <li>위탁업무: 회원 정보 및 게시물 데이터베이스 저장·관리, 로그인 인증 처리, 이미지 파일(프로필 사진 등) 저장</li>
          <li>위탁기간: 서비스 제공기간 동안 (해외 클라우드 서버 이용)</li>
        </ul>
      </Section>

      <Section title="6. 이용자 및 법정대리인의 권리와 행사방법">
        <ul className="list-disc space-y-1 pl-5">
          <li>이용자는 언제든지 프로필 화면에서 본인의 개인정보(닉네임, 국가, 프로필 사진 등)를 열람·수정할 수 있으며, 회원 탈퇴를 통해 이용을 종료할 수 있습니다.</li>
          <li>만 14세 미만 아동의 개인정보 처리에 관한 권리는 법정대리인이 대신 행사할 수 있습니다.</li>
        </ul>
      </Section>

      <Section title="7. 개인정보의 파기절차 및 방법">
        <ul className="list-disc space-y-1 pl-5">
          <li>회원 탈퇴 등 개인정보의 수집 및 이용목적이 달성된 개인정보는 지체없이 파기합니다.</li>
          <li>전자적 파일 형태로 저장된 개인정보는 복구할 수 없는 기술적 방법을 사용하여 삭제합니다.</li>
        </ul>
      </Section>

      <Section title="8. 개인정보의 안전성 확보조치">
        <ul className="list-disc space-y-1 pl-5">
          <li>비밀번호 암호화 저장</li>
          <li>접근권한 관리를 통한 개인정보에 대한 접근 통제</li>
          <li>서비스 제공업체(Supabase)의 데이터베이스 접근 제어 및 암호화 통신(HTTPS) 적용</li>
        </ul>
      </Section>

      <Section title="9. 쿠키(Cookie)의 운영 및 거부">
        <ul className="list-disc space-y-1 pl-5">
          <li>운영자는 이용자에게 맞춤화된 서비스를 제공하기 위해 쿠키를 사용할 수 있습니다.</li>
          <li>이용자는 웹 브라우저 설정을 통해 쿠키 저장을 거부할 수 있으며, 이 경우 로그인 유지 등 서비스 이용에 일부 제한이 있을 수 있습니다.</li>
        </ul>
      </Section>

      <Section title="10. 만 14세 미만 아동의 개인정보">
        <p>서비스는 만 14세 이상만 회원가입이 가능하며, 만 14세 미만 아동의 개인정보는 수집하지 않습니다.</p>
      </Section>

      <Section title="11. 개인정보보호책임자">
        <p>
          운영자는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 이용자의 불만처리 및 피해구제 등을 위하여
          아래와 같이 개인정보보호책임자를 지정하고 있습니다.
        </p>
        <ul className="list-disc space-y-1 pl-5 pt-1">
          <li>담당: 줍줍 운영자</li>
          <li>
            이메일:{" "}
            <a href="mailto:gupguptalk@gmail.com" className="text-[var(--color-brand-red)] underline">
              gupguptalk@gmail.com
            </a>
          </li>
        </ul>
        <p className="pt-1">
          이용자는 서비스 이용 중 발생하는 모든 개인정보보호 관련 문의, 불만처리, 피해구제 등을 위 이메일로
          문의하실 수 있으며, 운영자는 지체없이 답변 및 처리하겠습니다.
        </p>
      </Section>

      <Section title="12. 권익침해 구제방법">
        <p>개인정보 침해로 인한 신고나 상담이 필요하신 경우 아래 기관에 문의하실 수 있습니다.</p>
        <ul className="list-disc space-y-1 pl-5 pt-1">
          <li>개인정보분쟁조정위원회 (국번없이 1833-6972, www.kopico.go.kr)</li>
          <li>개인정보침해신고센터 (국번없이 118, privacy.kisa.or.kr)</li>
          <li>대검찰청 사이버범죄수사단 (02-3480-3573, www.spo.go.kr)</li>
          <li>경찰청 사이버안전국 (국번없이 182, cyberbureau.police.go.kr)</li>
        </ul>
      </Section>

      <Section title="13. 개인정보처리방침의 변경">
        <p>
          이 개인정보처리방침은 법령, 정책 또는 서비스 변경에 따라 내용의 추가·삭제 및 수정이 있을 시
          시행일 최소 7일 전(중대한 변경 시 30일 전)부터 서비스 내 공지사항을 통해 고지합니다.
        </p>
      </Section>
    </>
  );
}

function PrivacyEn() {
  return (
    <>
      <Section title="1. Items of Personal Information Collected and Collection Methods">
        <p className="font-medium">a. Upon registration</p>
        <ul className="list-disc space-y-1 pl-5 pb-2">
          <li>Email login: email address, password (stored encrypted)</li>
          <li>Google/Facebook login: the social account&rsquo;s unique identifier, email address</li>
          <li>Common: nickname, country (optional)</li>
        </ul>
        <p className="font-medium">b. Information generated while using the Service</p>
        <ul className="list-disc space-y-1 pl-5 pb-2">
          <li>Profile photo (optional upload; a default avatar is assigned automatically if not set)</li>
          <li>Posts, comments, messages, and inquiry content</li>
          <li>Access logs, access IP information, cookies, and service usage records</li>
        </ul>
        <p className="font-medium">c. Collection method</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Entered directly by the user during registration and use of the Service</li>
          <li>Received from the relevant provider upon social login via Google, Facebook, etc. (each provider&rsquo;s own privacy policy also applies)</li>
        </ul>
      </Section>

      <Section title="2. Purposes of Collection and Use of Personal Information">
        <ul className="list-disc space-y-1 pl-5">
          <li>Identifying members and confirming intent to register, and preventing fraudulent use</li>
          <li>Providing the Service (bulletin boards, messaging, inquiries, etc.) and content</li>
          <li>Operating the report/block features between Members, and sanctioning users for misconduct</li>
          <li>Responding to inquiries and delivering notices</li>
        </ul>
      </Section>

      <Section title="3. Retention and Use Period of Personal Information">
        <ul className="list-disc space-y-1 pl-5">
          <li>In principle, personal information is retained until withdrawal of membership and destroyed immediately upon withdrawal.</li>
          <li>However, posts and comments written by a Member are not deleted after withdrawal and remain, with only the author label replaced with &ldquo;Deleted user.&rdquo;</li>
          <li>Where retention is required under applicable law, information is retained separately as follows:</li>
        </ul>
        <ul className="list-disc space-y-1 pl-9 pt-1">
          <li>Service usage records and access logs under the Protection of Communications Secrets Act: 3 months</li>
          <li>Records related to fraud prevention and report handling: up to 6 months after processing is complete</li>
        </ul>
      </Section>

      <Section title="4. Provision of Personal Information to Third Parties">
        <p>The Operator does not, in principle, provide users&rsquo; personal information to outside parties. The following are exceptions:</p>
        <ul className="list-disc space-y-1 pl-5 pt-1">
          <li>Where the user has given prior consent</li>
          <li>Where required by law, or requested by an investigative agency under the procedures and methods prescribed by law for investigative purposes</li>
        </ul>
      </Section>

      <Section title="5. Outsourcing of Personal Information Processing">
        <p>The Operator outsources the following personal information processing tasks to ensure stable provision of the Service:</p>
        <ul className="list-disc space-y-1 pl-5 pt-1">
          <li>Processor: Supabase, Inc.</li>
          <li>Outsourced tasks: storage and management of the member information and post database, login authentication processing, and storage of image files (such as profile photos)</li>
          <li>Outsourcing period: for the duration of the Service (using an overseas cloud server)</li>
        </ul>
      </Section>

      <Section title="6. Rights of Users and Legal Representatives and How to Exercise Them">
        <ul className="list-disc space-y-1 pl-5">
          <li>A user may at any time view and edit their own personal information (nickname, country, profile photo, etc.) through the profile screen, and may end use of the Service by withdrawing membership.</li>
          <li>Rights concerning the processing of personal information of a child under 14 years of age may be exercised on the child&rsquo;s behalf by their legal representative.</li>
        </ul>
      </Section>

      <Section title="7. Procedures and Methods for Destruction of Personal Information">
        <ul className="list-disc space-y-1 pl-5">
          <li>Personal information for which the purpose of collection and use has been achieved, such as through membership withdrawal, is destroyed without delay.</li>
          <li>Personal information stored in electronic file form is deleted using a technical method that prevents recovery.</li>
        </ul>
      </Section>

      <Section title="8. Measures to Ensure the Security of Personal Information">
        <ul className="list-disc space-y-1 pl-5">
          <li>Passwords are stored encrypted.</li>
          <li>Access to personal information is controlled through access authorization management.</li>
          <li>The service provider&rsquo;s (Supabase) database access controls and encrypted communication (HTTPS) are applied.</li>
        </ul>
      </Section>

      <Section title="9. Operation of and Opting Out of Cookies">
        <ul className="list-disc space-y-1 pl-5">
          <li>The Operator may use cookies to provide a customized service to users.</li>
          <li>Users may refuse to allow cookies through their web browser settings, in which case some features of the Service, such as staying logged in, may be limited.</li>
        </ul>
      </Section>

      <Section title="10. Personal Information of Children Under 14">
        <p>Only users aged 14 or older may register as a Member, and the Operator does not collect the personal information of children under the age of 14.</p>
      </Section>

      <Section title="11. Personal Information Protection Officer">
        <p>
          The Operator designates a Personal Information Protection Officer as follows, who takes
          overall responsibility for personal information processing and handles users&rsquo;
          complaints and requests for remedy.
        </p>
        <ul className="list-disc space-y-1 pl-5 pt-1">
          <li>In charge: GupGup Operator</li>
          <li>
            Email:{" "}
            <a href="mailto:gupguptalk@gmail.com" className="text-[var(--color-brand-red)] underline">
              gupguptalk@gmail.com
            </a>
          </li>
        </ul>
        <p className="pt-1">
          Users may direct any inquiry, complaint, or request for remedy related to personal
          information protection that arises while using the Service to the above email address, and
          the Operator will respond and address it without delay.
        </p>
      </Section>

      <Section title="12. Remedies for Infringement of Rights">
        <p>If you need to file a report or seek consultation regarding an infringement of personal information, you may contact the following organizations:</p>
        <ul className="list-disc space-y-1 pl-5 pt-1">
          <li>Personal Information Dispute Mediation Committee (1833-6972, www.kopico.go.kr)</li>
          <li>Personal Information Infringement Report Center (118, privacy.kisa.or.kr)</li>
          <li>Supreme Prosecutors&rsquo; Office Cyber Investigation Division (02-3480-3573, www.spo.go.kr)</li>
          <li>National Police Agency Cyber Bureau (182, cyberbureau.police.go.kr)</li>
        </ul>
      </Section>

      <Section title="13. Changes to This Privacy Policy">
        <p>
          This Privacy Policy may be added to, deleted from, or amended due to changes in law, policy,
          or the Service, and any such change will be announced through a notice within the Service
          at least 7 days before the effective date (at least 30 days before, for material changes).
        </p>
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      <div className="text-[var(--color-text-muted)]">{children}</div>
    </section>
  );
}
