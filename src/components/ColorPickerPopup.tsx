import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface ColorPickerPopupProps {
  currentColor: string;
  onApply: (color: string) => void;
  onClose: () => void;
}

/**
 * 커스텀 컬러 피커 팝업
 * - 네이티브 색상 피커 (스포이드)
 * - Hex 입력 (예: #ff3333, ff3333)
 * - RGB 입력 (예: 255, 51, 51)
 * - "적용" 버튼으로 확정
 */
export function ColorPickerPopup({
  currentColor,
  onApply,
  onClose,
}: ColorPickerPopupProps) {
  const [color, setColor] = useState(currentColor);
  const [hexInput, setHexInput] = useState(currentColor.replace("#", ""));
  const [rgbInput, setRgbInput] = useState("");
  const colorInputRef = useRef<HTMLInputElement>(null);

  // 초기값 설정
  useEffect(() => {
    setColor(currentColor);
    setHexInput(currentColor.replace("#", ""));
    setRgbInput(hexToRgbString(currentColor));
  }, [currentColor]);

  // Hex to RGB string
  function hexToRgbString(hex: string): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
    }
    return "";
  }

  // RGB string to Hex
  function rgbStringToHex(rgb: string): string | null {
    const parts = rgb.split(",").map((s) => parseInt(s.trim(), 10));
    if (
      parts.length === 3 &&
      parts.every((n) => !isNaN(n) && n >= 0 && n <= 255)
    ) {
      return `#${parts.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
    }
    return null;
  }

  // Validate and normalize hex input
  function normalizeHex(input: string): string | null {
    const cleaned = input.replace(/^#/, "").toLowerCase();
    // 3자리 hex 지원 (f33 -> ff3333)
    if (/^[0-9a-f]{3}$/.test(cleaned)) {
      return `#${cleaned[0]}${cleaned[0]}${cleaned[1]}${cleaned[1]}${cleaned[2]}${cleaned[2]}`;
    }
    // 6자리 hex
    if (/^[0-9a-f]{6}$/.test(cleaned)) {
      return `#${cleaned}`;
    }
    return null;
  }

  // 색상 피커 변경
  const handleColorPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    setColor(newColor);
    setHexInput(newColor.replace("#", ""));
    setRgbInput(hexToRgbString(newColor));
  };

  // Hex 입력 변경
  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setHexInput(value);
    const normalized = normalizeHex(value);
    if (normalized) {
      setColor(normalized);
      setRgbInput(hexToRgbString(normalized));
    }
  };

  // RGB 입력 변경
  const handleRgbChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setRgbInput(value);
    const hex = rgbStringToHex(value);
    if (hex) {
      setColor(hex);
      setHexInput(hex.replace("#", ""));
    }
  };

  // 적용 버튼
  const handleApply = () => {
    onApply(color);
    onClose();
  };

  // Enter 키로 적용
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleApply();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div
      className="rounded-lg bg-gray-800 p-3 shadow-lg"
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* 색상 미리보기 + 네이티브 피커 */}
      <div className="mb-3 flex items-center gap-3">
        <label className="relative cursor-pointer">
          <div
            className="h-10 w-10 rounded-lg border-2 border-gray-600"
            style={{ backgroundColor: color }}
          />
          <input
            ref={colorInputRef}
            type="color"
            value={color}
            onChange={handleColorPickerChange}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <div className="flex-1">
          <div className="text-xs text-gray-400">스포이드로 선택</div>
          <div className="text-sm text-white">{color.toUpperCase()}</div>
        </div>
      </div>

      {/* Hex 입력 */}
      <div className="mb-2">
        <label className="mb-1 block text-xs text-gray-400">Hex</label>
        <div className="flex items-center gap-1">
          <span className="text-gray-500">#</span>
          <input
            type="text"
            value={hexInput}
            onChange={handleHexChange}
            onKeyDown={handleKeyDown}
            placeholder="ff3333"
            maxLength={6}
            className="w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm text-white placeholder-gray-500 focus:border-violet-500 focus:outline-none"
          />
        </div>
      </div>

      {/* RGB 입력 */}
      <div className="mb-3">
        <label className="mb-1 block text-xs text-gray-400">RGB</label>
        <input
          type="text"
          value={rgbInput}
          onChange={handleRgbChange}
          onKeyDown={handleKeyDown}
          placeholder="255, 51, 51"
          className="w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm text-white placeholder-gray-500 focus:border-violet-500 focus:outline-none"
        />
      </div>

      {/* 버튼 */}
      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded px-3 py-1.5 text-sm text-gray-300 transition-colors hover:bg-gray-700"
        >
          취소
        </button>
        <button
          onClick={handleApply}
          className="rounded bg-violet-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-violet-700"
        >
          적용
        </button>
      </div>
    </div>
  );
}

/**
 * 커스텀 컬러 버튼 (레인보우 그라디언트)
 */
interface CustomColorButtonProps {
  onClick: () => void;
  isActive?: boolean;
  className?: string;
}

export function CustomColorButton({
  onClick,
  isActive,
  className,
}: CustomColorButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-6 w-6 rounded-full border-2 transition-transform hover:scale-105",
        isActive ? "border-white" : "border-gray-600 hover:border-gray-400",
        className,
      )}
      style={{
        background:
          "conic-gradient(from 0deg, #ff0000, #ff8000, #ffff00, #80ff00, #00ff00, #00ff80, #00ffff, #0080ff, #0000ff, #8000ff, #ff00ff, #ff0080, #ff0000)",
      }}
      title="커스텀 색상"
    />
  );
}
