import { useState, useEffect } from "react";
import { Script } from "@/hooks/useScripts";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save, Play } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

interface ScriptEditorProps {
  script: Script | null;
  onSave: (title: string, content: string) => void;
  onPlay: () => void;
  isSaving: boolean;
}

const ScriptEditor = ({ script, onSave, onPlay, isSaving }: ScriptEditorProps) => {
  const { t } = useLanguage();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    if (script) {
      setTitle(script.title);
      setContent(script.content);
    }
    // Only re-sync when the user switches to a different script (by id).
    // Omitting script.title / script.content is intentional: including them would
    // reset the editor fields on every external save, discarding unsaved edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script?.id]);

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    const defaultTitle = t("untitledScript");
    if (!title || title === defaultTitle) {
      const firstLine = newContent.split("\n").find((line) => line.trim() !== "");
      if (firstLine) {
        setTitle(firstLine.trim().slice(0, 50));
      }
    }
  };
  if (!script) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground px-6">
        <p className="text-center">{t("selectOrCreate")}</p>
      </div>
    );
  }

  const hasChanges = title !== script.title || content !== script.content;

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="flex items-center gap-2 p-4 border-b border-border">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("scriptTitle")}
          className="bg-transparent border-none text-lg font-semibold p-0 h-auto focus-visible:ring-0"
        />
        <div className="flex gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSave(title, content)}
            disabled={!hasChanges || isSaving}
            className="h-9"
          >
            <Save className="w-4 h-4 mr-1.5" />
            {t("save")}
          </Button>
          <Button size="sm" onClick={onPlay} disabled={!content.trim()} className="h-9">
            <Play className="w-4 h-4 mr-1.5" />
            {t("play")}
          </Button>
        </div>
      </div>
      <textarea
        value={content}
        onChange={(e) => handleContentChange(e.target.value)}
        placeholder={t("pasteOrType")}
        className="flex-1 w-full bg-transparent p-4 sm:p-6 text-foreground resize-none focus:outline-none text-sm leading-relaxed placeholder:text-muted-foreground"
      />
    </div>
  );
};

export default ScriptEditor;
