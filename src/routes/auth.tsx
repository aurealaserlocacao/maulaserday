import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Laser Day Pro" },
      { name: "description", content: "Acesse a agenda da sua clínica." },
      { property: "og:title", content: "Entrar — Laser Day Pro" },
      { property: "og:description", content: "Acesse a agenda da sua clínica." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setLoading(false);
      if (error) return toast.error(error.message.includes("Invalid") ? "E-mail ou senha incorretos." : "Não foi possível entrar. Tente novamente.");
      navigate({ to: "/inicio", replace: true });
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/redefinir-senha` });
      setLoading(false);
      if (error) return toast.error("Não foi possível enviar o e-mail. Tente novamente em instantes.");
      setSent(true);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-blush px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-7 shadow-soft">
        <div className="mb-6 flex items-center gap-2 text-primary">
          <Sparkles className="h-5 w-5" />
          <span className="font-display text-xl">Laser Day Pro</span>
        </div>
        <h1 className="text-2xl">{mode === "login" ? "Entrar" : "Esqueci minha senha"}</h1>
        {sent ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">Se houver uma conta para {email}, você receberá um e-mail com o link para criar uma nova senha.</p>
            <Button variant="outline" className="w-full" onClick={() => { setSent(false); setMode("login"); }}>Voltar ao login</Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {mode === "login" && (
              <div className="space-y-1.5">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "login" ? "Entrar" : "Enviar link"}
            </Button>
            <button type="button" className="w-full text-center text-sm text-primary hover:underline" onClick={() => setMode(mode === "login" ? "forgot" : "login")}>
              {mode === "login" ? "Esqueci minha senha" : "Voltar ao login"}
            </button>
          </form>
        )}
        <p className="mt-6 text-xs text-muted-foreground">O acesso é liberado por convite enviado ao seu e-mail.</p>
      </div>
    </div>
  );
}
