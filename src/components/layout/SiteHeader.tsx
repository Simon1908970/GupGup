"use client";

import { useEffect, useState } from "react";
import { Moon, Search, Sun, X } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { SearchBar } from "@/components/layout/SearchBar";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { UserMenu } from "@/components/layout/UserMenu";
import { CategoryNav } from "@/components/layout/CategoryNav";

const DARK_MODE_STORAGE_KEY = "gg-dark-mode";

export function SiteHeader() {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(DARK_MODE_STORAGE_KEY) === "1";
    setDarkMode(stored);
    document.documentElement.classList.toggle("gg-dark", stored);
  }, []);

  function toggleDarkMode() {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("gg-dark", next);
    localStorage.setItem(DARK_MODE_STORAGE_KEY, next ? "1" : "0");
  }

  return (
    <header className="sticky top-0 z-30 w-full border-b border-[var(--color-border-gray-light)] bg-white">
      {/* Desktop / tablet: single row, unchanged */}
      <div className="mx-auto hidden max-w-6xl items-center gap-6 px-4 py-3 sm:flex">
        <Logo />
        <div className="flex-1">
          <SearchBar />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <LanguageSwitcher />
          <UserMenu />
        </div>
      </div>

      {/* Mobile: icon collapses into a full search bar */}
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 sm:hidden">
        {mobileSearchOpen ? (
          <>
            <button
              type="button"
              aria-label="닫기"
              onClick={() => setMobileSearchOpen(false)}
              className="shrink-0 p-1 text-[var(--color-text-muted)]"
            >
              <X size={20} />
            </button>
            <div className="min-w-0 flex-1">
              <SearchBar />
            </div>
          </>
        ) : (
          <>
            <Logo />
            <div className="flex-1" />
            <button
              type="button"
              aria-label="검색"
              onClick={() => setMobileSearchOpen(true)}
              className="shrink-0 p-1 text-[var(--foreground)]"
            >
              <Search size={20} />
            </button>
            <button
              type="button"
              aria-label="다크 모드"
              onClick={toggleDarkMode}
              className="shrink-0 p-1 text-[var(--foreground)]"
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <LanguageSwitcher />
            <UserMenu />
          </>
        )}
      </div>

      <CategoryNav />
    </header>
  );
}
