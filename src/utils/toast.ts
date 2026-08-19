import { toast as hotToast } from "react-hot-toast";
import { CustomToast } from "@/components/shared/CustomToast";
import { createElement } from "react";

type ToastType = "success" | "error" | "warning";

interface CustomToastOptions {
  title?: string;
  message: string;
  duration?: number;
  id?: string;
}

const showCustomToast = (
  type: ToastType,
  { title, message, duration = 2000, id }: CustomToastOptions,
) => {
  if (id) {
    hotToast.dismiss(id);
  }

  return hotToast.custom(
    (t) =>
      createElement(CustomToast, {
        t,
        type,
        title,
        message,
      }),
    {
      duration,
      id: id || undefined,
      position: "bottom-center",
    },
  );
};

const toast = {
  success: (opts: CustomToastOptions) => showCustomToast("success", opts),
  error: (opts: CustomToastOptions) => showCustomToast("error", opts),
  warning: (opts: CustomToastOptions) => showCustomToast("warning", opts),
  dismiss: hotToast.dismiss,
};

export default toast;
