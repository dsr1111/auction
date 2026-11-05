import type { Metadata } from "next";
import { Noto_Sans } from "next/font/google";
import "./globals.css";
import Layout from "@/components/Layout";
import AuthProvider from "@/components/AuthProvider";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

const notoSans = Noto_Sans({
  variable: "--font-noto-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "경매",
  description: "경매",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: 아래 스크립트가 화면 표시 전에 <html>에 dark 클래스를 붙이기 때문
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* 첫 화면이 뜨기 전에 테마를 적용해서 밝은 화면이 번쩍이지 않게 합니다 */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body
        className={`${notoSans.variable} font-sans antialiased`}
      >
        <AuthProvider>
          <Layout>{children}</Layout>
        </AuthProvider>
      </body>
    </html>
  );
}
