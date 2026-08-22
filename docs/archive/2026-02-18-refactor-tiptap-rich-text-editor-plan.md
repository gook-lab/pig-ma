---
title: Tiptap 리치 텍스트 에디터로 전면 교체
type: refactor
status: active
date: 2026-02-18
---

# Tiptap 리치 텍스트 에디터로 전면 교체

## Overview

현재 Konva 기반 리치 텍스트 시스템(TextSegment[], KonvaCursor, HiddenTextarea, RichTextRenderer)을 **Tiptap** 에디터로 전면 교체합니다.

**대상 컴포넌트**: TextBox, StickyNote, Shape의 모든 텍스트 편집
**렌더링 방식**: 항상 HTML 렌더링 (Konva Text 제거)
**목표**: 노션 스타일의 리치 텍스트 편집 경험 제공

## Problem Statement / Motivation

### 현재 시스템의 한계

1. **커서/선택 문제**: KonvaCursor의 커서 높이가 폰트 크기와 동기화되지 않음
2. **옵션바 연동 불안정**: 폰트 크기 변경 시 즉시 반영 안 됨
3. **고급 기능 부재**: 코드 블럭, 테이블, 이미지 리사이징 미지원
4. **유지보수 복잡성**: HiddenTextarea, KonvaCursor, RichTextRenderer 등 다수 컴포넌트 동기화 필요
5. **IME 처리 이슈**: 한글 입력 시 실시간 렌더링 지연

### Tiptap 선택 이유

| 기능 | Tiptap | 현재 시스템 |
|------|:------:|:----------:|
| 테이블 (행/열 추가) | ✅ 공식 확장 | ❌ |
| 코드 블럭 + 구문 강조 | ✅ StarterKit | ❌ |
| 이미지 리사이징 | ✅ 공식 지원 | ❌ |
| 들여쓰기 | ✅ 지원 | ⚠️ 공백 삽입 방식 |
| 커스텀 툴바 | ✅ 체이닝 API | ⚠️ 복잡 |
| 노션 스타일 사례 | ✅ Novel, BlockNote | ❌ |

## Proposed Solution

### 아키텍처 변경

```
[기존]
TextBox/StickyNote/Shape
    ↓
HiddenTextarea (입력) + KonvaCursor (커서) + RichTextRenderer (Konva 렌더링)
    ↓
TextSegment[] (데이터)

[변경 후]
TextBox/StickyNote/Shape
    ↓
TiptapEditor (HTML 오버레이) - 편집 시 단일 인스턴스
    ↓
Tiptap JSONContent (데이터) + generateHTML (뷰어 렌더링)
```

### 핵심 설계 결정

#### 1. 렌더링 방식: Single Editor + Lightweight Viewer

**편집 모드**: 단일 TiptapEditor 인스턴스 (성능 최적화)
**뷰 모드**: `generateHTML`로 정적 HTML 렌더링 (경량)

```tsx
// 편집 시에만 단일 TiptapEditor 인스턴스 사용
function TextEditorOverlay() {
  const editingTextId = useEditingTextId();
  const editingObject = useObject(editingTextId);

  if (!editingObject) return null;

  return (
    <div style={calculateOverlayPosition(editingObject)}>
      <TiptapEditor ... />
    </div>
  );
}

// 뷰어는 경량 HTML 렌더러로 대체
function TextViewer({ content, style }) {
  const html = useMemo(() => generateHTML(content, extensions), [content]);
  return <div dangerouslySetInnerHTML={{ __html: html }} style={style} />;
}
```

**Z-Index 동적 할당** (객체 순서 기반):
```typescript
const objectIndex = objects.findIndex(o => o.id === shape.id);
style.zIndex = 49 + objectIndex;
```

#### 2. 데이터 구조 변경

