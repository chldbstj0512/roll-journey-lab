import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Roll & Journey - Lab",
  description: "현상소 관리 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
