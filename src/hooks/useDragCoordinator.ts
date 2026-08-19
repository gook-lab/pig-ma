/**
 * DragCoordinator - React state를 우회하여 드래그 중 위치 관리
 *
 * 드래그 중에는 store 업데이트 없이 Konva 레벨에서만 렌더링.
 * Connector가 shape 드래그를 직접 구독하여 실시간으로 따라감.
 */

import type Konva from "konva";

export interface DragPosition {
  x: number;
  y: number;
}

export interface ResizeSize {
  width: number;
  height: number;
}

type PositionCallback = (pos: DragPosition | null) => void;

class DragCoordinator {
  private positions = new Map<string, DragPosition>();
  private listeners = new Map<string, Set<PositionCallback>>();
  private drawScheduled = false;
  private layerRef: Konva.Layer | null = null;

  /**
   * Connector 레이어 설정 (배치 드로우용)
   */
  setLayer(layer: Konva.Layer | null): void {
    this.layerRef = layer;
  }

  /**
   * requestAnimationFrame으로 batchDraw 스케줄링
   * 여러 Connector가 동시에 업데이트되어도 한 번만 그리기
   */
  scheduleDraw(): void {
    if (this.drawScheduled || !this.layerRef) return;
    this.drawScheduled = true;
    requestAnimationFrame(() => {
      this.layerRef?.batchDraw();
      this.drawScheduled = false;
    });
  }

  /**
   * 드래그 위치 업데이트 (React state 업데이트 없이)
   * 모든 구독자에게 즉시 알림
   */
  setPosition(id: string, x: number, y: number): void {
    const pos = { x, y };
    this.positions.set(id, pos);
    // 구독자들에게 직접 알림 (Connector 등)
    this.listeners.get(id)?.forEach((cb) => cb(pos));
  }

  /**
   * 현재 드래그 위치 조회
   * 드래그 중이 아니면 undefined 반환
   */
  getPosition(id: string): DragPosition | undefined {
    return this.positions.get(id);
  }

  /**
   * 객체가 현재 드래그 중인지 확인
   */
  isDragging(id: string): boolean {
    return this.positions.has(id);
  }

  /**
   * 특정 객체의 드래그 위치 변경을 구독
   * Connector가 연결된 shape의 위치를 추적할 때 사용
   *
   * @returns unsubscribe 함수
   */
  subscribe(id: string, callback: PositionCallback): () => void {
    if (!this.listeners.has(id)) {
      this.listeners.set(id, new Set());
    }
    this.listeners.get(id)!.add(callback);

    // Unsubscribe 함수 반환
    return () => {
      this.listeners.get(id)?.delete(callback);
      // 리스너가 비었으면 정리
      if (this.listeners.get(id)?.size === 0) {
        this.listeners.delete(id);
      }
    };
  }

  /**
   * 드래그 종료 시 호출
   * 위치 데이터 제거 후 구독자들에게 null 알림 (리스너는 유지)
   */
  clear(id: string): void {
    this.positions.delete(id);
    // 구독자들에게 드래그 종료 알림 (null로 전달하여 라이브 위치 리셋)
    this.listeners.get(id)?.forEach((cb) => cb(null));
  }

  /**
   * 모든 드래그 상태 초기화
   */
  clearAll(): void {
    this.positions.clear();
  }
}

// 싱글톤 인스턴스 export
export const dragCoordinator = new DragCoordinator();

/**
 * ResizeCoordinator - 리사이즈 중 크기 관리
 *
 * Transformer 리사이즈 중에는 store 업데이트 없이 크기 변경 추적.
 * HTML overlay가 리사이즈를 실시간으로 반영할 수 있도록 함.
 */

type SizeCallback = (size: ResizeSize | null) => void;

class ResizeCoordinator {
  private sizes = new Map<string, ResizeSize>();
  private listeners = new Map<string, Set<SizeCallback>>();

  /**
   * 리사이즈 크기 업데이트
   */
  setSize(id: string, width: number, height: number): void {
    const size = { width, height };
    this.sizes.set(id, size);
    this.listeners.get(id)?.forEach((cb) => cb(size));
  }

  /**
   * 현재 리사이즈 크기 조회
   */
  getSize(id: string): ResizeSize | undefined {
    return this.sizes.get(id);
  }

  /**
   * 객체가 현재 리사이즈 중인지 확인
   */
  isResizing(id: string): boolean {
    return this.sizes.has(id);
  }

  /**
   * 리사이즈 크기 변경 구독
   */
  subscribe(id: string, callback: SizeCallback): () => void {
    if (!this.listeners.has(id)) {
      this.listeners.set(id, new Set());
    }
    this.listeners.get(id)!.add(callback);

    return () => {
      this.listeners.get(id)?.delete(callback);
      if (this.listeners.get(id)?.size === 0) {
        this.listeners.delete(id);
      }
    };
  }

  /**
   * 리사이즈 종료 시 호출
   */
  clear(id: string): void {
    this.sizes.delete(id);
    this.listeners.get(id)?.forEach((cb) => cb(null));
  }

  /**
   * 모든 리사이즈 상태 초기화
   */
  clearAll(): void {
    this.sizes.clear();
  }
}

export const resizeCoordinator = new ResizeCoordinator();
