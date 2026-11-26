import type { MetadataRoute } from "next";
import { APP_NAME } from "@/constants/app";

/**
 * Web App Manifest (PWA-001/002).
 * 아이콘: src/app/icon.svg 원본에서 생성한 PNG (npm run icons). 2026-11-26 사용자 승인.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    lang: "ko",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FFF8FA",
    theme_color: "#FFF8FA",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
