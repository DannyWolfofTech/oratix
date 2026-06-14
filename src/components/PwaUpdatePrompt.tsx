import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { toast } from "sonner";
import { useLanguage } from "@/hooks/useLanguage";

/**
 * Registers the service worker and, when a new version is waiting, shows a
 * non-intrusive toast that lets the user reload on their own terms. This
 * replaces the old auto `window.location.reload()`, which could wipe an
 * in-progress recording.
 */
const PwaUpdatePrompt = () => {
  const { t } = useLanguage();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    if (!needRefresh) return;
    const id = toast(t("updateAvailable"), {
      duration: Infinity,
      action: {
        label: t("updateReload"),
        onClick: () => updateServiceWorker(true),
      },
      onDismiss: () => setNeedRefresh(false),
    });
    return () => {
      toast.dismiss(id);
    };
  }, [needRefresh, setNeedRefresh, updateServiceWorker, t]);

  return null;
};

export default PwaUpdatePrompt;
