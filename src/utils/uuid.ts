/**
 * UUID 생성 유틸리티
 * crypto.randomUUID()는 HTTPS/localhost에서만 동작하므로
 * HTTP에서도 동작하는 폴백 제공
 */
export function generateUUID(): string {
  // secure context에서는 crypto.randomUUID 사용
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  // 폴백: crypto.getRandomValues 사용 (더 넓은 호환성)
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r =
        (crypto.getRandomValues(new Uint8Array(1))[0]! & 15) >>
        (c === "x" ? 0 : 2);
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // 최후의 폴백: Math.random (권장하지 않지만 동작은 함)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
