import { Logo } from "@/components/layout/Logo";
import { SearchBar } from "@/components/layout/SearchBar";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { UserMenu } from "@/components/layout/UserMenu";
import { CategoryNav } from "@/components/layout/CategoryNav";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-[var(--color-border-gray-light)] bg-white">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:gap-6">
        <Logo />
        <div className="flex-1">
          <SearchBar />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <LanguageSwitcher />
          <UserMenu />
        </div>
      </div>
      <CategoryNav />
    </header>
  );
}
