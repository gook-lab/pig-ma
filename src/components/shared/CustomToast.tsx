import { cn } from "@/lib/utils";
import { type Toast } from "react-hot-toast";
import { CircleX, TriangleAlert, CircleCheck } from "lucide-react";

type ToastType = "success" | "error" | "warning";

interface CustomToastProps {
  t: Toast;
  type: ToastType;
  title?: string;
  message: string;
}

export function CustomToast({
  t,
  type = "success",
  message,
}: Readonly<CustomToastProps>) {
  const getToastStyles = () => {
    switch (type) {
      case "error":
        return {
          icon: <CircleX className="h-[22px] w-[22px] text-red-400" />,
          containerClass: "border-red-400 bg-red-950 text-red-400",
        };
      case "warning":
        return {
          icon: <TriangleAlert className="h-[22px] w-[22px] text-amber-400" />,
          containerClass: "border-amber-400 bg-amber-950 text-amber-400",
        };
      case "success":
      default:
        return {
          icon: <CircleCheck className="h-[22px] w-[22px] text-emerald-400" />,
          containerClass: "border-emerald-400 bg-emerald-950 text-emerald-400",
        };
    }
  };

  const { icon, containerClass } = getToastStyles();

  return (
    <div
      className={cn(
        "pointer-events-auto flex rounded-xl border-[1.5px] shadow-lg transition-all",
        t.visible
          ? "animate-in fade-in slide-in-from-bottom-4"
          : "animate-out fade-out slide-out-to-bottom-4",
        containerClass,
      )}
    >
      <section className="w-full p-3">
        <p className="flex items-center justify-start gap-3 text-sm font-semibold">
          {icon}
          <span>{message}</span>
        </p>
      </section>
    </div>
  );
}
