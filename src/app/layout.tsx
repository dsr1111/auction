import type { Metadata } from "next";
import { Noto_Sans } from "next/font/google";
import "./globals.css";
import Layout from "@/components/Layout";
import AuthProvider from "@/components/AuthProvider";

const notoSans = Noto_Sans({
  variable: "--font-noto-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "DSR 길드 경매",
  description: "디지몬 슈퍼럼블 길드 경매 관리 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
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
