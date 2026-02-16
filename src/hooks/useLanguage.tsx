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
    loading: "Se incarca...",
    language: "Limba",
    about: "Despre",
    aboutTitle: "Despre TelePrompt",
    aboutDescription: "TelePrompt este un teleprompter profesional direct in browser, creat pentru prezentatori, creatori de continut si oratori.",
    aboutFeature1Title: "Derulare automata",
    aboutFeature1Desc: "Textul se deruleaza automat cu viteza ajustabila de la 1x la 10x, in incrementi de 0.5.",
    aboutFeature2Title: "Comenzi vocale",
    aboutFeature2Desc: "Spune 'Start', 'Stop' sau 'Restart' pentru control hands-free. Suporta romana si engleza.",
    aboutFeature3Title: "Ritm vocal",
    aboutFeature3Desc: "Activeaza microfonul si teleprompterul isi adapteaza viteza la ritmul tau de vorbire.",
    aboutFeature4Title: "Oglindire text",
    aboutFeature4Desc: "Oglindeste textul orizontal pentru utilizarea cu oglinzi fizice sau prompter hardware.",
    aboutFeature5Title: "Inregistrare camera",
    aboutFeature5Desc: "Inregistreaza-te cu camera frontala in timp ce citesti. Videoclipurile se salveaza direct pe dispozitiv.",
    aboutFeature6Title: "Bilingv",
    aboutFeature6Desc: "Interfata completa in romana si engleza, cu comutare rapida.",
    aboutHowTitle: "Cum functioneaza",
    aboutHow1: "1. Creaza sau lipeste un script in editor",
    aboutHow2: "2. Apasa butonul de Redare pentru a porni teleprompterul",
    aboutHow3: "3. Ajusteaza viteza si marimea textului dupa preferinte",
    aboutHow4: "4. Foloseste comenzi vocale sau microfonul pentru control hands-free",
    aboutHow5: "5. Optional: porneste camera pentru a te inregistra citind",
    close: "Inchide",
    record: "Inregistreaza",
    recording: "Inregistrare...",
    stopRecording: "Opreste",
    recordingSaved: "Inregistrare salvata!",
    recordingError: "Eroare la inregistrare",
    cameraNotAvailable: "Camera nu este disponibila",
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
    about: "About",
    aboutTitle: "About TelePrompt",
    aboutDescription: "TelePrompt is a professional browser-based teleprompter built for presenters, content creators, and speakers.",
    aboutFeature1Title: "Auto-scroll",
    aboutFeature1Desc: "Text scrolls automatically with adjustable speed from 1x to 10x, in 0.5 increments.",
    aboutFeature2Title: "Voice Commands",
    aboutFeature2Desc: "Say 'Start', 'Stop' or 'Restart' for hands-free control. Supports Romanian and English.",
    aboutFeature3Title: "Voice Pacing",
    aboutFeature3Desc: "Enable the microphone and the teleprompter adapts its speed to your speaking pace.",
    aboutFeature4Title: "Mirror Text",
    aboutFeature4Desc: "Flip text horizontally for use with physical mirrors or hardware prompters.",
    aboutFeature5Title: "Camera Recording",
    aboutFeature5Desc: "Record yourself with the front camera while reading. Videos save directly to your device.",
    aboutFeature6Title: "Bilingual",
    aboutFeature6Desc: "Full interface in Romanian and English, with quick switching.",
    aboutHowTitle: "How it works",
    aboutHow1: "1. Create or paste a script in the editor",
    aboutHow2: "2. Press the Play button to start the teleprompter",
    aboutHow3: "3. Adjust speed and text size to your preference",
    aboutHow4: "4. Use voice commands or the microphone for hands-free control",
    aboutHow5: "5. Optional: start the camera to record yourself reading",
    close: "Close",
    record: "Record",
    recording: "Recording...",
    stopRecording: "Stop",
    recordingSaved: "Recording saved!",
    recordingError: "Recording error",
    cameraNotAvailable: "Camera not available",
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
