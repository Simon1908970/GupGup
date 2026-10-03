"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { COUNTRIES } from "@/lib/constants/countries";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import { fetchBusinesses } from "@/lib/supabase/businesses";
import { fetchMapPosts } from "@/lib/supabase/posts";
import type { Business, CountryCode, Post } from "@/lib/types";
import { CountryFlag } from "@/components/common/CountryFlag";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    google?: typeof google;
  }
}

const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 }; // 서울시청
const SCRIPT_ID = "gupgup-google-maps-script";

function loadGoogleMapsScript(): Promise<void> {
  if (window.google?.maps) return Promise.resolve();
  const existing = document.getElementById(SCRIPT_ID);
  if (existing) {
    return new Promise((resolve) => existing.addEventListener("load", () => resolve()));
  }
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&language=ko`;
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
}

// InfoWindow 내용은 HTML 문자열이 아니라 DOM 노드로 만든다 — setContent(string)은
// 원시 HTML로 렌더링되므로, 회원이 쓴 글 제목이나 카카오에서 수집한 업체명/주소를
// 문자열로 끼워 넣으면 저장형 XSS가 된다. 사용자/외부 데이터는 textContent로만 넣는다.
function buildBusinessInfoContent(b: Business, categoryLabel: string): HTMLDivElement {
  const container = document.createElement("div");
  container.style.fontSize = "13px";
  const name = document.createElement("strong");
  name.textContent = b.name;
  container.append(
    name,
    document.createElement("br"),
    document.createTextNode(categoryLabel),
    document.createElement("br"),
    document.createTextNode(b.address),
  );
  if (b.phone) {
    container.append(document.createElement("br"), document.createTextNode(b.phone));
  }
  return container;
}

function buildPostInfoContent(p: Post, linkLabel: string): HTMLDivElement {
  const container = document.createElement("div");
  container.style.fontSize = "13px";
  const title = document.createElement("strong");
  title.textContent = p.title;
  const link = document.createElement("a");
  link.href = `/board/life/${p.id}`;
  link.textContent = linkLabel;
  container.append(title, document.createElement("br"), link);
  return container;
}

export function CountryMapWidget({ compact = false }: { compact?: boolean }) {
  const { t } = useLanguage();
  const [country, setCountry] = useState<CountryCode | "all">("all");
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const mapDivRef = useRef<HTMLDivElement>(null);
  // 지도 인스턴스는 ref가 아니라 state로 둔다 — 구글 스크립트보다 업체/글 데이터가
  // 먼저 도착해도, 지도가 준비되는 순간 아래 마커 effect가 다시 실행되도록.
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  useEffect(() => {
    let cancelled = false;
    // 한쪽 조회가 실패해도 다른 쪽 핀은 그리도록 allSettled — 실패한 쪽은 빈 배열.
    Promise.allSettled([fetchBusinesses(country), fetchMapPosts(country)]).then(([b, p]) => {
      if (cancelled) return;
      setBusinesses(b.status === "fulfilled" ? b.value : []);
      setPosts(p.status === "fulfilled" ? p.value : []);
    });
    return () => {
      cancelled = true;
    };
  }, [country]);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMapsScript().then(() => {
      if (cancelled || !mapDivRef.current) return;
      setMap(
        new window.google!.maps.Map(mapDivRef.current, {
          center: DEFAULT_CENTER,
          zoom: 11,
        }),
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!map || !window.google) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const infoWindow = new window.google.maps.InfoWindow();

    for (const b of businesses) {
      const marker = new window.google.maps.Marker({
        position: { lat: b.lat, lng: b.lng },
        map,
        icon: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
        title: b.name,
      });
      marker.addListener("click", () => {
        infoWindow.setContent(
          buildBusinessInfoContent(b, t(`map.category.${b.category}` as DictionaryKey)),
        );
        infoWindow.open(map, marker);
      });
      markersRef.current.push(marker);
    }

    for (const p of posts) {
      if (p.businessLat == null || p.businessLng == null) continue;
      const marker = new window.google.maps.Marker({
        position: { lat: p.businessLat, lng: p.businessLng },
        map,
        icon: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
        title: p.title,
      });
      marker.addListener("click", () => {
        infoWindow.setContent(buildPostInfoContent(p, t("map.viewPost")));
        infoWindow.open(map, marker);
      });
      markersRef.current.push(marker);
    }
  }, [map, businesses, posts, t]);

  return (
    <div className="mb-4 flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {COUNTRIES.map((c) => (
          <button
            key={c.code}
            type="button"
            onClick={() => setCountry(c.code)}
            className={cn(
              "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
              country === c.code
                ? "border-[var(--color-brand-red)] bg-[var(--color-brand-red)] text-white"
                : "border-[var(--color-border-gray-light)] text-[var(--color-text-muted)]",
            )}
          >
            <CountryFlag code={c.code} size={14} />
            {t(c.labelKey as DictionaryKey)}
          </button>
        ))}
      </div>
      <div
        ref={mapDivRef}
        style={{ height: compact ? 320 : 640 }}
        className="w-full rounded-lg border border-[var(--color-border-gray-light)]"
      />
      <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
        <div className="flex gap-3">
          <span>🔴 {t("map.legendBusiness")}</span>
          <span>🔵 {t("map.legendPost")}</span>
        </div>
        {compact && (
          <Link href="/map" className="font-medium text-[var(--color-brand-red)]">
            {t("map.viewFullMap")}
          </Link>
        )}
      </div>
    </div>
  );
}
