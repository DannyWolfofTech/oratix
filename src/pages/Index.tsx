import { useState } from "react";
import { useScripts, Script } from "@/hooks/useScripts";
import { useLanguage } from "@/hooks/useLanguage";
import ScriptList from "@/components/ScriptList";
import ScriptEditor from "@/components/ScriptEditor";
import TeleprompterView from "@/components/TeleprompterView";
import AboutDialog from "@/components/AboutDialog";
import { Monitor, Menu, X, Globe } from "lucide-react";
import { toast } from "sonner";

const Index = () => {
  const { scripts, isLoading, createScript, updateScript, deleteScript } = useScripts();
  const { t, lang, setLang } = useLanguage();
  const [activeScript, setActiveScript] = useState<Script | null>(null);
  const [playingContent, setPlayingContent] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleCreate = () => {
    const result = createScript(t("untitledScript"), "");
    setActiveScript(result);
    setSidebarOpen(false);
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
    setSidebarOpen(false);
  };

  const handlePlay = () => {
    if (activeScript?.content) setPlayingContent(activeScript.content);
  };

  if (playingContent) {
    return <TeleprompterView content={playingContent} onClose={() => setPlayingContent(null)} />;
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-1.5 text-muted-foreground hover:text-foreground transition-colors">
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Monitor className="w-4 h-4 text-primary" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">{t("appName")}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AboutDialog />
          <button
            onClick={() => setLang(lang === "ro" ? "en" : "ro")}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-muted-foreground hover:text-foreground text-xs font-medium transition-colors"
          >
            <Globe className="w-3.5 h-3.5" />
            {lang === "ro" ? "EN" : "RO"}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside
          className={`
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
            lg:translate-x-0 fixed lg:relative z-20 lg:z-auto
            w-72 h-[calc(100vh-53px)] bg-background lg:bg-card/30
            border-r border-border p-4 overflow-y-auto
            transition-transform duration-200 ease-in-out
          `}
        >
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

        {sidebarOpen && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-10 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        <main className="flex-1 flex flex-col overflow-hidden">
          <ScriptEditor
            script={activeScript}
            onSave={handleSave}
            onPlay={handlePlay}
            isSaving={false}
          />
        </main>
      </div>
    </div>
  );
};

export default Index;
