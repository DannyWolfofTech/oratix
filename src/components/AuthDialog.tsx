import { useState } from "react";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { LogIn, LogOut, MailCheck, Cloud } from "lucide-react";

const AuthDialog = () => {
  const { t } = useLanguage();
  const { user, isConfigured, signInWithEmail, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // No backend configured → no sign-in entry point.
  if (!isConfigured) return null;

  const handleSend = async () => {
    if (!email.trim()) return;
    setSending(true);
    try {
      await signInWithEmail(email.trim());
      setSent(true);
      toast.success(t("magicLinkSent"));
    } catch (error) {
      console.error("[Auth] sign-in failed", error);
      toast.error(t("authError"));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog onOpenChange={(open) => !open && setSent(false)}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
          {user ? <Cloud className="w-4 h-4 mr-1 text-green-500" /> : <LogIn className="w-4 h-4 mr-1" />}
          <span className="hidden sm:inline">{user ? t("syncedAccount") : t("signIn")}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("signInTitle")}</DialogTitle>
          <DialogDescription>{t("signInDesc")}</DialogDescription>
        </DialogHeader>

        {user ? (
          <div className="flex flex-col gap-4 pt-2">
            <p className="text-sm text-muted-foreground">
              {t("syncedAccount")}: <span className="font-medium text-foreground">{user.email}</span>
            </p>
            <Button onClick={() => signOut()} variant="outline" className="w-full gap-2">
              <LogOut className="w-4 h-4" />
              {t("signOut")}
            </Button>
          </div>
        ) : sent ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <MailCheck className="w-10 h-10 text-green-500" />
            <p className="text-sm text-muted-foreground">{t("magicLinkSent")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pt-2">
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder={t("email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
            />
            <Button onClick={handleSend} disabled={sending || !email.trim()} className="w-full gap-2">
              <LogIn className="w-4 h-4" />
              {sending ? t("signingIn") : t("sendMagicLink")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AuthDialog;
