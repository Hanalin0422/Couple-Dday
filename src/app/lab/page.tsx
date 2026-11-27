import type { Metadata } from "next";
import { LabApp } from "@/lab/LabApp";

/** [LAB] 실기기 렌더링 비교 환경. 제거 방법: src/lab/README.md */
export const metadata: Metadata = { title: "D-Day LAB", robots: { index: false, follow: false } };

export default function LabPage() {
  return <LabApp />;
}
