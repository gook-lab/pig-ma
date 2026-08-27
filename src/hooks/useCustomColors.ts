import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "pig-ma-custom-colors";
const MAX_COLORS = 8;

/**
 * 최근 사용한 커스텀 색상을 관리하는 훅
 * - localStorage에 저장하여 세션 간 유지
 * - 최대 8개까지 저장
 * - 중복 색상은 맨 앞으로 이동
 */
/** localStorage 에 저장된 색상 목록 (없거나 손상되면 빈 배열) */
function readStoredColors(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export function useCustomColors() {
  // 이펙트에서 setState 로 초기값을 채우면 첫 렌더가 항상 빈 목록으로 한 번
  // 낭비된다 — lazy initializer 로 첫 렌더부터 저장된 값을 쓴다.
  const [customColors, setCustomColors] = useState<string[]>(readStoredColors);

  // 색상 추가 — 업데이터는 다음 상태만 돌려준다.
  // localStorage 쓰기를 업데이터 안에 두면 안 된다: React 는 업데이터를 두 번
  // 이상 실행할 수 있어서 저장이 중복되거나 버려진 값이 디스크에 남는다.
  const addCustomColor = useCallback((color: string) => {
    setCustomColors((prev) => {
      // 이미 있으면 제거 (맨 앞으로 이동하기 위해)
      const filtered = prev.filter(
        (c) => c.toLowerCase() !== color.toLowerCase(),
      );
      // 맨 앞에 추가
      return [color.toLowerCase(), ...filtered].slice(0, MAX_COLORS);
    });
  }, []);

  // 저장은 상태가 확정된 뒤에 한 번만 한다
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customColors));
    } catch {
      // 저장 실패 무시 (사파리 프라이빗 모드 등)
    }
  }, [customColors]);

  // 팔레트에 없는 색상인지 확인하고 추가
  const addIfCustom = useCallback(
    (color: string, paletteColors: string[]) => {
      const normalizedColor = color.toLowerCase();
      const normalizedPalette = paletteColors.map((c) => c.toLowerCase());

      if (!normalizedPalette.includes(normalizedColor)) {
        addCustomColor(color);
      }
    },
    [addCustomColor],
  );

  return {
    customColors,
    addCustomColor,
    addIfCustom,
  };
}

// 전역 인스턴스 (컴포넌트 간 공유)
let globalCustomColors: string[] = [];
const listeners: Set<(colors: string[]) => void> = new Set();

function loadFromStorage(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // 파싱 실패
  }
  return [];
}

function saveToStorage(colors: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
  } catch {
    // 저장 실패 무시
  }
}

// 초기 로드
if (typeof window !== "undefined") {
  globalCustomColors = loadFromStorage();
}

/**
 * 커스텀 색상 관리 (전역 싱글톤)
 */
export const customColorManager = {
  getColors: () => globalCustomColors,

  addColor: (color: string) => {
    const normalized = color.toLowerCase();
    const filtered = globalCustomColors.filter((c) => c !== normalized);
    globalCustomColors = [normalized, ...filtered].slice(0, MAX_COLORS);
    saveToStorage(globalCustomColors);
    listeners.forEach((listener) => listener(globalCustomColors));
  },

  addIfNotInPalette: (color: string, paletteColors: string[]) => {
    const normalized = color.toLowerCase();
    const normalizedPalette = paletteColors.map((c) => c.toLowerCase());
    if (!normalizedPalette.includes(normalized)) {
      customColorManager.addColor(color);
    }
  },

  subscribe: (listener: (colors: string[]) => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/**
 * 전역 커스텀 색상을 사용하는 훅
 */
export function useGlobalCustomColors() {
  // 구독 전 초기값도 매니저에서 직접 읽는다 (이펙트 setState 로 한 번 더
  // 렌더하지 않도록).
  const [colors, setColors] = useState<string[]>(() =>
    customColorManager.getColors(),
  );

  useEffect(() => customColorManager.subscribe(setColors), []);

  return {
    customColors: colors,
    addCustomColor: customColorManager.addColor,
    addIfNotInPalette: customColorManager.addIfNotInPalette,
  };
}
