import {
  Component,
  type CSSProperties,
  type ErrorInfo,
  type ReactNode,
} from "react";

/**
 * 렌더 에러 격리.
 *
 * 캔버스 앱은 상태를 localStorage 에 persist 하므로, 특정 상태가 렌더 에러를
 * 유발하면 **새로고침해도 같은 에러가 재발한다**(독성 상태). 그래서 폴백 UI 는
 * 단순 안내가 아니라 탈출 경로를 제공한다:
 *   1) 백업 다운로드 — 초기화 전에 데이터를 파일로 건져낸다
 *   2) 저장 상태 초기화 후 새로고침 — 독성 상태를 버린다
 *   3) 그냥 새로고침 — 일시적 오류였다면 이것으로 충분
 */

const PERSIST_KEY = "canvas-app";

const BUTTON_BASE: CSSProperties = {
  width: "100%",
  padding: "10px 16px",
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: "inherit",
};

const S: Record<string, CSSProperties> = {
  backdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 10000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    background: "rgba(17, 24, 39, 0.95)",
    fontFamily:
      "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: 448,
    boxSizing: "border-box",
    background: "#ffffff",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
  },
  title: { margin: 0, fontSize: 18, fontWeight: 600, color: "#111827" },
  body: { margin: "8px 0 0", fontSize: 14, lineHeight: 1.5, color: "#4b5563" },
  pre: {
    margin: "12px 0 0",
    maxHeight: 128,
    overflow: "auto",
    background: "#f3f4f6",
    borderRadius: 8,
    padding: 12,
    fontSize: 11,
    color: "#374151",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  actions: {
    marginTop: 20,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  secondary: {
    ...BUTTON_BASE,
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#374151",
  },
  danger: {
    ...BUTTON_BASE,
    border: "1px solid #dc2626",
    background: "#dc2626",
    color: "#ffffff",
  },
};

interface Props {
  children: ReactNode;
  /** 폴백을 커스터마이즈하려는 소비자용 (없으면 기본 복구 UI) */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  error: Error | null;
}

/** persist 된 원본 상태를 .pigma 파일로 건져낸다 (스토어가 죽어 있어도 동작) */
function downloadRawBackup(): void {
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as {
      state?: {
        pages?: unknown[];
        projectName?: string;
        currentPageId?: string;
      };
    };
    const state = parsed.state ?? {};
    const file = {
      type: "pigma",
      version: 1,
      exportedAt: new Date().toISOString(),
      projectName: state.projectName ?? "recovered",
      pages: state.pages ?? [],
      currentPageId: state.currentPageId ?? "",
    };
    const blob = new Blob([JSON.stringify(file, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${file.projectName}-recovered.pigma`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    // 백업 실패해도 초기화 경로는 막지 않는다
  }
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[pig-ma] render error:", error, info.componentStack);
    this.props.onError?.(error, info);
  }

  private reset = () => {
    this.setState({ error: null });
  };

  private resetPersistedState = () => {
    try {
      localStorage.removeItem(PERSIST_KEY);
    } catch {
      // 스토리지 접근 실패 시에도 새로고침은 시도
    }
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);

    // 인라인 스타일 — 폴백 UI 는 앱 CSS(Tailwind 빌드/스타일시트 로드)에
    // 의존하면 안 된다. 스타일 파이프라인 자체가 고장난 상황에서도, 그리고
    // styles.css 를 import 하지 않은 라이브러리 소비자에게도 읽혀야 한다.
    return (
      <div style={S.backdrop} role="alertdialog" aria-modal="true">
        <div style={S.card}>
          <h2 style={S.title}>Something went wrong</h2>
          <p style={S.body}>
            The canvas hit an unexpected error. Save a backup before resetting —
            a reset clears the locally stored board.
          </p>
          <pre style={S.pre}>{error.message}</pre>

          <div style={S.actions}>
            <button style={S.secondary} onClick={downloadRawBackup}>
              Save a backup (.pigma)
            </button>
            <button
              style={S.secondary}
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
            <button style={S.danger} onClick={this.resetPersistedState}>
              Reset saved board and reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
