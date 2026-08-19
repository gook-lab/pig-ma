import { useEditor, EditorContent, Editor, ReactRenderer } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { sinkListItem } from "@tiptap/pm/schema-list";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { Image } from "@tiptap/extension-image";
import { Link } from "@tiptap/extension-link";
import { TextAlign } from "@tiptap/extension-text-align";
import { FontFamily } from "@tiptap/extension-font-family";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import Mention from "@tiptap/extension-mention";
import { common, createLowlight } from "lowlight";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import { useEffect, useCallback } from "react";
import type { JSONContent } from "@tiptap/core";
import { MentionList, filterUsers, type MentionListRef } from "./MentionList";

const lowlight = createLowlight(common);

// 커스텀 FontSize 확장 - TextStyle mark에 fontSize 속성 추가
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FontSize = Extension.create({
  name: "fontSize",

  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) =>
              element.style.fontSize?.replace(/['"]+/g, ""),
            renderHTML: (attributes: Record<string, string | null>) => {
              if (!attributes.fontSize) {
                return {};
              }
              return {
                style: `font-size: ${attributes.fontSize}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ({ chain }: { chain: () => any }) => {
          return chain().setMark("textStyle", { fontSize }).run();
        },
      unsetFontSize:
        () =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ({ chain }: { chain: () => any }) => {
          return chain()
            .setMark("textStyle", { fontSize: null })
            .removeEmptyTextStyle()
            .run();
        },
    };
  },
});

// 공유 확장 설정
export const tiptapExtensions = [
  StarterKit.configure({
    codeBlock: false, // CodeBlockLowlight 사용
  }),
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell,
  Image.configure({
    inline: false,
    allowBase64: true,
    HTMLAttributes: {
      class: "tiptap-resizable-image",
    },
  }),
  Link.configure({ openOnClick: false }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  FontFamily,
  TextStyle,
  Color,
  FontSize, // 커스텀 폰트 크기 확장
  CodeBlockLowlight.configure({ lowlight }),
  Mention.configure({
    HTMLAttributes: {
      class: "mention",
    },
    suggestion: {
      items: ({ query }: { query: string }) => filterUsers(query),
      render: () => {
        let component: ReactRenderer<MentionListRef> | null = null;
        let popup: TippyInstance[] | null = null;

        return {
          onStart: (props: any) => {
            component = new ReactRenderer(MentionList, {
              props,
              editor: props.editor as Editor,
            });

            if (!props.clientRect) return;

            popup = tippy("body", {
              getReferenceClientRect: props.clientRect as () => DOMRect,
              appendTo: () => document.body,
              content: component.element,
              showOnCreate: true,
              interactive: true,
              trigger: "manual",
              placement: "bottom-start",
            });
          },

          onUpdate: (props: any) => {
            component?.updateProps(props);
            if (popup?.[0] && props.clientRect) {
              popup[0].setProps({
                getReferenceClientRect: props.clientRect as () => DOMRect,
              });
            }
          },

          onKeyDown: (props: { event: KeyboardEvent }) => {
            if (props.event.key === "Escape") {
              popup?.[0]?.hide();
              return true;
            }
            return component?.ref?.onKeyDown(props) ?? false;
          },

          onExit: () => {
            popup?.[0]?.destroy();
            component?.destroy();
          },
        };
      },
    },
  }),
];

export interface TiptapEditorProps {
  content: JSONContent;
  onChange: (content: JSONContent) => void;
  onBlur?: () => void;
  onEditorReady?: (editor: Editor) => void;
  editable?: boolean;
  className?: string;
  defaultFontSize?: number;
  defaultFontFamily?: string;
  defaultTextColor?: string;
  defaultTextAlign?: "left" | "center" | "right";
}

export function TiptapEditor({
  content,
  onChange,
  onBlur,
  onEditorReady,
  editable = true,
  className,
  defaultFontSize = 10,
  defaultFontFamily = "Pretendard",
  defaultTextColor = "#1f2937",
  defaultTextAlign = "left",
}: TiptapEditorProps) {
  const handleBlur = useCallback(() => {
    onBlur?.();
  }, [onBlur]);

  const editor = useEditor({
    extensions: tiptapExtensions,
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON());
    },
    onBlur: handleBlur,
    editorProps: {
      attributes: {
        class: "outline-none",
        style: `font-size: ${defaultFontSize}px; font-family: ${defaultFontFamily}; color: ${defaultTextColor}; text-align: ${defaultTextAlign};`,
      },
      // 키보드 처리
      handleKeyDown: (view, event) => {
        // Shift+Enter: 새 paragraph 생성 (hard break 대신)
        // 이렇게 하면 줄바꿈 후 코드블럭/리스트 적용 시 해당 줄만 적용됨
        if (event.key === "Enter" && event.shiftKey) {
          event.preventDefault();
          const { state, dispatch } = view;
          const { tr } = state;
          // 현재 위치에서 paragraph 분할
          const canSplit = tr.selection.$from.parent.type.name === "paragraph";
          if (canSplit) {
            dispatch(tr.split(tr.selection.from));
            return true;
          }
          // paragraph가 아니면 기본 동작
          return false;
        }

        // Tab 키 처리 - hard break 이후 커서에서 Tab 누를 때 특별 처리
        if (event.key === "Tab" && !event.shiftKey) {
          const { state } = view;
          const { $from } = state.selection;
          const { listItem, hardBreak } = state.schema.nodes;

          // 리스트 아이템 내부인지 확인
          let listItemDepth: number | undefined;
          for (let d = $from.depth; d > 0; d--) {
            if ($from.node(d).type === listItem) {
              listItemDepth = d;
              break;
            }
          }

          if (!listItemDepth || !hardBreak) {
            // 리스트 아이템 안이 아니면 기본 처리에 맡김
            return false;
          }

          // 커서 앞에 hardBreak가 있는지 확인 (같은 리스트 아이템 내에서)
          const listItemStart = $from.start(listItemDepth);
          const cursorPos = $from.pos;
          let hardBreakPos = -1;

          // 리스트 아이템 시작부터 커서 위치까지 순회
          state.doc.nodesBetween(listItemStart, cursorPos, (node, pos) => {
            if (node.type === hardBreak && pos < cursorPos) {
              hardBreakPos = pos;
            }
          });

          if (hardBreakPos >= 0) {
            // hardBreak 뒤의 내용을 새 리스트 아이템으로 분리
            event.preventDefault();

            // 1. hardBreak 삭제
            let tr = state.tr;
            tr = tr.delete(hardBreakPos, hardBreakPos + 1);

            // 2. 분할 위치에서 리스트 아이템 분할 (paragraph와 listItem 두 레벨)
            // hardBreak 삭제 후 위치 조정
            const splitPos = hardBreakPos;

            // paragraph 분할 후 listItem도 분할
            try {
              tr = tr.split(splitPos, 2); // depth 2: paragraph + listItem 분할
            } catch {
              // 분할 실패 시 기본 동작
              return false;
            }

            // 3. 트랜잭션 적용
            view.dispatch(tr);

            // 4. 새 리스트 아이템 sink (들여쓰기)
            // 약간의 지연 후 sink 실행 (트랜잭션 완료 후)
            setTimeout(() => {
              if (listItem) {
                const cmd = sinkListItem(listItem);
                if (cmd) cmd(view.state, view.dispatch);
              }
            }, 0);

            return true;
          }

          // hardBreak가 없으면 기본 동작 (StarterKit의 sinkListItem)
          return false;
        }
        // Shift+Tab과 다른 키는 기본 처리에 맡김
        return false;
      },
    },
  });

  // 에디터 준비 완료 시 콜백
  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  // 외부 content 동기화는 key prop으로 처리됨
  // 에디터가 마운트될 때 초기 content만 사용하고, 이후 변경은 무시

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  if (!editor) {
    return null;
  }

  // 링크, 코드, 테이블 스타일을 위한 CSS
  const editorStyles = `
    .tiptap-editor {
      line-height: 1.4;
    }
    .tiptap-editor .ProseMirror {
      line-height: 1.4;
    }
    .tiptap-editor a {
      color: #3b82f6;
      text-decoration: underline;
      cursor: text;
    }
    .tiptap-editor a:hover {
      color: #2563eb;
    }
    .tiptap-editor code {
      background-color: #f3f4f6;
      color: #e11d48;
      padding: 0.15em 0.3em;
      border-radius: 4px;
      font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
      font-size: 0.9em;
    }
    .tiptap-editor pre {
      background-color: #1e293b;
      color: #e2e8f0;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
      font-size: 0.9em;
      overflow-x: auto;
      margin: 8px 0;
    }
    .tiptap-editor pre code {
      background: none;
      color: inherit;
      padding: 0;
      font-size: inherit;
    }
    .tiptap-editor table {
      border-collapse: collapse;
      width: 100%;
      margin: 8px 0;
    }
    .tiptap-editor th,
    .tiptap-editor td {
      border: 1px solid #d1d5db;
      padding: 8px 12px;
      text-align: left;
      min-width: 50px;
    }
    .tiptap-editor th {
      background-color: #9ca3af;
      color: #ffffff;
      font-weight: 600;
    }
    .tiptap-editor td {
      background-color: #ffffff;
    }
    .tiptap-editor tr:hover td {
      background-color: #f9fafb;
    }
    .tiptap-editor img {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
      margin: 8px 0;
      display: block;
    }
    /* 리사이즈 가능한 이미지 */
    .tiptap-editor .tiptap-resizable-image {
      resize: both;
      overflow: hidden;
      min-width: 50px;
      min-height: 50px;
      cursor: default;
    }
    .tiptap-editor .tiptap-resizable-image:hover {
      outline: 2px solid #3b82f6;
      outline-offset: 2px;
    }
    .tiptap-editor .ProseMirror-selectednode img {
      outline: 2px solid #3b82f6;
      outline-offset: 2px;
    }
    /* 리스트 스타일 */
    .tiptap-editor ul {
      list-style-type: disc;
      padding-left: 1.5em;
      margin: 0.5em 0;
    }
    .tiptap-editor ol {
      list-style-type: decimal;
      padding-left: 1.5em;
      margin: 0.5em 0;
    }
    /* 중첩 리스트 들여쓰기 */
    .tiptap-editor ul ul {
      list-style-type: circle;
      margin: 0;
    }
    .tiptap-editor ul ul ul {
      list-style-type: square;
    }
    .tiptap-editor ol ol {
      list-style-type: lower-alpha;
      margin: 0;
    }
    .tiptap-editor ol ol ol {
      list-style-type: lower-roman;
    }
    .tiptap-editor ul ol,
    .tiptap-editor ol ul {
      margin: 0;
    }
    .tiptap-editor li {
      margin: 0.25em 0;
      display: list-item;
    }
    .tiptap-editor li > p {
      margin: 0;
      display: inline;
    }
    .tiptap-editor li::marker {
      color: #374151;
    }
    /* 뷰어 모드: 전체는 클릭 통과, 링크만 클릭 가능 */
    .tiptap-viewer-mode {
      pointer-events: none;
    }
    .tiptap-viewer-mode * {
      pointer-events: none;
    }
    .tiptap-viewer-mode a {
      pointer-events: auto;
      cursor: pointer;
    }
  `;

  // 뷰어 모드에서 링크 클릭 처리
  const handleViewerClick = useCallback(
    (e: React.MouseEvent) => {
      if (editable) return; // 편집 모드에서는 무시

      const target = e.target as HTMLElement;
      const link = target.closest("a");
      if (link) {
        e.preventDefault();
        e.stopPropagation();
        const href = link.getAttribute("href");
        if (href) {
          window.open(href, "_blank", "noopener,noreferrer");
        }
      }
    },
    [editable],
  );

  return (
    <>
      <style>{editorStyles}</style>
      <div onClick={handleViewerClick}>
        <EditorContent
          editor={editor}
          className={`tiptap-editor ${className ?? ""}`}
        />
      </div>
    </>
  );
}

export type { Editor, JSONContent };
