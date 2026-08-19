import {
  useState,
  useEffect,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
import { cn } from "@/lib/utils";

export interface MentionUser {
  id: string;
  label: string;
  avatar?: string;
  color?: string;
}

// Default users — can be customized via store
const DEFAULT_USERS: MentionUser[] = [
  { id: "user-me", label: "Me", color: "#ff5a5f" },
  { id: "user-1", label: "Alice", color: "#3b82f6" },
  { id: "user-2", label: "Bob", color: "#10b981" },
  { id: "user-3", label: "Charlie", color: "#f59e0b" },
  { id: "user-4", label: "Diana", color: "#8b5cf6" },
  { id: "user-5", label: "Eve", color: "#ec4899" },
];

export interface MentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface MentionListProps {
  items: MentionUser[];
  command: (item: { id: string; label: string }) => void;
}

export const MentionList = forwardRef<MentionListRef, MentionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (item) {
          command({ id: item.id, label: item.label });
        }
      },
      [items, command],
    );

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === "ArrowUp") {
          setSelectedIndex((prev) => (prev <= 0 ? items.length - 1 : prev - 1));
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((prev) => (prev >= items.length - 1 ? 0 : prev + 1));
          return true;
        }
        if (event.key === "Enter") {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="popover-enter rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-400 shadow-lg">
          No results
        </div>
      );
    }

    return (
      <div className="popover-enter flex flex-col gap-0.5 rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
        {items.map((item, index) => (
          <button
            key={item.id}
            onClick={() => selectItem(index)}
            className={cn(
              "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
              index === selectedIndex
                ? "bg-violet-50 text-violet-900"
                : "text-gray-700 hover:bg-gray-50",
            )}
          >
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ backgroundColor: item.color ?? "#6b7280" }}
            >
              {item.label[0]?.toUpperCase()}
            </span>
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    );
  },
);

MentionList.displayName = "MentionList";

/** Filter users by query */
export function filterUsers(
  query: string,
  users: MentionUser[] = DEFAULT_USERS,
): MentionUser[] {
  const lower = query.toLowerCase();
  return users.filter((user) => user.label.toLowerCase().includes(lower));
}

export { DEFAULT_USERS };
