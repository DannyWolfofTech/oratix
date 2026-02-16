import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Monitor, Globe } from "lucide-react";

const Auth = () => {
  const { user, loading, signIn, signUp } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);

    if (isSignUp) {
      const { error } = await signUp(email, password);
      if (error) setError(error.message);
      else setMessage(t("checkEmail"));
    } else {
      const { error } = await signIn(email, password);
      if (error) setError(error.message);
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      {/* Language toggle */}
      <button
        onClick={() => setLang(lang === "ro" ? "en" : "ro")}
        className="fixed top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-muted-foreground hover:text-foreground text-xs font-medium transition-colors"
      >
        <Globe className="w-3.5 h-3.5" />
        {lang === "ro" ? "EN" : "RO"}
      </button>

      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-1 glow-green">
            <Monitor className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{t("appName")}</h1>
          <p className="text-muted-foreground text-sm">
            {isSignUp ? t("createAccount") : t("signInToAccount")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            placeholder={t("email")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-secondary/60 border-border h-11"
          />
          <Input
            type="password"
            placeholder={t("password")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="bg-secondary/60 border-border h-11"
          />
          {error && <p className="text-destructive text-sm">{error}</p>}
          {message && <p className="text-primary text-sm">{message}</p>}
          <Button type="submit" className="w-full h-11 font-semibold text-sm" disabled={submitting}>
            {submitting ? "..." : isSignUp ? t("signUp") : t("signIn")}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {isSignUp ? t("alreadyHaveAccount") : t("dontHaveAccount")}{" "}
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(""); setMessage(""); }}
            className="text-primary hover:underline font-medium"
          >
            {isSignUp ? t("signIn") : t("signUp")}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Auth;
