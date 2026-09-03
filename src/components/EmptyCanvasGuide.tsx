import { LayoutTemplate, MousePointer2, Shapes } from "lucide-react";
import { useCanvasStore } from "@/store";

export function EmptyCanvasGuide() {
  const objectsCount = useCanvasStore((state) => state.objects.length);
  const hideUI = useCanvasStore((state) => state.hideUI);
  const isLocked = useCanvasStore((state) => state.isLocked);
  const setShowTemplatesPanel = useCanvasStore(
    (state) => state.setShowTemplatesPanel,
  );

  if (objectsCount > 0 || hideUI || isLocked) return null;

  return (
    <section
      aria-labelledby="empty-canvas-title"
      className="pointer-events-none fixed inset-0 flex items-center justify-center px-6 pb-24"
    >
      <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-gray-200/80 bg-white/90 p-6 text-center shadow-xl shadow-gray-200/40 backdrop-blur-sm dark:border-gray-500 dark:bg-[#d6d7da]/95 dark:shadow-black/10">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-100">
          <Shapes size={22} aria-hidden="true" />
        </div>
        <h1
          id="empty-canvas-title"
          className="text-lg font-semibold text-gray-900"
        >
          아이디어를 캔버스에 펼쳐보세요
        </h1>
        <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-600">
          하단 도구로 직접 그리거나 준비된 템플릿으로 빠르게 시작할 수 있습니다.
        </p>
        <button
          type="button"
          onClick={() => setShowTemplatesPanel(true)}
          className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 text-sm font-medium text-white transition-colors hover:bg-violet-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
        >
          <LayoutTemplate size={17} aria-hidden="true" />
          템플릿으로 시작하기
        </button>
        <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-gray-400 dark:text-gray-600">
          <MousePointer2 size={13} aria-hidden="true" />
          도형을 추가하면 이 안내는 사라집니다
        </div>
      </div>
    </section>
  );
}
