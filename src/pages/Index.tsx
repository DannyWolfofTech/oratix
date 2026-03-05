import { useState } from "react";
import { useScripts, Script } from "@/hooks/useScripts";
import { useLanguage } from "@/hooks/useLanguage";
import { useIsMobile } from "@/hooks/use-mobile";
import ScriptList from "@/components/ScriptList";
import ScriptEditor from "@/components/ScriptEditor";
import TeleprompterView from "@/components/TeleprompterView";
import AboutDialog from "@/components/AboutDialog";
import { Clapperboard, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const Index = () => {
  const { scripts, isLoading, createScript, updateScript, deleteScript } = useScripts();
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const [activeScript, setActiveScript] = useState<Script | null>(null);
  const [playingContent, setPlayingContent] = useState<string | null>(null);

  const handleCreate = () => {
    const result = createScript(t("untitledScript"), "");
    setActiveScript(result);
  };

  const handleSave = (title: string, content: string) => {
    if (!activeScript) return;
    const result = updateScript(activeScript.id, title, content);
    if (result) setActiveScript(result);
    toast.success(t("scriptSaved"));
  };

  const handleDelete = (id: string) => {
    deleteScript(id);
    if (activeScript?.id === id) setActiveScript(null);
    toast.success(t("scriptDeleted"));
  };

  const handleSelect = (script: Script) => {
    setActiveScript(script);
  };

  const handlePlay = () => {
    if (activeScript?.content) setPlayingContent(activeScript.content);
  };

  if (playingContent) {
    return <TeleprompterView content={playingContent} onClose={() => setPlayingContent(null)} />;
  }

  // Mobile: show either list or editor, not both
  const showListOnMobile = isMobile && !activeScript;
  const showEditorOnMobile = isMobile && !!activeScript;

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          {showEditorOnMobile && (
            <button
              onClick={() => setActiveScript(null)}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
              <Clapperboard className="w-4 h-4 text-foreground" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">{t("appName")}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AboutDialog />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar: always visible on desktop, full-screen on mobile when no script selected */}
        {(!isMobile || showListOnMobile) && (
          <aside className={`${isMobile ? "flex-1" : "w-72 border-r border-border"} bg-background p-4 overflow-y-auto`}>
            {isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t("loading")}</p>
            ) : (
              <ScriptList
                scripts={scripts}
                activeId={activeScript?.id ?? null}
                onSelect={handleSelect}
                onDelete={handleDelete}
                onCreate={handleCreate}
              />
            )}
          </aside>
        )}

        {/* Editor: always visible on desktop, full-screen on mobile when script selected */}
        {(!isMobile || showEditorOnMobile) && (
          <main className="flex-1 flex flex-col overflow-hidden">
            <ScriptEditor
              script={activeScript}
              onSave={handleSave}
              onPlay={handlePlay}
              isSaving={false}
            />
          </main>
        )}
      </div>
    </div>
  );
};

export default Index;
