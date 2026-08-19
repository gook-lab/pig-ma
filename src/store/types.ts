import type { StateCreator } from "zustand";
import type { CanvasStore } from "@/types";

/**
 * Zustand Slice Creator 타입
 * 각 slice에서 사용하는 공통 타입
 */
export type SliceCreator<T> = StateCreator<CanvasStore, [], [], T>;

/**
 * Slice에서 사용하는 set/get 타입
 */
export type SliceSet = Parameters<SliceCreator<unknown>>[0];
export type SliceGet = Parameters<SliceCreator<unknown>>[1];
