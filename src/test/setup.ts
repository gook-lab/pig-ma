/**
 * Node 환경용 최소 브라우저 스텁.
 *
 * 스토어가 zustand persist 로 localStorage 를 직접 쓰기 때문에,
 * jsdom 전체를 띄우지 않고 필요한 것만 채운다.
 */

class MemoryStorage implements Storage {
  private map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
}

if (typeof globalThis.localStorage === "undefined") {
  Object.defineProperty(globalThis, "localStorage", {
    value: new MemoryStorage(),
    writable: true,
  });
}

// 캔버스 객체가 id 생성에 쓴다
if (typeof globalThis.crypto === "undefined") {
  // Node 18+ 에는 있지만 방어적으로
  Object.defineProperty(globalThis, "crypto", {
    value: { randomUUID: () => Math.random().toString(36).slice(2) },
  });
}
