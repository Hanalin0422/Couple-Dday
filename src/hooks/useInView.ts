"use client";

import { useEffect, useState, type RefObject } from "react";

/** 요소가 화면(또는 스크롤 영역) 근처에 들어오면 true. 한 번 보이면 유지한다(이미지 지연 로딩용). */
export function useInView(ref: RefObject<Element | null>, rootMargin = "200px"): boolean {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || seen) return;
    if (typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setSeen(true));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setSeen(true);
        observer.disconnect();
      }
    }, { rootMargin });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, rootMargin, seen]);
  return seen;
}
