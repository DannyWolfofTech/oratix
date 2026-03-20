import { Script } from "@/hooks/useScripts";
import { AlignLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
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
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground">{t("scripts")}</h2>
        <Button
          onClick={onCreate}
          className="bg-foreground text-background hover:bg-foreground/80 font-bold rounded-full px-5 py-2 text-sm"
        >
          {t("newScript")}
        </Button>
      </div>
      <div className="max-h-[50vh] overflow-y-auto space-y-3 pr-1">
        {scripts.length === 0 && (
          <p className="text-base font-medium text-muted-foreground text-center py-8">{t("noScripts")}</p>
        )}
        {scripts.map((script) => (
          <button
            key={script.id}
            onClick={() => onSelect(script)}
            className={`w-full text-left p-4 rounded-xl border transition-all group ${
              activeId === script.id
                ? "bg-secondary border-border text-foreground"
                : "bg-card border-border/50 hover:bg-secondary/50 hover:border-border"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <AlignLeft className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-base font-semibold truncate">{script.title || t("untitledScript")}</p>
                  <p className="text-sm text-muted-foreground mt-1.5">
                    {format(new Date(script.updated_at), "d MMMM yyyy", { locale: dateLocale })}
                  </p>
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(script.id); }}
                className="opacity-0 group-hover:opacity-100 p-1.5 hover:text-destructive transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ScriptList;