```typescript
// types.ts 추가
import { JSONContent } from '@tiptap/core'

export interface CanvasObject {
  // 마이그레이션 버전 (1 = TextSegment[], 2 = Tiptap JSONContent)
  _contentVersion?: 1 | 2

  // 기존 (deprecated, 마이그레이션 후 read-only)
  /** @deprecated Use tiptapContent instead */
  text?: string
  /** @deprecated Use tiptapContent instead. Read-only after migration. */
  richText?: TextSegment[]

  // 신규 (primary)
  tiptapContent?: JSONContent

  // 공통 유지
  fontSize?: number
  fontFamily?: FontFamily
  textAlign?: TextAlign
  textColor?: string
}
```

#### 3. Undo/Redo 전략 (개선)

- **편집 중**: Tiptap History Extension 사용 (글자 단위 Undo)
- **편집 종료 시**: Tiptap 히스토리 클리어 후 Zustand Temporal로 전환
- **편집 종료 후**: Zustand Temporal 사용 (객체 단위 Undo)

```typescript
// 편집 종료 시 히스토리 동기화
const handleBlur = useCallback(() => {
  // Tiptap 내부 히스토리 클리어
  editor?.commands.clearHistory?.()
  setEditingTextId(null)
}, [editor, setEditingTextId])

// Undo 핸들러
const handleUndo = useCallback(() => {
  const { editingTextId, activeEditor } = useCanvasStore.getState();

  if (editingTextId && activeEditor) {
    // Tiptap 히스토리 먼저 시도
    if (activeEditor.can().undo()) {
      activeEditor.commands.undo();
      return;
    }
    // Tiptap 히스토리 없으면 편집 종료 후 Zustand undo
    setEditingTextId(null);
  }
  undo();
}, []);
```

#### 4. 이미지 저장

- base64 인코딩 (최대 500KB/이미지 제한, 자동 압축)
- localStorage 용량 검사 (5MB 초과 예상 시 경고)
- 향후 외부 스토리지 연동 옵션

```typescript
// 저장 전 용량 검사
function safeSetItem(key: string, value: string): boolean {
  try {
    const currentSize = JSON.stringify(localStorage).length
    const newSize = currentSize + value.length - (localStorage.getItem(key)?.length ?? 0)

    if (newSize > 5 * 1024 * 1024) {
      showToast('저장 공간이 부족합니다. 일부 이미지를 삭제하세요.')
      return false
    }

    localStorage.setItem(key, value)
    return true
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      showToast('저장 공간이 가득 찼습니다.')
      return false
    }
    throw e
  }
}
```

## Technical Approach

### Phase 0: 마이그레이션 사전 준비 (필수)

#### 0.1 데이터 백업/롤백 기능

**파일**: `src/utils/dataBackup.ts`

```typescript
// 전체 데이터 내보내기
export function exportAllData(): string {
  const state = useCanvasStore.getState()
  return JSON.stringify({
    version: 1,
    timestamp: new Date().toISOString(),
    objects: state.objects,
    captions: state.captions,
    groups: state.groups,
  })
}

// 마이그레이션 롤백
export function rollbackMigration(): void {
  const state = useCanvasStore.getState()
  state.objects.forEach(obj => {
    if (obj._contentVersion === 2 && obj.richText) {
      updateObject(obj.id, {
        tiptapContent: undefined,
        _contentVersion: 1
      })
    }
  })
}
```

#### 0.2 마이그레이션 검증 함수

```typescript
export function validateMigration(
  original: TextSegment[],
  migrated: JSONContent
): { valid: boolean; issues: string[] } {
  const issues: string[] = []

  // 평문 일치 검사
  const originalPlain = richTextToPlainText(original)
  const migratedPlain = tiptapToPlainText(migrated)
  if (originalPlain !== migratedPlain) {
    issues.push(`Plain text mismatch: "${originalPlain}" vs "${migratedPlain}"`)
  }

  return { valid: issues.length === 0, issues }
}
```

#### 0.3 스키마 버전 관리 (store.ts 수정)

