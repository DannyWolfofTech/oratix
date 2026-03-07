import { createContext, useContext, useCallback, ReactNode } from "react";

const translations = {
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
  scripts: "Scripturi",
  newScript: "+ Nou",
  noScripts: "Niciun script încă. Creează unul pentru a începe.",
  untitledScript: "Script fără titlu",
  selectOrCreate: "Selectează sau creează un script pentru a începe editarea.",
  scriptTitle: "Titlul scriptului...",
  save: "Salvează",
  play: "Redare",
  pasteOrType: "Lipește sau scrie scriptul tău aici...",
  scriptSaved: "Script salvat",
  scriptDeleted: "Script șters",
  speed: "Viteză",
  size: "Mărime",
  voiceOn: "Voce ON",
  voicePace: "Ritm vocal",
  adaptingSpeed: "Se adaptează viteza la vocea ta…",
  voiceCommands: "Comenzi vocale",
  voiceCommandsHint: "Spune 'Start', 'Stop' sau 'Restart'",
  mobileHint: "Atinge pentru a arăta controalele · Comenzi vocale: Start / Stop / Restart",
  desktopHint: "Spațiu redare/pauză · ↑↓ viteză · Scroll · Esc ieșire · Vocal: Start/Stop/Restart",
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
  stopRecording: "Oprește Înregistrarea",
  recordingSaved: "Inregistrare salvata!",
  saving: "Se salveaza...",
  recordingError: "Eroare la inregistrare",
  cameraNotAvailable: "Camera nu este disponibila",
  startRecordAndScroll: "Inregistreaza si deruleaza",
  backToTop: "Inapoi sus",
  togglePreview: "Comuta previzualizarea",
  openCamera: "Deschide Camera",
  closeCamera: "Închide Camera",
  startRecording: "Începe Înregistrarea",
  cornerView: "Colț",
  fullscreenView: "Ecran complet",
  inAppBrowserWarning: "Browserul Facebook/Messenger poate bloca salvarea video. Te rugăm să deschizi în Chrome sau Safari pentru cea mai bună experiență.",
  textColor: "Culoare",
  colorWhite: "Alb",
  colorRed: "Roșu",
  colorBlue: "Albastru",
} as const;

export type TranslationKey = keyof typeof translations;

interface LanguageContextType {
  lang: "ro";
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const t = useCallback((key: TranslationKey) => {
    return translations[key] || key;
  }, []);

  return (
    <LanguageContext.Provider value={{ lang: "ro", t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
};
