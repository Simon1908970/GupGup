"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatDate } from "@/lib/utils";

interface AdminUserRow {
  id: string;
  nickname: string;
  country: string;
  points: number;
  is_withdrawn: boolean;
  created_at: string;
}

export default function AdminUsersPage() {
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [pointsInput, setPointsInput] = useState<Record<string, string>>({});

  function load(query: string) {
    fetch(`/api/admin/users?q=${encodeURIComponent(query)}`)
      .then((r) => r.json())
      .then((data) => setUsers(data.users ?? []));
  }

  useEffect(() => {
    load(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAdjustPoints(id: string) {
    const raw = pointsInput[id];
    const delta = Number(raw);
    if (!raw || Number.isNaN(delta) || delta === 0) return;
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pointsDelta: delta }),
    });
    setPointsInput((prev) => ({ ...prev, [id]: "" }));
    load(q);
  }

  async function handleToggleWithdraw(id: string, next: boolean) {
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isWithdrawn: next }),
    });
    load(q);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold">회원 관리</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load(q);
        }}
        className="flex gap-2"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="닉네임 검색"
          className="h-10 flex-1 rounded-md border border-[var(--color-border-gray)] px-3 text-sm outline-none focus:border-[var(--color-brand-red)]"
        />
        <button className="h-10 rounded-md border border-[var(--color-border-gray)] px-4 text-sm font-medium">
          검색
        </button>
      </form>

      <ul className="divide-y divide-[var(--color-border-gray-light)] rounded-lg border border-[var(--color-border-gray)]">
        {users.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
            <span className="min-w-0 flex-1 truncate font-medium">{u.nickname}</span>
            <span className="text-xs text-[var(--color-text-muted)]">{u.country}</span>
            <span className="text-xs text-[var(--color-text-muted)]">{formatDate(u.created_at)}</span>
            <span className="text-xs font-semibold">{u.points}P</span>
            <input
              value={pointsInput[u.id] ?? ""}
              onChange={(e) => setPointsInput((prev) => ({ ...prev, [u.id]: e.target.value }))}
              placeholder="+/-포인트"
              className="h-8 w-24 rounded border border-[var(--color-border-gray)] px-2 text-xs"
            />
            <button
              onClick={() => handleAdjustPoints(u.id)}
              className="h-8 rounded border border-[var(--color-border-gray)] px-2 text-xs"
            >
              적용
            </button>
            <button
              onClick={() => handleToggleWithdraw(u.id, !u.is_withdrawn)}
              className={
                u.is_withdrawn
                  ? "h-8 rounded border border-[var(--color-border-gray)] px-2 text-xs"
                  : "h-8 rounded border border-[var(--color-brand-red)] px-2 text-xs text-[var(--color-brand-red)]"
              }
            >
              {u.is_withdrawn ? "탈퇴 해제" : "탈퇴 처리"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
