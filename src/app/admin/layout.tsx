import Link from "next/link";
import { redirect } from "next/navigation";
import { assertAdmin } from "@/lib/supabase/adminAuth";

const NAV = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/reports", label: "신고 관리" },
  { href: "/admin/inquiries", label: "문의사항" },
  { href: "/admin/users", label: "회원 관리" },
  { href: "/admin/news", label: "뉴스 관리" },
  { href: "/admin/posts", label: "게시글 관리" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await assertAdmin();
  if (!admin) redirect("/");

  return (
    <div className="mx-auto flex max-w-5xl gap-6 px-4 py-6">
      <nav className="flex w-40 shrink-0 flex-col gap-1 text-sm">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-md px-3 py-2 hover:bg-[var(--color-border-gray-light)]"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
