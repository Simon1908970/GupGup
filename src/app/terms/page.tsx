"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";

export default function TermsPage() {
  const { t } = useLanguage();
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 text-sm leading-relaxed">
      <h1 className="mb-2 text-lg font-bold">이용약관</h1>
      <p className="mb-6 rounded-md bg-[var(--color-border-gray-light)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
        {t("legal.translateNotice")}
      </p>

      <Article title="제1조 (목적)">
        이 약관은 줍줍(이하 &ldquo;서비스&rdquo;)을 운영하는 개인사업자(이하 &ldquo;운영자&rdquo;)가 제공하는
        커뮤니티 서비스의 이용조건 및 절차, 운영자와 이용자의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.
      </Article>

      <Article title="제2조 (용어의 정의)">
        <ol className="list-decimal space-y-1 pl-5">
          <li>&ldquo;서비스&rdquo;란 운영자가 제공하는 웹사이트 줍줍 및 관련 제반 서비스를 의미합니다.</li>
          <li>&ldquo;회원&rdquo;이란 이 약관에 동의하고 서비스에 가입하여 계정을 부여받은 자를 말합니다.</li>
          <li>&ldquo;게시물&rdquo;이란 회원이 서비스 이용과 관련하여 게시한 글, 댓글, 사진, 파일 등을 의미합니다.</li>
        </ol>
      </Article>

      <Article title="제3조 (약관의 효력 및 변경)">
        <ol className="list-decimal space-y-1 pl-5">
          <li>이 약관은 서비스 화면에 게시하거나 기타의 방법으로 공지함으로써 효력이 발생합니다.</li>
          <li>
            운영자는 관련 법령을 위배하지 않는 범위에서 이 약관을 개정할 수 있으며, 개정 시 적용일자 및
            개정사유를 명시하여 적용일 최소 7일 전(이용자에게 불리한 변경의 경우 30일 전)부터 공지합니다.
          </li>
          <li>
            회원이 개정 약관에 동의하지 않을 경우 회원 탈퇴를 요청할 수 있으며, 공지 후에도 서비스를
            계속 이용할 경우 개정 약관에 동의한 것으로 간주합니다.
          </li>
        </ol>
      </Article>

      <Article title="제4조 (회원가입)">
        <ol className="list-decimal space-y-1 pl-5">
          <li>이용자는 운영자가 정한 가입 양식에 따라 이메일 또는 구글·페이스북 계정으로 가입을 신청합니다.</li>
          <li>
            운영자는 다음 각 호에 해당하는 경우 가입을 거부하거나 사후에 이용계약을 해지할 수 있습니다.
            <ol className="list-disc space-y-1 pl-5 pt-1">
              <li>만 14세 미만인 경우</li>
              <li>타인의 정보를 도용하거나 허위 정보를 기재한 경우</li>
              <li>이전에 이 약관에 따라 자격을 상실한 사실이 있는 경우</li>
              <li>기타 회원으로 등록하는 것이 부적절하다고 판단되는 경우</li>
            </ol>
          </li>
        </ol>
      </Article>

      <Article title="제5조 (서비스의 내용)">
        운영자가 제공하는 서비스는 다음과 같습니다.
        <ol className="list-decimal space-y-1 pl-5 pt-1">
          <li>커뮤니티 게시판 서비스(뉴스, 커뮤니티, 룸메이트, 한국 생활, 중고거래, 한국 대학교, 모임 등)</li>
          <li>회원 간 쪽지 서비스</li>
          <li>문의사항(1:1 고객센터) 서비스</li>
          <li>기타 운영자가 추가로 개발하거나 제휴를 통해 제공하는 서비스</li>
        </ol>
      </Article>

      <Article title="제6조 (서비스의 중단)">
        <ol className="list-decimal space-y-1 pl-5">
          <li>운영자는 시스템 점검, 교체, 고장, 통신 두절 등의 사유가 발생한 경우 서비스 제공을 일시적으로 중단할 수 있습니다.</li>
          <li>운영자는 서비스 제공을 위해 체결한 제휴사와의 계약 종료, 사업 포기 등의 사유로 서비스를 종료할 수 있으며, 이 경우 사전에 공지합니다.</li>
        </ol>
      </Article>

      <Article title="제7조 (회원 탈퇴 및 자격 상실)">
        <ol className="list-decimal space-y-1 pl-5">
          <li>회원은 언제든지 프로필 화면을 통해 탈퇴를 요청할 수 있으며, 운영자는 즉시 이를 처리합니다.</li>
          <li>회원 탈퇴 시 작성한 게시물과 댓글은 삭제되지 않고 유지되며, 작성자 표시만 &ldquo;탈퇴한 회원입니다&rdquo;로 대체됩니다.</li>
          <li>
            회원이 다음 각 호에 해당하는 행위를 한 경우 운영자는 사전 통보 없이 이용계약을 해지하거나 서비스 이용을 제한할 수 있습니다.
            <ol className="list-disc space-y-1 pl-5 pt-1">
              <li>타인의 개인정보, 계정을 도용한 경우</li>
              <li>서비스 운영을 고의로 방해한 경우</li>
              <li>제12조에서 정한 금지행위를 한 경우</li>
            </ol>
          </li>
        </ol>
      </Article>

      <Article title="제8조 (회원에 대한 통지)">
        운영자가 회원에게 통지하는 경우 회원이 등록한 이메일 주소로 하거나, 서비스 내 공지사항 게시를 통해 갈음할 수 있습니다.
      </Article>

      <Article title="제9조 (개인정보보호)">
        운영자는 관련 법령이 정하는 바에 따라 회원의 개인정보를 보호하기 위해 노력하며, 개인정보의 수집·이용·보관 등에
        관한 세부사항은 별도의{" "}
        <a href="/privacy" className="text-[var(--color-brand-red)] underline">
          개인정보처리방침
        </a>
        에 따릅니다.
      </Article>

      <Article title="제10조 (운영자의 의무)">
        <ol className="list-decimal space-y-1 pl-5">
          <li>운영자는 관련 법령과 이 약관이 금지하는 행위를 하지 않으며, 안정적인 서비스 제공을 위해 노력합니다.</li>
          <li>운영자는 서비스 이용과 관련한 회원의 의견이나 불만이 정당하다고 인정할 경우 이를 처리하기 위해 노력합니다.</li>
        </ol>
      </Article>

      <Article title="제11조 (회원의 계정 관리)">
        <ol className="list-decimal space-y-1 pl-5">
          <li>회원은 자신의 계정(이메일·비밀번호, 소셜 로그인 포함)을 스스로 관리할 책임이 있습니다.</li>
          <li>회원은 자신의 계정이 도용되거나 제3자가 사용하고 있음을 인지한 경우 즉시 운영자에게 통지해야 합니다.</li>
        </ol>
      </Article>

      <Article title="제12조 (이용자의 의무)">
        회원은 다음 각 호의 행위를 하여서는 안 됩니다.
        <ol className="list-decimal space-y-1 pl-5 pt-1">
          <li>가입 신청 또는 정보 변경 시 허위 내용을 등록하는 행위</li>
          <li>타인의 정보를 도용하는 행위</li>
          <li>운영자 및 제3자의 저작권 등 지식재산권을 침해하는 행위</li>
          <li>운영자 및 제3자의 명예를 훼손하거나 업무를 방해하는 행위</li>
          <li>외설적이거나 폭력적인 내용, 기타 공서양속에 반하는 정보를 게시하는 행위</li>
          <li>다른 회원을 희롱, 위협, 지속적으로 괴롭히는 행위</li>
          <li>영리를 목적으로 서비스를 이용하거나 스팸성 광고를 게시하는 행위</li>
          <li>범죄와 결부된다고 객관적으로 판단되는 행위</li>
          <li>기타 관련 법령에 위배되는 행위</li>
        </ol>
      </Article>

      <Article title="제13조 (게시물의 관리)">
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            회원이 작성한 게시물이 다음 각 호에 해당하는 경우 운영자는 사전 통지 없이 게시물을 삭제하거나 이동할 수 있습니다.
            <ol className="list-disc space-y-1 pl-5 pt-1">
              <li>제12조의 금지행위에 해당하는 경우</li>
              <li>타인을 비방하거나 명예를 훼손하는 내용을 포함하는 경우</li>
              <li>개인정보를 무단으로 노출하는 경우</li>
              <li>도배성, 광고성 게시물인 경우</li>
              <li>다른 이용자 또는 제3자의 신고가 접수되어 운영자가 확인이 필요하다고 판단하는 경우</li>
            </ol>
          </li>
          <li>운영자는 신고 접수 시 사유를 확인하여 처리하며, 처리 결과는 신고자에게 간단히 안내할 수 있습니다.</li>
        </ol>
      </Article>

      <Article title="제14조 (게시물의 저작권)">
        <ol className="list-decimal space-y-1 pl-5">
          <li>회원이 서비스 내에 게시한 게시물의 저작권은 해당 게시물을 작성한 회원에게 귀속됩니다.</li>
          <li>
            회원은 자신이 게시한 게시물을 서비스 운영, 홍보 등의 목적으로 운영자가 비독점적으로
            사용(복제, 전시, 전송 등)하는 것에 동의합니다. 다만 회원 탈퇴 등의 사유로 이용을 원하지 않는
            경우 운영자에게 삭제를 요청할 수 있습니다.
          </li>
        </ol>
      </Article>

      <Article title="제15조 (이용자 간 활동에 대한 책임의 한계)">
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            서비스는 회원 간 정보 공유와 소통을 위한 게시판을 제공할 뿐이며, 회원 간 이루어지는 물품
            거래(중고거래 게시판 등), 주거 관련 연락(룸메이트 게시판 등), 오프라인 모임(모임 게시판 등)의
            당사자가 아닙니다.
          </li>
          <li>운영자는 회원 간 거래·연락·만남과 관련하여 발생하는 손해에 대해 책임을 지지 않으며, 해당 책임은 당사자 간에 귀속됩니다.</li>
          <li>회원은 오프라인 만남이나 거래 시 개인정보 노출, 안전 등에 유의하여야 하며, 운영자는 신고·차단 기능을 제공하는 것 외에 개별 거래·만남에 개입하지 않습니다.</li>
        </ol>
      </Article>

      <Article title="제16조 (면책조항)">
        <ol className="list-decimal space-y-1 pl-5">
          <li>운영자는 천재지변, 전쟁, 기간통신사업자의 서비스 중지 등 불가항력으로 인하여 서비스를 제공할 수 없는 경우 책임이 면제됩니다.</li>
          <li>운영자는 회원의 귀책사유로 인한 서비스 이용 장애에 대해 책임을 지지 않습니다.</li>
          <li>운영자는 회원이 게시한 정보, 자료의 신뢰도, 정확성에 대해 책임을 지지 않습니다.</li>
        </ol>
      </Article>

      <Article title="제17조 (분쟁 해결 및 재판관할)">
        <ol className="list-decimal space-y-1 pl-5">
          <li>이 약관은 대한민국 법령에 따라 규율되고 해석됩니다.</li>
          <li>서비스 이용과 관련하여 운영자와 회원 간에 분쟁이 발생한 경우, 양 당사자는 분쟁의 원만한 해결을 위해 성실히 협의합니다.</li>
          <li>협의가 이루어지지 않을 경우 민사소송법상의 관할법원에 소를 제기할 수 있습니다.</li>
        </ol>
      </Article>

      <Article title="제18조 (문의)">
        이 약관 및 서비스 이용에 관한 문의는{" "}
        <a href="mailto:gupguptalk@gmail.com" className="text-[var(--color-brand-red)] underline">
          gupguptalk@gmail.com
        </a>
        으로 접수합니다.
      </Article>

      <p className="mt-8 text-xs text-[var(--color-text-muted)]">
        부칙: 이 약관은 2026년 10월 1일부터 시행합니다.
      </p>
    </div>
  );
}

function Article({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      <div className="text-[var(--color-text-muted)]">{children}</div>
    </section>
  );
}
