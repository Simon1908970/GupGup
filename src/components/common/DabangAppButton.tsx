"use client";

import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { cn } from "@/lib/utils";

const IOS_APP_STORE_URL = "https://apps.apple.com/app/id814840066";
const ANDROID_PACKAGE = "kr.co.station3.dabang";
const ANDROID_PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
// 안드로이드에서 다방 앱이 설치돼 있으면 intent가 앱으로 바로 넘기고,
// 없으면 S.browser_fallback_url로 자동으로 플레이스토어로 빠진다.
const ANDROID_INTENT_URL = `intent://www.dabangapp.com/#Intent;scheme=https;package=${ANDROID_PACKAGE};S.browser_fallback_url=${encodeURIComponent(ANDROID_PLAY_STORE_URL)};end`;

type Platform = "ios" | "android" | "pc";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "pc";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "pc";
}

export function DabangAppButton({ className }: { className?: string }) {
  const { t } = useLanguage();
  // 서버 렌더링 시점엔 기기를 알 수 없어 PC(비활성) 상태로 그리고,
  // 마운트 후 실제 기기로 갱신한다 -- 다방은 외국인전용관·다국어 지원이
  // 앱 전용 기능이라 PC에서는 웹사이트로 보내지 않는다.
  const [platform, setPlatform] = useState<Platform>("pc");

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  const isApp = platform !== "pc";
  const href = platform === "ios" ? IOS_APP_STORE_URL : ANDROID_INTENT_URL;

  return (
    <div className={cn("w-full", className)}>
      {isApp ? (
        <a
          href={href}
          className="relative flex w-full items-center justify-center gap-2 rounded-md bg-[var(--color-brand-red)] py-2.5 text-sm font-medium text-white gg-glossy-btn"
        >
          <Smartphone size={16} />
          {t("dabang.button")}
        </a>
      ) : (
        <div
          aria-disabled="true"
          className="flex w-full items-center justify-center gap-2 rounded-md border border-[var(--color-border-gray)] bg-[var(--color-border-gray-light)]/40 py-2.5 text-sm font-medium text-[var(--color-text-muted)]"
        >
          <Smartphone size={16} />
          {t("dabang.button")}
        </div>
      )}
      <p className="mt-1.5 text-center text-xs text-[var(--color-text-muted)]">
        {isApp ? t("dabang.mobileNotice") : t("dabang.pcNotice")}
      </p>
    </div>
  );
}