```typescript
persist(
  (set) => ({ ... }),
  {
    name: 'canvas-app',
    version: 2, // 버전 추가
    partialize: (state) => ({
      objects: state.objects,
      viewport: state.viewport,
      // ...
    }),
    migrate: (persistedState, version) => {
      const state = persistedState as CanvasState

      if (version < 2) {
        // v1 -> v2: TextSegment to Tiptap migration
        return {
          ...state,
          objects: state.objects.map(obj => {
            if (obj.richText && !obj.tiptapContent) {
              return {
                ...obj,
                _contentVersion: 2,
                tiptapContent: textSegmentsToTiptap(
                  obj.richText,
                  obj.lineIndents
                ),
                // richText는 유지 (백업 용도)
              }
            }
            return { ...obj, _contentVersion: obj._contentVersion ?? 1 }
          }),
        }
      }

      return state
    },
  }
)
```

### Phase 1: 기반 구축 (Tiptap 설치 및 공용 모듈)

#### 1.1 패키지 설치

```bash
npm install @tiptap/react @tiptap/starter-kit \
  @tiptap/extension-table @tiptap/extension-table-row \
  @tiptap/extension-table-header @tiptap/extension-table-cell \
  @tiptap/extension-image @tiptap/extension-link \
  @tiptap/extension-text-align @tiptap/extension-font-family \
  @tiptap/extension-text-style @tiptap/extension-color \
  @tiptap/extension-code-block-lowlight lowlight
```

#### 1.2 공용 에디터 모듈 생성

**파일**: `src/components/tiptap/TiptapEditor.tsx`

```tsx
import { useEditor, EditorContent, generateHTML } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import FontFamily from '@tiptap/extension-font-family'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'

const lowlight = createLowlight(common)

// 공유 확장 설정
export const tiptapExtensions = [
  StarterKit.configure({
    codeBlock: false, // CodeBlockLowlight 사용
  }),
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell,
  Image.configure({ inline: true, allowBase64: true }),
  Link.configure({ openOnClick: false }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  FontFamily,
  TextStyle,
  Color,
  CodeBlockLowlight.configure({ lowlight }),
]

interface TiptapEditorProps {
  content: JSONContent
  onChange: (content: JSONContent) => void
  onBlur?: () => void
  editable?: boolean
  width: number
  height: number
  zoom: number
  defaultFontSize: number
  defaultFontFamily: string
  defaultTextColor: string
}

export function TiptapEditor({
  content,
  onChange,
  onBlur,
  editable = true,
  ...props
}: TiptapEditorProps) {
  const editor = useEditor({
    extensions: tiptapExtensions,
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON())
    },
    onBlur: ({ editor }) => {
      // 편집 종료 시 히스토리 클리어
      editor.commands.clearHistory()
      onBlur?.()
    },
  })

  return <EditorContent editor={editor} />
}
```

#### 1.3 경량 뷰어 (generateHTML 사용)

**파일**: `src/components/tiptap/TiptapViewer.tsx`

```tsx
import { useMemo, memo } from 'react'
import { generateHTML } from '@tiptap/react'
import { JSONContent } from '@tiptap/core'
import { tiptapExtensions } from './TiptapEditor'

interface TiptapViewerProps {
  content: JSONContent
  className?: string
}

export const TiptapViewer = memo(function TiptapViewer({
  content,
  className
}: TiptapViewerProps) {
  const html = useMemo(() => {
    if (!content || !content.content?.length) return ''
    return generateHTML(content, tiptapExtensions)
  }, [content])

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
})
```

### Phase 2: 데이터 마이그레이션

#### 2.1 TextSegment → Tiptap JSON 변환 함수 (개선)

**파일**: `src/utils/tiptapMigration.ts`

