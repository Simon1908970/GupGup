"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";

declare global {
  interface Window {
    daum?: {
      Postcode: new (options: {
        oncomplete: (data: { roadAddress: string; jibunAddress: string }) => void;
      }) => { open: () => void };
    };
  }
}

// 현행 공식 로더(카카오 CDN). window.daum을 window.kakao의 별칭으로 잡아주므로
// 아래 window.daum.Postcode 사용 코드는 그대로 동작한다.
const SCRIPT_SRC = "//t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

function loadDaumPostcodeScript(): Promise<void> {
  if (window.daum?.Postcode) return Promise.resolve();
  // 로드에 실패한 script 태그는 onerror에서 제거하므로, 여기서 발견되는 태그는
  // 아직 로딩 중인 것뿐이다 — load/error 양쪽을 모두 기다린다.
  const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("failed to load postcode script")),
      );
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.onload = () => resolve();
    script.onerror = () => {
      // 실패한 태그를 남겨두면 다음 클릭 때 위 existing 분기에서 영원히 대기하므로
      // 제거해서 재시도 시 새로 로드하게 한다.
      script.remove();
      reject(new Error("failed to load postcode script"));
    };
    document.head.appendChild(script);
  });
}

export function AddressPicker({ onSelect }: { onSelect: (address: string) => void }) {
  const { t } = useLanguage();

  async function openPicker() {
    try {
      await loadDaumPostcodeScript();
    } catch {
      // 스크립트를 불러올 수 없으면 조용히 아무것도 하지 않는다(다음 클릭 시 재시도).
      return;
    }
    if (!window.daum?.Postcode) return;
    new window.daum.Postcode({
      oncomplete: (data) => {
        onSelect(data.roadAddress || data.jibunAddress);
      },
    }).open();
  }

  return (
    <button
      type="button"
      onClick={openPicker}
      className="rounded-md border border-[var(--color-brand-red)] px-3 py-1.5 text-sm font-medium text-[var(--color-brand-red)] hover:bg-[var(--color-brand-red)]/5"
    >
      {t("map.addressSearchButton")}
    </button>
  );
}
