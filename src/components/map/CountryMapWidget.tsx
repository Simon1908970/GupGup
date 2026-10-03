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

export function CountryMapWidget({ compact = false }: { compact?: boolean }) {
  const { t } = useLanguage();
  const [country, setCountry] = useState<CountryCode | "all">("all");
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchBusinesses(country), fetchMapPosts(country)]).then(([b, p]) => {
      if (cancelled) return;
      setBusinesses(b);
      setPosts(p);
    });
    return () => {
      cancelled = true;
    };
  }, [country]);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMapsScript().then(() => {
      if (cancelled || !mapDivRef.current || mapRef.current) return;
      mapRef.current = new window.google!.maps.Map(mapDivRef.current, {
        center: DEFAULT_CENTER,
        zoom: 11,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const infoWindow = new window.google.maps.InfoWindow();

    for (const b of businesses) {
      const marker = new window.google.maps.Marker({
        position: { lat: b.lat, lng: b.lng },
        map: mapRef.current,
        icon: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
        title: b.name,
      });
      marker.addListener("click", () => {
        infoWindow.setContent(
          `<div style="font-size:13px"><strong>${b.name}</strong><br/>${t(
            `map.category.${b.category}` as DictionaryKey,
          )}<br/>${b.address}${b.phone ? `<br/>${b.phone}` : ""}</div>`,
        );
        infoWindow.open(mapRef.current!, marker);
      });
      markersRef.current.push(marker);
    }

    for (const p of posts) {
      if (p.businessLat == null || p.businessLng == null) continue;
      const marker = new window.google.maps.Marker({
        position: { lat: p.businessLat, lng: p.businessLng },
        map: mapRef.current,
        icon: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
        title: p.title,
      });
      marker.addListener("click", () => {
        infoWindow.setContent(
          `<div style="font-size:13px"><strong>${p.title}</strong><br/><a href="/board/life/${p.id}">${t("map.viewPost")}</a></div>`,
        );
        infoWindow.open(mapRef.current!, marker);
      });
      markersRef.current.push(marker);
    }
  }, [businesses, posts, t]);

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
