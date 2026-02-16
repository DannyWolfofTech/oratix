import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type Lang = "ro" | "en";

const translations = {
  ro: {
    // Auth
    appName: "TelePrompt",
    createAccount: "Creează-ți contul",
    signInToAccount: "Conectează-te la contul tău",
    email: "Email",
    password: "Parolă",
    signIn: "Conectare",
    signUp: "Înregistrare",
    signingIn: "Se conectează...",
    alreadyHaveAccount: "Ai deja un cont?",
    dontHaveAccount: "Nu ai cont?",
    checkEmail: "Verifică-ți emailul pentru linkul de confirmare.",
    signOut: "Deconectare",

    // Script list
    scripts: "Scripturi",
    newScript: "+ Nou",
    noScripts: "Niciun script încă. Creează unul pentru a începe.",
    untitledScript: "Script fără titlu",

    // Editor
    selectOrCreate: "Selectează sau creează un script pentru a începe editarea.",
    scriptTitle: "Titlul scriptului...",
    save: "Salvează",
    play: "Redare",
    pasteOrType: "Lipește sau scrie scriptul tău aici...",
    scriptSaved: "Script salvat",
    scriptDeleted: "Script șters",

    // Teleprompter
    speed: "Viteză",
    size: "Mărime",
    voiceOn: "Voce ON",
    voicePace: "Ritm vocal",
    adaptingSpeed: "Se adaptează viteza la vocea ta…",
    voiceCommands: "Comenzi vocale",
    voiceCommandsHint: "Spune 'Start', 'Stop' sau 'Restart'",
    mobileHint: "Atinge pentru a arăta controalele · Comenzi vocale: Start / Stop / Restart",
    desktopHint: "Spațiu redare/pauză · ↑↓ viteză · Scroll · Esc ieșire · Vocal: Start/Stop/Restart",

    // General
    loading: "Se încarcă...",
    language: "Limbă",
  },
  en: {
    appName: "TelePrompt",
    createAccount: "Create your account",
    signInToAccount: "Sign in to your account",
    email: "Email",
    password: "Password",
    signIn: "Sign In",
    signUp: "Sign Up",
    signingIn: "Signing in...",
    alreadyHaveAccount: "Already have an account?",
    dontHaveAccount: "Don't have an account?",
    checkEmail: "Check your email for a confirmation link.",
    signOut: "Sign Out",

    scripts: "Scripts",
    newScript: "+ New",
    noScripts: "No scripts yet. Create one to get started.",
    untitledScript: "Untitled Script",

    selectOrCreate: "Select or create a script to begin editing.",
    scriptTitle: "Script title...",
    save: "Save",
    play: "Play",
    pasteOrType: "Paste or type your script here...",
    scriptSaved: "Script saved",
    scriptDeleted: "Script deleted",

    speed: "Speed",
    size: "Size",
    voiceOn: "Voice ON",
    voicePace: "Voice Pace",
    adaptingSpeed: "Adapting speed to your voice…",
    voiceCommands: "Voice Commands",
    voiceCommandsHint: "Say 'Start', 'Stop' or 'Restart'",
    mobileHint: "Tap to show controls · Voice: Start / Stop / Restart",
    desktopHint: "Space play/pause · ↑↓ speed · Scroll wheel · Esc exit · Voice: Start/Stop/Restart",

    loading: "Loading...",
    language: "Language",
  },
} as const;

export type TranslationKey = keyof typeof translations.ro;

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem("teleprompt-lang");
    return (saved === "en" || saved === "ro") ? saved : "ro";
  });

  const handleSetLang = useCallback((newLang: Lang) => {
    setLang(newLang);
    localStorage.setItem("teleprompt-lang", newLang);
  }, []);

  const t = useCallback((key: TranslationKey) => {
    return translations[lang][key] || translations.ro[key] || key;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang: handleSetLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
};
