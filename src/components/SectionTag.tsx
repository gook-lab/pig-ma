import { memo, useRef, useEffect, useState } from "react";
import { Group, Rect, Text } from "react-konva";
import type Konva from "konva";
import { fontStack } from "@/constants/fonts";

interface SectionTagProps {
  name: string;
  x: number;
  y: number;
  zoom: number;
  color?: string; // 태그 배경색
}

export const SectionTag = memo(function SectionTag({
  name,
  x,
  y,
  zoom,
  color = "#374151", // 기본 회색
}: SectionTagProps) {
  const textRef = useRef<Konva.Text>(null);
  const [textWidth, setTextWidth] = useState(0);

  const fontSize = 12 / zoom;
  const paddingX = 10 / zoom;
  const paddingY = 4 / zoom;
  const height = fontSize + paddingY * 2;
  const cornerRadius = 4 / zoom;

  // 텍스트 실제 너비 측정
  useEffect(() => {
    if (textRef.current) {
      setTextWidth(textRef.current.width());
    }
  }, [name, fontSize]);

  const width = textWidth + paddingX * 2;

  return (
    <Group x={x} y={y}>
      {/* 태그 배경 */}
      <Rect
        width={Math.max(width, 40 / zoom)} // 최소 너비
        height={height}
        fill={color}
        cornerRadius={cornerRadius}
      />

      {/* 태그 텍스트 */}
      <Text
        ref={textRef}
        x={paddingX}
        y={paddingY}
        text={name}
        fontSize={fontSize}
        fill="#ffffff"
        fontFamily={fontStack()}
      />
    </Group>
  );
});
