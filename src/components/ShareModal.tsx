import { useState, useRef, useEffect } from "react";
import {
  X,
  Link2,
  Copy,
  Check,
  Globe,
  Lock,
  ChevronDown,
  Users,
  Eye,
  Edit3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { generateUUID } from "@/utils/uuid";
import { copyToClipboard } from "@/utils/clipboard";
import toast from "react-hot-toast";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AccessLevel = "private" | "anyone";
type Permission = "view" | "edit";

export function ShareModal({ isOpen, onClose }: ShareModalProps) {
  const [accessLevel, setAccessLevel] = useState<AccessLevel>("private");
  const [permission, setPermission] = useState<Permission>("view");
  const [showAccessDropdown, setShowAccessDropdown] = useState(false);
  const [showPermissionDropdown, setShowPermissionDropdown] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const linkInputRef = useRef<HTMLInputElement>(null);

  // Generate a shareable link (mock)
  const shareLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/share/${generateUUID().slice(0, 8)}`
      : "";

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCopied(false);
    }
  }, [isOpen]);

  const handleCopyLink = async () => {
    const success = await copyToClipboard(shareLink);
    if (success) {
      setCopied(true);
      toast.success("링크가 복사되었습니다");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("복사에 실패했습니다");
    }
  };

  const handleInvite = () => {
    if (!inviteEmail.trim()) return;
    // Mock invite functionality
    toast.success(`${inviteEmail}에게 초대를 보냈습니다`);
    setInviteEmail("");
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 z-[201] w-[480px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">공유</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Invite by email */}
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              사용자 초대
            </label>
            <div className="flex gap-2">
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="이메일 주소 입력"
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleInvite();
                }}
              />
              <button
                onClick={handleInvite}
                disabled={!inviteEmail.trim()}
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                  inviteEmail.trim()
                    ? "bg-violet-500 text-white hover:bg-violet-600"
                    : "cursor-not-allowed bg-gray-100 text-gray-400",
                )}
              >
                초대
              </button>
            </div>
          </div>

          {/* Access settings */}
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              액세스 권한
            </label>
            <div className="flex items-center gap-3">
              {/* Access level dropdown */}
              <div className="relative flex-1">
                <button
                  onClick={() => {
                    setShowAccessDropdown(!showAccessDropdown);
                    setShowPermissionDropdown(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border border-gray-300 px-3 py-2.5",
                    "text-sm text-gray-700 hover:bg-gray-50",
                  )}
                >
                  <div className="flex items-center gap-2">
                    {accessLevel === "private" ? (
                      <Lock size={16} className="text-gray-500" />
                    ) : (
                      <Globe size={16} className="text-green-500" />
                    )}
                    <span>
                      {accessLevel === "private"
                        ? "초대된 사용자만"
                        : "링크가 있는 모든 사용자"}
                    </span>
                  </div>
                  <ChevronDown
                    size={16}
                    className={cn(
                      "text-gray-400 transition-transform",
                      showAccessDropdown && "rotate-180",
                    )}
                  />
                </button>

                {showAccessDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowAccessDropdown(false)}
                    />
                    <div className="absolute top-full left-0 z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                      <button
                        onClick={() => {
                          setAccessLevel("private");
                          setShowAccessDropdown(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 px-3 py-2.5 text-sm hover:bg-gray-50",
                          accessLevel === "private" && "bg-violet-50",
                        )}
                      >
                        <Lock size={16} className="text-gray-500" />
                        <div className="text-left">
                          <div className="font-medium text-gray-700">
                            초대된 사용자만
                          </div>
                          <div className="text-xs text-gray-400">
                            초대받은 사용자만 액세스할 수 있습니다
                          </div>
                        </div>
                        {accessLevel === "private" && (
                          <Check
                            size={16}
                            className="ml-auto text-violet-500"
                          />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setAccessLevel("anyone");
                          setShowAccessDropdown(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 px-3 py-2.5 text-sm hover:bg-gray-50",
                          accessLevel === "anyone" && "bg-violet-50",
                        )}
                      >
                        <Globe size={16} className="text-green-500" />
                        <div className="text-left">
                          <div className="font-medium text-gray-700">
                            링크가 있는 모든 사용자
                          </div>
                          <div className="text-xs text-gray-400">
                            링크를 가진 누구나 액세스할 수 있습니다
                          </div>
                        </div>
                        {accessLevel === "anyone" && (
                          <Check
                            size={16}
                            className="ml-auto text-violet-500"
                          />
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Permission dropdown */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowPermissionDropdown(!showPermissionDropdown);
                    setShowAccessDropdown(false);
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2.5",
                    "text-sm text-gray-700 hover:bg-gray-50",
                  )}
                >
                  {permission === "view" ? (
                    <Eye size={16} className="text-gray-500" />
                  ) : (
                    <Edit3 size={16} className="text-blue-500" />
                  )}
                  <span>{permission === "view" ? "보기" : "편집"}</span>
                  <ChevronDown
                    size={16}
                    className={cn(
                      "text-gray-400 transition-transform",
                      showPermissionDropdown && "rotate-180",
                    )}
                  />
                </button>

                {showPermissionDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowPermissionDropdown(false)}
                    />
                    <div className="absolute top-full right-0 z-20 mt-1 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                      <button
                        onClick={() => {
                          setPermission("view");
                          setShowPermissionDropdown(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50",
                          permission === "view" && "bg-violet-50",
                        )}
                      >
                        <Eye size={16} className="text-gray-500" />
                        <span>보기</span>
                        {permission === "view" && (
                          <Check
                            size={16}
                            className="ml-auto text-violet-500"
                          />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setPermission("edit");
                          setShowPermissionDropdown(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50",
                          permission === "edit" && "bg-violet-50",
                        )}
                      >
                        <Edit3 size={16} className="text-blue-500" />
                        <span>편집</span>
                        {permission === "edit" && (
                          <Check
                            size={16}
                            className="ml-auto text-violet-500"
                          />
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Copy link */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              링크 복사
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2
                  size={16}
                  className="absolute top-1/2 left-3 z-10 -translate-y-1/2 text-gray-400"
                />
                <Input
                  ref={linkInputRef}
                  type="text"
                  value={shareLink}
                  readOnly
                  className="bg-gray-50 pr-3 pl-9 text-gray-600"
                  onClick={() => linkInputRef.current?.select()}
                />
              </div>
              <button
                onClick={handleCopyLink}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                  copied
                    ? "bg-green-500 text-white"
                    : "bg-violet-500 text-white hover:bg-violet-600",
                )}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? "복사됨" : "복사"}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Users size={16} />
            <span>현재 0명이 보고 있습니다</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            완료
          </button>
        </div>
      </div>
    </>
  );
}
