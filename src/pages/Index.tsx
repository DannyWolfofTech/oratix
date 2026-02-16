import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useScripts, Script } from "@/hooks/useScripts";
import { Navigate } from "react-router-dom";
import ScriptList from "@/components/ScriptList";
import ScriptEditor from "@/components/ScriptEditor";
import TeleprompterView from "@/components/TeleprompterView";
import { Button } from "@/components/ui/button";
import { LogOut, Monitor, Menu, X } from "lucide-react";
import { toast } from "sonner";

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const { scripts, isLoading, createScript, updateScript, deleteScript } = useScripts();
  const [activeScript, setActiveScript] = useState<Script | null>(null);
  const [playingContent, setPlayingContent] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  const handleCreate = async () => {
    const result = await createScript.mutateAsync({ title: "Untitled Script", content: "" });
    setActiveScript(result);
    setSidebarOpen(false);
  };

  const handleSave = async (title: string, content: string) => {
    if (!activeScript) return;
    const result = await updateScript.mutateAsync({ id: activeScript.id, title, content });
    setActiveScript(result);
    toast.success("Script saved");
  };

  const handleDelete = async (id: string) => {
    await deleteScript.mutateAsync(id);
    if (activeScript?.id === id) setActiveScript(null);
    toast.success("Script deleted");
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
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-1 text-muted-foreground hover:text-foreground">
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-bold font-mono tracking-tight">TelePrompt</h1>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground hover:text-foreground">
          <LogOut className="w-4 h-4 mr-1" />
          <span className="hidden sm:inline">Sign Out</span>
        </Button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
            lg:translate-x-0 fixed lg:relative z-20 lg:z-auto
            w-72 h-[calc(100vh-53px)] bg-background lg:bg-card/50
            border-r border-border p-4 overflow-y-auto
            transition-transform duration-200 ease-in-out
          `}
        >
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
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

        {/* Backdrop for mobile sidebar */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-background/80 z-10 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Editor */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <ScriptEditor
            script={activeScript}
            onSave={handleSave}
            onPlay={handlePlay}
            isSaving={updateScript.isPending}
          />
        </main>
      </div>
    </div>
  );
};

export default Index;
