import { useState, useEffect } from "react";
import { Script } from "@/hooks/useScripts";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save, Play } from "lucide-react";

interface ScriptEditorProps {
  script: Script | null;
  onSave: (title: string, content: string) => void;
  onPlay: () => void;
  isSaving: boolean;
}

const ScriptEditor = ({ script, onSave, onPlay, isSaving }: ScriptEditorProps) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    if (script) {
      setTitle(script.title);
      setContent(script.content);
    }
  }, [script?.id]);

  if (!script) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>Select or create a script to begin editing.</p>
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
          placeholder="Script title..."
          className="bg-transparent border-none text-lg font-semibold font-mono p-0 h-auto focus-visible:ring-0"
        />
        <div className="flex gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSave(title, content)}
            disabled={!hasChanges || isSaving}
          >
            <Save className="w-4 h-4 mr-1" />
            Save
          </Button>
          <Button size="sm" onClick={onPlay} disabled={!content.trim()}>
            <Play className="w-4 h-4 mr-1" />
            Play
          </Button>
        </div>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Paste or type your script here..."
        className="flex-1 w-full bg-transparent p-4 text-foreground resize-none focus:outline-none font-mono text-sm leading-relaxed placeholder:text-muted-foreground"
      />
    </div>
  );
};

export default ScriptEditor;
