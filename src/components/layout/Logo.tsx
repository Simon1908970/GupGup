import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-jubjub.png" alt="줍줍" className="h-9 w-auto" />
    </Link>
  );
}
