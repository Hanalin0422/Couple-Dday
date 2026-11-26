"use client";

/**
 * 오류·손상·버전 변경 안내 화면 (PWA-E03, PWA-E04, §5.3). 상세 문구·배치는 미확정 UI로 사용자 검수 대상이다.
 * 데이터를 자동 삭제하거나 초기화하는 버튼을 두지 않는다.
 */
import { Button } from "@/components/ui/primitives";

function StatusLayout({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <main className="absolute inset-0 flex flex-col items-center justify-center bg-background px-gutter text-center" role="alert">
      <h1 className="text-ui-sheet-title font-semibold text-text-primary">{title}</h1>
      <p className="mt-2 max-w-80 text-ui-caption leading-relaxed text-text-secondary">{description}</p>
      {action && <div className="mt-8 w-full max-w-80">{action}</div>}
    </main>
  );
}

export function LoadingScreen() {
  // DB 조회 완료 전에는 아무 화면(특히 온보딩)도 표시하지 않는다 (PWA-008).
  return <main className="absolute inset-0 bg-background" aria-busy="true" />;
}

export function StorageErrorScreen({ onRetry, newerVersion }: { onRetry: () => void; newerVersion: boolean }) {
  return newerVersion ? (
    <StatusLayout title="앱을 다시 실행해 주세요" description="새 버전의 데이터가 감지되었어요. 앱을 완전히 종료한 뒤 다시 실행해 주세요. 저장된 데이터는 그대로 유지돼요." />
  ) : (
    <StatusLayout
      title="데이터를 불러오지 못했어요"
      description="저장된 데이터는 삭제되지 않았어요. 잠시 후 다시 시도해 주세요."
      action={<Button onClick={onRetry}>다시 시도</Button>}
    />
  );
}

export function CorruptDataScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <StatusLayout
      title="저장된 데이터를 확인할 수 없어요"
      description="데이터 일부가 올바르지 않아 앱을 열 수 없어요. 데이터는 자동으로 삭제하지 않았어요. 백업 파일이 있다면 복원 기능으로 되돌릴 수 있어요."
      action={<Button onClick={onRetry}>다시 시도</Button>}
    />
  );
}

export function VersionChangedScreen() {
  return <StatusLayout title="앱이 업데이트되었어요" description="안전하게 사용하려면 앱을 다시 실행해 주세요." />;
}
