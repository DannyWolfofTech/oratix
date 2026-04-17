import { useState } from "react";
import { Download, X, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

export const InstallPrompt = () => {
  const { canShow, isIos, promptInstall, dismiss } = useInstallPrompt();
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
            Instalează Oratix pe ecranul tău
          </Button>
          <Button
            onClick={dismiss}
            size="icon"
            variant="ghost"
            className="rounded-full shrink-0"
            aria-label="Închide"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={showIosHelp} onOpenChange={setShowIosHelp}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Instalează Oratix pe iPhone</DialogTitle>
            <DialogDescription>
              Urmează acești pași în Safari pentru a adăuga Oratix pe ecranul de start:
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm text-foreground">
            <li className="flex items-start gap-3">
              <span className="font-semibold">1.</span>
              <span className="flex items-center gap-2">
                Apasă butonul <Share className="inline h-4 w-4" /> <strong>Partajează</strong> din bara Safari.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="font-semibold">2.</span>
              <span>Selectează <strong>„Adaugă la ecran principal”</strong>.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="font-semibold">3.</span>
              <span>Confirmă apăsând <strong>„Adaugă”</strong>.</span>
            </li>
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
};
