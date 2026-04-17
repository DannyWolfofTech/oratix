import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/hooks/useLanguage";
import { useVersionCheck } from "@/hooks/useVersionCheck";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { BrowserRouter, Routes, Route } from "react-router-dom";

const TranslationWarning = () => {
  const [translated, setTranslated] = useState(false);

  useEffect(() => {
    const detect = () => {
      const html = document.documentElement;
      const body = document.body;
      const isTranslated =
        html.className.includes("translated-") ||
        body.className.includes("translated-") ||
        !!document.querySelector('.goog-te-banner-frame, [class*="goog-te-"], font[style*="vertical-align"]');
      setTranslated(isTranslated);
    };
    detect();
    const observer = new MutationObserver(detect);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "lang"] });
    observer.observe(document.body, { attributes: true, childList: true, attributeFilter: ["class"] });
    const interval = window.setInterval(detect, 2000);
    return () => {
      observer.disconnect();
      window.clearInterval(interval);
    };
  }, []);

  if (!translated) return null;

  return (
    <div
      translate="no"
      className="notranslate fixed top-0 inset-x-0 z-[9999] bg-destructive text-destructive-foreground px-4 py-3 text-center text-sm font-medium shadow-lg"
    >
      ⚠️ Te rugăm să dezactivezi Google Translate pentru ca înregistrarea să funcționeze corect.
    </div>
  );
};

const AppInner = () => {
  useVersionCheck();
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

const App = () => (
  <LanguageProvider>
    <TooltipProvider>
      <div translate="no" className="notranslate">
        <TranslationWarning />
        <Toaster />
        <Sonner />
        <AppInner />
      </div>
    </TooltipProvider>
  </LanguageProvider>
);

export default App;