```typescript
import { JSONContent } from '@tiptap/core'
import { TextSegment } from '@/types'

export function textSegmentsToTiptap(
  segments: TextSegment[],
  lineIndents?: number[]
): JSONContent {
  // 빈 배열 또는 undefined 처리
  if (!segments || segments.length === 0) {
    return { type: 'doc', content: [] }
  }

  // 텍스트를 줄 단위로 분리
  const lines = splitByNewlines(segments)

  return {
    type: 'doc',
    content: lines.map((lineSegments, lineIndex) => ({
      type: 'paragraph',
      attrs: {
        textIndent: lineIndents?.[lineIndex] ?? 0,
      },
      content: lineSegments.length > 0
        ? lineSegments.map(seg => ({
            type: 'text',
            text: seg.text,
            marks: buildMarks(seg),
          }))
        : undefined,
    })),
  }
}

// textStyle attrs를 하나로 병합 (수정됨)
function buildMarks(seg: TextSegment): JSONContent['marks'] {
  const marks: JSONContent['marks'] = []

  if (seg.fontWeight === 'bold') {
    marks.push({ type: 'bold' })
  }
  if (seg.textDecoration === 'line-through') {
    marks.push({ type: 'strike' })
  }

  // textStyle attrs를 단일 객체로 병합
  const textStyleAttrs: Record<string, string> = {}
  if (seg.fontSize !== undefined && seg.fontSize !== null) {
    textStyleAttrs.fontSize = `${seg.fontSize}px`
  }
  if (seg.textColor !== undefined && seg.textColor !== null) {
    textStyleAttrs.color = seg.textColor
  }

  if (Object.keys(textStyleAttrs).length > 0) {
    marks.push({ type: 'textStyle', attrs: textStyleAttrs })
  }

  if (seg.link) {
    marks.push({ type: 'link', attrs: { href: seg.link } })
  }

  return marks.length > 0 ? marks : undefined
}

function splitByNewlines(segments: TextSegment[]): TextSegment[][] {
  const lines: TextSegment[][] = [[]]

  segments.forEach(seg => {
    const parts = seg.text.split('\n')
    parts.forEach((part, i) => {
      if (i > 0) lines.push([])
      if (part) {
        lines[lines.length - 1].push({ ...seg, text: part })
      }
    })
  })

  return lines
}
```

#### 2.2 Tiptap → 평문 변환 (하위 호환용)

```typescript
// 역변환 함수는 제거 - 테이블/이미지 등 Tiptap 전용 기능 손실 위험
// 대신 평문 변환만 제공

export function tiptapToPlainText(content: JSONContent): string {
  if (!content) return ''

  const texts: string[] = []

  function traverse(node: JSONContent): void {
    if (node.type === 'text' && node.text) {
      texts.push(node.text)
    } else if (node.type === 'paragraph') {
      if (texts.length > 0 && !texts[texts.length - 1].endsWith('\n')) {
        texts.push('\n')
      }
    } else if (node.type === 'hardBreak') {
      texts.push('\n')
    }
    // 테이블 셀은 탭으로 구분
    else if (node.type === 'tableCell' || node.type === 'tableHeader') {
      texts.push('\t')
    }
    // 테이블 행은 줄바꿈
    else if (node.type === 'tableRow') {
      texts.push('\n')
    }
    // 이미지는 대체 텍스트 사용
    else if (node.type === 'image') {
      texts.push(node.attrs?.alt ?? '[image]')
    }
    // 코드 블럭
    else if (node.type === 'codeBlock') {
      texts.push('\n```\n')
    }

    if (node.content) {
      node.content.forEach(traverse)
    }
  }

  traverse(content)
  return texts.join('').trim()
}
```

### Phase 3: 컴포넌트 교체

#### 3.1 TextEditorOverlay (단일 에디터 인스턴스)

**파일**: `src/components/tiptap/TextEditorOverlay.tsx`

```tsx
import { useCallback, useMemo, useEffect } from 'react'
import { TiptapEditor } from './TiptapEditor'
import { textSegmentsToTiptap, tiptapToPlainText } from '@/utils/tiptapMigration'
import { useCanvasStore } from '@/store'

