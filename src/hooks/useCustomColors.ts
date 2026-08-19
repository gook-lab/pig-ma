import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "pig-ma-custom-colors";
const MAX_COLORS = 8;

/**
 * 최근 사용한 커스텀 색상을 관리하는 훅
 * - localStorage에 저장하여 세션 간 유지
 * - 최대 8개까지 저장
 * - 중복 색상은 맨 앞으로 이동
 */
export function useCustomColors() {
  const [customColors, setCustomColors] = useState<string[]>([]);

  // 초기 로드
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setCustomColors(parsed);
        }
      }
    } catch {
      // 파싱 실패 시 빈 배열 유지
    }
  }, []);

  // 색상 추가
  const addCustomColor = useCallback((color: string) => {
    setCustomColors((prev) => {
      // 이미 있으면 제거 (맨 앞으로 이동하기 위해)
      const filtered = prev.filter(
        (c) => c.toLowerCase() !== color.toLowerCase(),
      );
      // 맨 앞에 추가
      const updated = [color.toLowerCase(), ...filtered].slice(0, MAX_COLORS);
      // localStorage에 저장
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // 저장 실패 무시
      }
      return updated;
    });
  }, []);

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
let listeners: Set<(colors: string[]) => void> = new Set();

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
  const [colors, setColors] = useState<string[]>(globalCustomColors);

  useEffect(() => {
    // 초기값 동기화
    setColors(customColorManager.getColors());
    // 변경 구독
    return customColorManager.subscribe(setColors);
  }, []);

  return {
    customColors: colors,
    addCustomColor: customColorManager.addColor,
    addIfNotInPalette: customColorManager.addIfNotInPalette,
  };
}
