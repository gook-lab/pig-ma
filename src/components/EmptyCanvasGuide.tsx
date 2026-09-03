import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  LayoutDashboard,
  Map,
  MousePointer2,
  Shapes,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/store";
import { Z_HEADER } from "@/constants/zIndex";

const STORAGE_KEY = "pig-onboarding-complete";
const STEP_DURATION = 2600;

const STEPS = [
  {
    title: "Pig-ma에 오신 것을 환영합니다",
    description: "도형과 메모를 자유롭게 연결하는 무한 캔버스입니다.",
    icon: Shapes,
    position: "center",
  },
  {
    title: "하단 도구에서 시작하세요",
    description: "선택, 도형, 메모, 텍스트와 연결선을 바로 추가할 수 있습니다.",
    icon: MousePointer2,
    position: "toolbar",
  },
  {
    title: "미니맵으로 전체 위치를 확인하세요",
    description:
      "넓어진 캔버스를 이동하고 현재 보고 있는 영역을 찾을 수 있습니다.",
    icon: Map,
    position: "minimap",
  },
  {
    title: "상단 메뉴에서 작업을 관리하세요",
    description:
      "파일 저장, 검색, 템플릿 적용과 공유 기능을 사용할 수 있습니다.",
    icon: LayoutDashboard,
    position: "header",
  },
] as const;

const POSITION_CLASS = {
  center: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
  toolbar: "bottom-24 left-1/2 -translate-x-1/2",
  minimap: "right-4 bottom-48",
  header: "top-20 right-4",
} as const;

export function EmptyCanvasGuide() {
  const objectsCount = useCanvasStore((state) => state.objects.length);
  const hideUI = useCanvasStore((state) => state.hideUI);
  const isLocked = useCanvasStore((state) => state.isLocked);
  const [step, setStep] = useState(0);
  const [isVisible, setIsVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) !== "true";
  });

  const completeTour = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "true");
    setIsVisible(false);
  }, []);

  const nextStep = useCallback(() => {
    if (step === STEPS.length - 1) {
      completeTour();
      return;
    }
    setStep((current) => current + 1);
  }, [completeTour, step]);

  useEffect(() => {
    if (!isVisible || objectsCount > 0 || hideUI || isLocked) return;
    const timer = window.setTimeout(nextStep, STEP_DURATION);
    return () => window.clearTimeout(timer);
  }, [hideUI, isLocked, isVisible, nextStep, objectsCount]);

  useEffect(() => {
    if (objectsCount > 0 && isVisible) completeTour();
  }, [completeTour, isVisible, objectsCount]);

  if (!isVisible || objectsCount > 0 || hideUI || isLocked) return null;

  const current = STEPS[step] ?? STEPS[0];
  const Icon = current.icon;

  return (
    <aside
      aria-live="polite"
      aria-label={`시작 안내 ${step + 1}/${STEPS.length}`}
      className={cn(
        "pointer-events-auto fixed flex-none rounded-2xl border border-violet-200 bg-white/95 p-5 shadow-2xl shadow-violet-200/40 backdrop-blur-sm dark:border-violet-300 dark:bg-[#d6d7da]/95",
        POSITION_CLASS[current.position],
      )}
      style={{
        width: "min(360px, calc(100vw - 32px))",
        zIndex: Z_HEADER + 10,
      }}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-100">
          <Icon size={20} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <strong className="block text-sm font-semibold text-gray-900">
            {current.title}
          </strong>
          <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-600">
            {current.description}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="flex gap-1" aria-hidden="true">
          {STEPS.map((item, index) => (
            <span
              key={item.title}
              className={cn(
                "h-1.5 rounded-full transition-all",
                index === step ? "w-5 bg-violet-500" : "w-1.5 bg-gray-200",
              )}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={completeTour}
          className="ml-auto min-h-9 px-2 text-xs text-gray-400 hover:text-gray-700"
        >
          건너뛰기
        </button>
        <button
          type="button"
          onClick={nextStep}
          className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-violet-500 px-3 text-xs font-medium text-white hover:bg-violet-600"
        >
          {step === STEPS.length - 1 ? "시작하기" : "다음"}
          <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
