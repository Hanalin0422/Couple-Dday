import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegistration } from "@/components/layout/ServiceWorkerRegistration";
import { APP_NAME } from "@/constants/app";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  applicationName: APP_NAME,
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false, date: false, address: false, email: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // SKILL.md §3 background 토큰. 라이트모드 단일 테마이므로 media 분기를 두지 않는다.
  themeColor: "#FFF8FA",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="preload"
          href="/fonts/pretendard/PretendardVariable.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <ServiceWorkerRegistration>{children}</ServiceWorkerRegistration>
      </body>
    </html>
  );
}