export function TextEditorOverlay() {
  const {
    editingTextId,
    objects,
    viewport,
    updateObject,
    setEditingTextId,
    setActiveEditor
  } = useCanvasStore()

  const editingObject = useMemo(
    () => objects.find(o => o.id === editingTextId),
    [objects, editingTextId]
  )

  // 마이그레이션 즉시 저장 (온디맨드 → 즉시 저장으로 변경)
  useEffect(() => {
    if (editingObject?.richText && !editingObject?.tiptapContent) {
      const migrated = textSegmentsToTiptap(
        editingObject.richText,
        editingObject.lineIndents
      )
      updateObject(editingObject.id, {
        tiptapContent: migrated,
        _contentVersion: 2,
      })
    }
  }, [editingObject?.id])

  const tiptapContent = useMemo(() => {
    if (editingObject?.tiptapContent) {
      return editingObject.tiptapContent
    }
    if (editingObject?.richText) {
      return textSegmentsToTiptap(
        editingObject.richText,
        editingObject.lineIndents
      )
    }
    // text 필드만 있는 경우 (레거시)
    if (editingObject?.text) {
      return {
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: editingObject.text }]
        }]
      }
    }
    return { type: 'doc', content: [] }
  }, [editingObject])

  const handleChange = useCallback((content: JSONContent) => {
    if (!editingObject) return
    updateObject(editingObject.id, {
      tiptapContent: content,
      _contentVersion: 2,
      // 하위 호환용 평문 동기화
      text: tiptapToPlainText(content),
    })
  }, [editingObject, updateObject])

  const handleBlur = useCallback(() => {
    setActiveEditor(null)
    setEditingTextId(null)
  }, [setActiveEditor, setEditingTextId])

  if (!editingObject) return null

  // 객체 순서 기반 z-index
  const objectIndex = objects.findIndex(o => o.id === editingObject.id)

  const style: CSSProperties = {
    position: 'fixed',
    left: editingObject.x * viewport.zoom + viewport.x,
    top: editingObject.y * viewport.zoom + viewport.y,
    width: editingObject.width * viewport.zoom,
    height: editingObject.height * viewport.zoom,
    transform: `rotate(${editingObject.rotation ?? 0}deg)`,
    transformOrigin: 'top left',
    zIndex: 50 + objectIndex,
  }

  return (
    <div style={style}>
      <TiptapEditor
        content={tiptapContent}
        onChange={handleChange}
        onBlur={handleBlur}
        width={editingObject.width}
        height={editingObject.height}
        zoom={viewport.zoom}
        defaultFontSize={editingObject.fontSize ?? 10}
        defaultFontFamily={editingObject.fontFamily ?? 'Inter'}
        defaultTextColor={editingObject.textColor ?? '#1f2937'}
      />
    </div>
  )
}
```

#### 3.2 TextBox/StickyNote 수정 (렌더링)

**파일**: `src/components/shapes/TextBox.tsx`

```tsx
// Konva Text, RichTextRenderer, KonvaCursor 제거
// HTML 오버레이 렌더링으로 변경

export const TextBox = memo(function TextBox({ shape, isEditing, ...props }) {
  const { viewport, objects } = useCanvasStore()

  // 객체 순서 기반 z-index
  const objectIndex = objects.findIndex(o => o.id === shape.id)

  // 화면에 보이는지 확인 (가상화)
  const isVisible = useMemo(() => {
    return isInViewport(shape, viewport, window.innerWidth, window.innerHeight)
  }, [shape, viewport])

  // Konva Group은 위치/드래그용으로만 유지
  return (
    <>
      {/* Konva: 배경/테두리만 렌더링 */}
      <Group {...dragProps}>
        <Rect
          width={shape.width}
          height={shape.height}
          fill={shape.fill}
          stroke={shape.stroke}
          cornerRadius={4}
        />
      </Group>

      {/* HTML: 텍스트 렌더링 (편집 중이 아닐 때만) */}
      {!isEditing && isVisible && (
        <Html>
          <TextViewerOverlay
            shape={shape}
            viewport={viewport}
            zIndex={49 + objectIndex}
          />
        </Html>
      )}
    </>
  )
})
```

#### 3.3 TextViewerOverlay 컴포넌트

**파일**: `src/components/tiptap/TextViewerOverlay.tsx`

```tsx
import { useMemo, memo, CSSProperties } from 'react'
import { TiptapViewer } from './TiptapViewer'
import { textSegmentsToTiptap } from '@/utils/tiptapMigration'
import { CanvasObject, Viewport } from '@/types'

