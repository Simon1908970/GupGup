"use client";

import { useEffect, useState } from "react";
import type { Business, BusinessCategory, CountryCode } from "@/lib/types";

interface AdminBusinessRow extends Business {
  isActive: boolean;
}

interface BusinessApiRow {
  id: string;
  name: string;
  category: BusinessCategory;
  country: CountryCode;
  address: string;
  lat: number;
  lng: number;
  phone: string | null;
  is_active: boolean;
}

export default function AdminBusinessesPage() {
  const [rows, setRows] = useState<AdminBusinessRow[]>([]);
  const [loading, setLoading] = useState(true);

  // businesses의 공개 RLS는 활성 행만 보여주므로, 비활성 행까지 보려면 서비스 롤
  // 기반 관리자 API(/api/admin/businesses)로 읽어야 한다.
  function load() {
    fetch("/api/admin/businesses")
      .then((r) => r.json())
      .then((data: { businesses?: BusinessApiRow[] }) =>
        setRows(
          (data.businesses ?? []).map((r) => ({
            id: r.id,
            name: r.name,
            category: r.category,
            country: r.country,
            address: r.address,
            lat: r.lat,
            lng: r.lng,
            phone: r.phone ?? undefined,
            isActive: r.is_active,
          })),
        ),
      )
      .catch(() => {
        // 네트워크 오류 시 기존 목록을 그대로 둔다.
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function toggle(id: string, next: boolean) {
    await fetch(`/api/admin/businesses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: next }),
    });
    load();
  }

  if (loading) return <p className="text-sm text-[var(--color-text-muted)]">로딩 중...</p>;

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-lg font-bold">업체 지도 관리</h1>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-[var(--color-text-muted)]">
            <th className="py-2">이름</th>
            <th>국가</th>
            <th>업종</th>
            <th>주소</th>
            <th>상태</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b">
              <td className="py-2">{r.name}</td>
              <td>{r.country}</td>
              <td>{r.category}</td>
              <td>{r.address}</td>
              <td>{r.isActive ? "활성" : "비활성"}</td>
              <td>
                <button
                  type="button"
                  onClick={() => toggle(r.id, !r.isActive)}
                  className="rounded-md border px-2 py-1 text-xs"
                >
                  {r.isActive ? "비활성화" : "활성화"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
