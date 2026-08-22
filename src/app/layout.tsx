import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { SiteHeader } from "@/components/layout/SiteHeader";

const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
});

const freesentation = localFont({
  src: "./fonts/Freesentation-7Bold.ttf",
  variable: "--font-heading",
  weight: "700",
});

const scDream = localFont({
  src: "./fonts/SCDream5.otf",
  variable: "--font-scdream",
  weight: "500",
});

export const metadata: Metadata = {
  title: "Gup Gup (줍줍)",
  description: "한국에 거주하는 외국인을 위한 커뮤니티, 줍줍",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${notoSansKr.variable} ${freesentation.variable} ${scDream.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-white">
        <LanguageProvider>
          <AuthProvider>
            <SiteHeader />
            <main className="flex-1">{children}</main>
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