interface TextViewerOverlayProps {
  shape: CanvasObject
  viewport: Viewport
  zIndex: number
}

export const TextViewerOverlay = memo(function TextViewerOverlay({
  shape,
  viewport,
  zIndex
}: TextViewerOverlayProps) {
  const content = useMemo(() => {
    if (shape.tiptapContent) return shape.tiptapContent
    if (shape.richText) return textSegmentsToTiptap(shape.richText, shape.lineIndents)
    if (shape.text) {
      return {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: shape.text }] }]
      }
    }
    return { type: 'doc', content: [] }
  }, [shape.tiptapContent, shape.richText, shape.text, shape.lineIndents])

  const style: CSSProperties = {
    position: 'fixed',
    left: shape.x * viewport.zoom + viewport.x,
    top: shape.y * viewport.zoom + viewport.y,
    width: shape.width * viewport.zoom,
    height: shape.height * viewport.zoom,
    transform: `rotate(${shape.rotation ?? 0}deg)`,
    transformOrigin: 'top left',
    pointerEvents: 'none',
    zIndex,
    overflow: 'hidden',
  }

  return (
    <div style={style}>
      <TiptapViewer content={content} />
    </div>
  )
})
```

### Phase 4: 옵션바 연동

#### 4.1 TextOptionsBar Tiptap 연동

**파일**: `src/components/TextOptionsBar.tsx`

```tsx
interface TextOptionsBarProps {
  object: CanvasObject
  editor?: Editor | null  // Tiptap editor 인스턴스
  position: Position
  onUpdate: (updates: Partial<CanvasObject>) => void
}

