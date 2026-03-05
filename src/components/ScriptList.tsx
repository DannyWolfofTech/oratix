import { Script } from "@/hooks/useScripts";
import { AlignLeft, Trash2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { ro, enUS } from "date-fns/locale";
import { useLanguage } from "@/hooks/useLanguage";

interface ScriptListProps {
  scripts: Script[];
  activeId: string | null;
  onSelect: (script: Script) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
}

const ScriptList = ({ scripts, activeId, onSelect, onDelete, onCreate }: ScriptListProps) => {
  const { t, lang } = useLanguage();
  const dateLocale = lang === "ro" ? ro : enUS;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{t("scripts")}</h2>
        <Button size="sm" variant="outline" onClick={onCreate} className="text-xs h-8">
          {t("newScript")}
        </Button>
      </div>
      {scripts.length === 0 && (
        <p className="text-muted-foreground text-sm text-center py-8">{t("noScripts")}</p>
      )}
      {scripts.map((script) => (
        <button
          key={script.id}
          onClick={() => onSelect(script)}
          className={`w-full text-left p-3 rounded-lg border transition-all group ${
            activeId === script.id
              ? "bg-secondary/80 border-border text-foreground"
              : "bg-transparent border-transparent hover:bg-secondary/40 hover:border-border"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5 min-w-0">
              <AlignLeft className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{script.title || t("untitledScript")}</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <Clock className="w-3 h-3" />
                  <span>{formatDistanceToNow(new Date(script.updated_at), { addSuffix: true, locale: dateLocale })}</span>
                </div>
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(script.id); }}
              className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </button>
      ))}
    </div>
  );
};

export default ScriptList;
