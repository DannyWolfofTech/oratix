import { useState } from "react";
import { Download, X, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { useLanguage } from "@/hooks/useLanguage";

export const InstallPrompt = () => {
  const { canShow, isIos, promptInstall, dismiss } = useInstallPrompt();
  const { t } = useLanguage();
  const [showIosHelp, setShowIosHelp] = useState(false);

  if (!canShow) return null;

  const handleClick = async () => {
    if (isIos) {
      setShowIosHelp(true);
      return;
    }
    await promptInstall();
  };

  return (
    <>
      <div className="fixed bottom-4 inset-x-4 z-[100] flex justify-center pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-background/95 backdrop-blur px-2 py-2 shadow-lg max-w-md w-full">
          <Button
            onClick={handleClick}
            size="sm"
            className="flex-1 rounded-full"
          >
            <Download className="h-4 w-4" />
            {t("installCta")}
          </Button>
          <Button
            onClick={dismiss}
            size="icon"
            variant="ghost"
            className="rounded-full shrink-0"
            aria-label={t("installClose")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={showIosHelp} onOpenChange={setShowIosHelp}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("installIosTitle")}</DialogTitle>
            <DialogDescription>{t("installIosDesc")}</DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm text-foreground">
            <li className="flex items-start gap-3">
              <span className="font-semibold">1.</span>
              <span className="flex items-center gap-2">
                <Share className="inline h-4 w-4 shrink-0" /> {t("installIosStep1")}
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="font-semibold">2.</span>
              <span>{t("installIosStep2")}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="font-semibold">3.</span>
              <span>{t("installIosStep3")}</span>
            </li>
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
};
