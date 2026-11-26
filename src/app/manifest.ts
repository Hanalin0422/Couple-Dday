import type { MetadataRoute } from "next";
import { APP_NAME } from "@/constants/app";

/**
 * Web App Manifest (PWA-001/002).
 * 앱 아이콘은 확정 디자인이 없어 Phase 8 에서 사용자 확인 후 추가한다.
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
    icons: [],
  };
}
