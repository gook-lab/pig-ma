import { useEffect } from "react";
import { Github, LayoutTemplate, MousePointer2, Shapes, X } from "lucide-react";
import { Z_MODAL_BACKDROP, Z_MODAL_CONTENT } from "@/constants/zIndex";

export type ProductGuideSection = "about" | "guide";

interface ProductGuideDialogProps {
  section: ProductGuideSection;
  onClose: () => void;
}

const CONTENT = {
  about: {
    eyebrow: "ABOUT PIG-MA",
    title: "생각을 자유롭게 연결하는 무한 캔버스",
    description:
      "Pig-ma는 도형, 메모, 연결선과 다이어그램을 한 화면에서 구성하는 React 기반 캔버스 편집기입니다.",
  },
  guide: {
    eyebrow: "GETTING STARTED",
    title: "세 가지 방법으로 시작하세요",
    description:
      "빈 캔버스에 직접 그리거나, 템플릿을 적용하거나, 기존 작업 파일을 불러올 수 있습니다.",
  },
} satisfies Record<
  ProductGuideSection,
  { eyebrow: string; title: string; description: string }
>;

export function ProductGuideDialog({
  section,
  onClose,
}: ProductGuideDialogProps) {
  const content = CONTENT[section];

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <>
      <button
        type="button"
        aria-label="안내 닫기"
        className="fixed inset-0 bg-black/35 backdrop-blur-sm"
        style={{ zIndex: Z_MODAL_BACKDROP }}
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-guide-title"
        className="fixed top-1/2 left-1/2 w-[440px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl"
        style={{ zIndex: Z_MODAL_CONTENT }}
      >
        <button
          type="button"
          aria-label="안내 닫기"
          onClick={onClose}
          className="absolute top-4 right-4 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          <X size={19} aria-hidden="true" />
        </button>
        <p className="text-xs font-semibold tracking-[0.18em] text-violet-500">
          {content.eyebrow}
        </p>
        <h2
          id="product-guide-title"
          className="mt-2 pr-8 text-xl font-semibold text-gray-900"
        >
          {content.title}
        </h2>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          {content.description}
        </p>

        {section === "about" ? (
          <div className="mt-5 rounded-xl bg-gray-50 p-4 text-sm leading-6 text-gray-600">
            브라우저에서 바로 사용할 수 있으며 작업 내용은 현재 기기의 로컬
            저장소에 보관됩니다. 공개 데모에서는 AI 생성 기능을 제공하지
            않습니다.
          </div>
        ) : (
          <ol className="mt-5 space-y-3">
            <li className="flex gap-3 rounded-xl bg-gray-50 p-3">
              <Shapes className="mt-0.5 text-violet-500" size={18} />
              <div>
                <strong className="block text-sm text-gray-900">
                  직접 그리기
                </strong>
                <span className="text-xs leading-5 text-gray-500">
                  하단 도구에서 도형, 메모, 텍스트와 연결선을 선택합니다.
                </span>
              </div>
            </li>
            <li className="flex gap-3 rounded-xl bg-gray-50 p-3">
              <LayoutTemplate className="mt-0.5 text-violet-500" size={18} />
              <div>
                <strong className="block text-sm text-gray-900">
                  템플릿 적용
                </strong>
                <span className="text-xs leading-5 text-gray-500">
                  플로차트, 마인드맵 등 준비된 구성을 선택합니다.
                </span>
              </div>
            </li>
            <li className="flex gap-3 rounded-xl bg-gray-50 p-3">
              <MousePointer2 className="mt-0.5 text-violet-500" size={18} />
              <div>
                <strong className="block text-sm text-gray-900">
                  편집과 저장
                </strong>
                <span className="text-xs leading-5 text-gray-500">
                  요소를 선택해 편집하고 File 메뉴에서 작업을 내보냅니다.
                </span>
              </div>
            </li>
          </ol>
        )}

        <a
          href="https://github.com/gook-lab/pig-ma"
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-violet-600"
        >
          <Github size={17} aria-hidden="true" />
          GitHub에서 프로젝트 보기
        </a>
      </section>
    </>
  );
}