export function TextOptionsBar({ object, editor, position, onUpdate }) {
  // Tiptap editor 상태 읽기
  const isBold = editor?.isActive('bold') ?? false
  const isStrike = editor?.isActive('strike') ?? false
  const currentFontSize = editor?.getAttributes('textStyle').fontSize

  const toggleBold = () => {
    editor?.chain().focus().toggleBold().run()
  }

  const toggleStrike = () => {
    editor?.chain().focus().toggleStrike().run()
  }

  const setFontSize = (size: number) => {
    editor?.chain().focus().setMark('textStyle', { fontSize: `${size}px` }).run()
  }

  const insertLink = (url: string) => {
    editor?.chain().focus().setLink({ href: url }).run()
  }

  // 노션 스타일 기능
  const insertTable = (rows: number, cols: number) => {
    editor?.chain().focus()
      .insertTable({ rows, cols, withHeaderRow: true })
      .run()
  }

  const insertCodeBlock = (language?: string) => {
    editor?.chain().focus()
      .toggleCodeBlock({ language: language ?? 'javascript' })
      .run()
  }

  const insertImage = async (file: File) => {
    const compressed = await compressImage(file, 500) // 500KB 제한
    editor?.chain().focus().setImage({ src: compressed }).run()
  }

  return (
    <div className="fixed z-50 ...">
      {/* 기존 UI 유지, 핸들러만 Tiptap 연동 */}
      <button onClick={toggleBold} className={isBold ? 'active' : ''}>
        <Bold size={14} />
      </button>
      {/* 테이블, 코드 블럭, 이미지 버튼 추가 */}
    </div>
  )
}
```

#### 4.2 신규 UI 컴포넌트

**테이블 삽입 UI**: `src/components/tiptap/TableInsertPopover.tsx`
**이미지 삽입 UI**: `src/components/tiptap/ImageInsertPopover.tsx`
**코드 블럭 언어 선택**: `src/components/tiptap/CodeBlockLanguageSelect.tsx`

### Phase 5: 정리 및 테스트

#### 5.1 제거할 파일

- `src/components/HiddenTextarea.tsx`
- `src/components/KonvaCursor.tsx`
- `src/components/RichTextRenderer.tsx`
- `src/components/KonvaTextInput.tsx`
- `src/utils/richText.ts` (마이그레이션 완료 후)

#### 5.2 수정할 파일

- `src/components/shapes/TextBox.tsx` - Konva Text 제거
- `src/components/shapes/StickyNote.tsx` - Konva Text 제거
- `src/components/shapes/Shape.tsx` - 내부 텍스트 처리
- `src/components/TextBoxEditor.tsx` - 전면 재작성
- `src/components/TextOptionsBar.tsx` - Tiptap 연동
- `src/components/ShapeOptionsBar.tsx` - Tiptap 연동
- `src/store.ts` - EditingCursorState 제거, activeEditor 추가, persist 버전 관리
- `src/types.ts` - tiptapContent, _contentVersion 필드 추가
- `src/hooks/useKeyboardShortcuts.ts` - Undo/Redo 분기 처리

#### 5.3 마이그레이션 테스트 케이스

```typescript
// __tests__/tiptapMigration.test.ts
const edgeCases = [
  { input: [], expected: { type: 'doc', content: [] } },
  { input: [{ text: '' }], expected: '...' },
  { input: [{ text: '  ' }], expected: '...' },
  { input: [{ text: '\n\n' }], expected: '...' },
  { input: [{ text: '이모지 😀🎉' }], expected: '...' },
  { input: [{ text: '한글 + English' }], expected: '...' },
  { input: [{ text: 'Bold', fontWeight: 'bold' }], expected: '...' },
  { input: [
    { text: 'Mixed', fontWeight: 'bold', fontSize: 16, textColor: '#ff0000' }
  ], expected: '...' }, // textStyle 병합 테스트
]
```

## Acceptance Criteria

### Functional Requirements

- [ ] TextBox, StickyNote, Shape 모두 Tiptap으로 편집 가능
- [ ] 드래그 선택 후 폰트/폰트크기 변경 동작
- [ ] 드래그 선택 후 볼드/취소선/링크 적용 동작
- [ ] Tab/Shift+Tab 들여쓰기 동작
- [ ] 코드 블럭 삽입 및 구문 강조 표시 (노션 스타일)
- [ ] 이미지 삽입 및 드래그 리사이징 동작 (노션 스타일)
- [ ] 테이블 삽입 및 행/열 추가/삭제 동작 (노션 스타일)
- [ ] 기존 TextSegment[] 데이터 자동 마이그레이션 (앱 로드 시)

### Non-Functional Requirements

- [ ] 100개 TextBox가 있을 때 패닝 60fps 유지
- [ ] 한글 IME 입력 실시간 렌더링
- [ ] localStorage 저장/불러오기 정상 동작
- [ ] Undo/Redo 정상 동작 (편집 중: 글자 단위, 편집 밖: 객체 단위)

### Quality Gates

- [ ] TypeScript 에러 없음
- [ ] 기존 테스트 통과 (text-editing.spec.ts 수정 필요)
- [ ] 번들 크기 증가량 < 300KB (lowlight 포함)
- [ ] 마이그레이션 테스트 100% 통과

## Dependencies & Risks

### Dependencies

| 패키지 | 버전 | 용도 |
|--------|------|------|
| @tiptap/react | ^2.x | React 통합 |
| @tiptap/starter-kit | ^2.x | 기본 확장 |
| @tiptap/extension-table | ^2.x | 테이블 (노션 스타일) |
| @tiptap/extension-image | ^2.x | 이미지 (노션 스타일) |
| @tiptap/extension-code-block-lowlight | ^2.x | 코드 블럭 (노션 스타일) |
| lowlight | ^3.x | 코드 구문 강조 |

### Risks

| 위험 | 영향 | 대응 |
|------|------|------|
| 번들 크기 증가 (~300KB) | 초기 로딩 지연 | 코드 스플리팅, 지연 로딩 |
| 비사각형 Shape 클리핑 | 텍스트 경계 노출 | CSS clip-path 또는 overflow:hidden |
| localStorage 용량 초과 | 이미지 저장 실패 | 500KB 제한 + 압축 + 경고 UI |
| 기존 데이터 손실 | 사용자 데이터 유실 | Phase 0 백업/롤백 + 검증 테스트 |
| Undo/Redo 경계 불일치 | 사용자 혼란 | 편집 종료 시 히스토리 클리어 |
| textStyle mark 중복 | 스타일 손실 | 단일 객체로 병합 (수정됨) |

## Success Metrics

- 커서/선택 관련 버그 0건
- 옵션바 반응 지연 < 50ms
- 사용자 피드백 긍정적
- 마이그레이션 데이터 손실 0건

## References & Research

### Internal References

- `src/components/TextBoxEditor.tsx` - 현재 편집 시스템
- `src/components/RichTextRenderer.tsx` - 현재 렌더링
- `src/types.ts:51-58` - TextSegment 타입
- `src/store.ts:38-45` - EditingCursorState

### External References

- [Tiptap Documentation](https://tiptap.dev/docs)
- [Novel - Notion-style Editor](https://github.com/steven-tey/novel)
- [BlockNote - Block-based Editor](https://www.blocknotejs.org/)
- [@tiptap/extension-table](https://tiptap.dev/docs/editor/extensions/nodes/table)
- [@tiptap/extension-image](https://tiptap.dev/docs/editor/extensions/nodes/image)
- [@tiptap/extension-code-block-lowlight](https://tiptap.dev/docs/editor/extensions/nodes/code-block-lowlight)

## Implementation Phases Summary

| Phase | 내용 | 핵심 작업 |
|-------|------|----------|
| **Phase 0** | 마이그레이션 사전 준비 | 백업/롤백, 검증 함수, 스키마 버전 관리 |
| **Phase 1** | 기반 구축 | Tiptap 설치, 공용 에디터/뷰어 모듈 |
| **Phase 2** | 데이터 마이그레이션 | TextSegment → Tiptap JSON 변환 (textStyle 병합) |
| **Phase 3** | 컴포넌트 교체 | Single Editor + Lightweight Viewer 패턴 |
| **Phase 4** | 옵션바 연동 | TextOptionsBar, 테이블/이미지/코드 블럭 UI |
| **Phase 5** | 정리 및 테스트 | 레거시 코드 제거, 마이그레이션 테스트 |

## Review Feedback Applied

이 플랜은 다음 리뷰 피드백을 반영했습니다:

### 데이터 무결성 (Data Integrity Guardian)
- [x] 스키마 버전 관리 추가 (`persist.version` + `migrate` 함수)
- [x] `textStyle` mark 병합 로직 수정 (fontSize + color → 단일 객체)
- [x] 역변환 함수 제거 (`tiptapToTextSegments` → `tiptapToPlainText`만 제공)
- [x] `_contentVersion` 필드 추가
- [x] localStorage 용량 검사 + 이미지 압축

### 아키텍처 (Architecture Strategist)
- [x] Single Editor 패턴 적용 (편집 시 단일 인스턴스)
- [x] 경량 뷰어 (`generateHTML` 사용)
- [x] Z-Index 동적 할당 (객체 순서 기반)
- [x] Undo/Redo 경계 조건 처리 (편집 종료 시 히스토리 클리어)
- [x] 점진적 적용 권장 (TextBox → StickyNote → Shape)

### 노션 스타일 기능 (사용자 요청)
- [x] 테이블 확장 유지
- [x] 코드 블럭 + 구문 강조 유지
- [x] 이미지 리사이징 유지
