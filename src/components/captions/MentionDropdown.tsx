import { cn } from "@/lib/utils";
import type { MentionUser } from "@/components/tiptap/MentionList";

interface MentionDropdownProps {
  users: MentionUser[];
  selectedIndex: number;
  position: { top: number; left: number };
  above?: boolean;
  onSelect: (user: MentionUser) => void;
}

export function MentionDropdown({
  users,
  selectedIndex,
  position,
  above = false,
  onSelect,
}: MentionDropdownProps) {
  if (users.length === 0) return null;

  return (
    <div
      className="popover-enter fixed z-[300] flex max-h-48 flex-col gap-0.5 overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg"
      style={{
        left: position.left,
        ...(above
          ? { bottom: window.innerHeight - position.top, top: "auto" }
          : { top: position.top }),
      }}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {users.map((user, index) => (
        <button
          key={user.id}
          onClick={() => onSelect(user)}
          className={cn(
            "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
            index === selectedIndex
              ? "bg-violet-50 text-violet-900"
              : "text-gray-700 hover:bg-gray-50",
          )}
        >
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ backgroundColor: user.color ?? "#6b7280" }}
          >
            {user.label[0]?.toUpperCase()}
          </span>
          <span className="font-medium">{user.label}</span>
        </button>
      ))}
    </div>
  );
}
