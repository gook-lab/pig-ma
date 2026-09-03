import { useState, useRef, useEffect } from "react";
import { Settings, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/store";
import { FONT_OPTIONS, fontStack } from "@/constants/fonts";

/**
 * 앱 전역 설정 팝오버.
 *
 * 객체별 옵션바와 역할이 다르다. 저쪽은 **고른 객체**를 바꾸고, 여기는
 * **앞으로 만들 객체**의 기본값을 정한다. 이미 있는 객체는 건드리지 않는다 —
 * 설정 한 번으로 문서 전체 서체가 바뀌면 되돌릴 방법이 없기 때문이다.
 */
export function SettingsMenu({ compact = false }: { compact?: boolean }) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const defaultFontFamily = useCanvasStore((s) => s.defaultFontFamily);
  const setDefaultFontFamily = useCanvasStore((s) => s.setDefaultFontFamily);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [showMenu]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setShowMenu((prev) => !prev)}
        aria-label="설정"
        aria-expanded={showMenu}
        title="설정"
        className={cn(
          compact
            ? "flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg px-2 text-xs hover:bg-gray-50"
            : "flex h-12 w-12 items-center justify-center rounded-xl border border-gray-200 bg-white shadow-lg dark:border-[#c0c1c4] dark:bg-[#d6d7da]",
          "text-gray-700 dark:text-gray-800",
          "transition-all hover:bg-gray-50 dark:hover:bg-[#c8c9cc]",
          "active:scale-95",
          showMenu &&
            "border-gray-300 bg-gray-50 dark:border-[#b0b1b4] dark:bg-[#c8c9cc]",
        )}
      >
        <Settings size={18} aria-hidden="true" />
        {compact && <span>설정</span>}
      </button>

      {showMenu && (
        <div className="popover-enter absolute top-full right-0 mt-2 w-60 rounded-xl border border-gray-200 bg-white py-2 shadow-xl">
          <div className="px-3 pb-1">
            <div className="text-xs font-semibold text-gray-500">기본 글꼴</div>
            <div className="mt-0.5 text-[11px] text-gray-400">
              새로 만드는 요소에만 적용됩니다
            </div>
          </div>

          {FONT_OPTIONS.map((font) => {
            const isActive = font.id === defaultFontFamily;
            return (
              <button
                key={font.id}
                onClick={() => setDefaultFontFamily(font.id)}
                className={cn(
                  "flex w-full items-center justify-between px-3 py-1.5 text-left text-sm",
                  "transition-colors hover:bg-gray-50",
                  isActive ? "text-violet-700" : "text-gray-700",
                )}
              >
                {/* 이름을 그 폰트로 보여 준다 — 고르기 전에 모양을 알 수 있다 */}
                <span style={{ fontFamily: fontStack(font.id) }}>
                  {font.label}
                </span>
                {isActive && <Check size={14} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
