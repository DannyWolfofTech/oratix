import { useLanguage } from "@/hooks/useLanguage";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Info, Zap, Mic, Activity, FlipHorizontal2, Video, Globe } from "lucide-react";

const features = [
  { icon: Zap, titleKey: "aboutFeature1Title", descKey: "aboutFeature1Desc" },
  { icon: Mic, titleKey: "aboutFeature2Title", descKey: "aboutFeature2Desc" },
  { icon: Activity, titleKey: "aboutFeature3Title", descKey: "aboutFeature3Desc" },
  { icon: FlipHorizontal2, titleKey: "aboutFeature4Title", descKey: "aboutFeature4Desc" },
  { icon: Video, titleKey: "aboutFeature5Title", descKey: "aboutFeature5Desc" },
  { icon: Globe, titleKey: "aboutFeature6Title", descKey: "aboutFeature6Desc" },
] as const;

const AboutDialog = () => {
  const { t } = useLanguage();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
          <Info className="w-4 h-4 mr-1" />
          <span className="hidden sm:inline">{t("about")}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{t("aboutTitle")}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">{t("aboutDescription")}</p>

        <div className="grid gap-3 mt-4">
          {features.map(({ icon: Icon, titleKey, descKey }) => (
            <div key={titleKey} className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="w-4 h-4 text-foreground" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">{t(titleKey as any)}</h3>
                <p className="text-xs text-muted-foreground">{t(descKey as any)}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 pt-4 border-t border-border">
          <h3 className="text-sm font-semibold mb-2">{t("aboutHowTitle")}</h3>
          <div className="space-y-1">
            {(["aboutHow1", "aboutHow2", "aboutHow3", "aboutHow4", "aboutHow5"] as const).map((key) => (
              <p key={key} className="text-xs text-muted-foreground">{t(key as any)}</p>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AboutDialog;
