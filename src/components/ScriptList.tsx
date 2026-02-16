import { Script } from "@/hooks/useScripts";
import { FileText, Trash2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

interface ScriptListProps {
  scripts: Script[];
  activeId: string | null;
  onSelect: (script: Script) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
}

const ScriptList = ({ scripts, activeId, onSelect, onDelete, onCreate }: ScriptListProps) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Scripts</h2>
        <Button size="sm" variant="outline" onClick={onCreate} className="text-xs">
          + New
        </Button>
      </div>
      {scripts.length === 0 && (
        <p className="text-muted-foreground text-sm text-center py-8">No scripts yet. Create one to get started.</p>
      )}
      {scripts.map((script) => (
        <button
          key={script.id}
          onClick={() => onSelect(script)}
          className={`w-full text-left p-3 rounded-lg border transition-all group ${
            activeId === script.id
              ? "bg-primary/10 border-primary/30"
              : "bg-secondary/50 border-border hover:border-primary/20"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0">
              <FileText className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{script.title || "Untitled"}</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <Clock className="w-3 h-3" />
                  <span>{formatDistanceToNow(new Date(script.updated_at), { addSuffix: true })}</span>
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
