/**
 * 클립보드 유틸리티
 * navigator.clipboard는 HTTPS/localhost에서만 동작하므로
 * HTTP에서도 동작하는 폴백 제공
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // secure context에서는 navigator.clipboard 사용
  if (
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 폴백으로 진행
    }
  }

  // 폴백: execCommand 사용 (deprecated but works in HTTP)
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const success = document.execCommand("copy");
    document.body.removeChild(textArea);
    return success;
  } catch {
    return false;
  }
}
