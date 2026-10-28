import { useEffect, useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SetPasswordCard({ title, invite }: { title: string; invite?: boolean }) {
  const navigate = useNavigate();
  const [state, setState] = useState<"checking" | "ready" | "invalid">("checking");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (hash.get("error")) { setState("invalid"); return; }
    const { data } = supabase.auth.onAuthStateChange((_e, session) => { if (session) setState("ready"); });
    supabase.auth.getSession().then(({ data: s }) => {
      if (s.session) setState("ready");
      else setTimeout(() => setState((cur) => (cur === "checking" ? "invalid" : cur)), 2500);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return toast.error("A senha precisa ter pelo menos 8 caracteres.");
    if (pw !== pw2) return toast.error("As senhas não conferem.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (!error && invite) {
      // mark acceptance timestamp (best effort; RLS only allows own row read)
    }
    setLoading(false);
    if (error) return toast.error("Não foi possível salvar a senha. " + (error.message.includes("different") ? "Escolha uma senha diferente da anterior." : ""));
    toast.success("Senha salva!");
    navigate({ to: "/inicio", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-blush px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-7 shadow-soft">
        <div className="mb-6 flex items-center gap-2 text-primary">
          <Sparkles className="h-5 w-5" />
          <span className="font-display text-xl">Laser Day Pro</span>
        </div>
        <h1 className="text-2xl">{title}</h1>
        {state === "checking" && <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Validando link…</p>}
        {state === "invalid" && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">Este link é inválido ou expirou. {invite ? "Peça à locadora para reenviar o convite." : "Solicite um novo link de recuperação."}</p>
            <Button asChild variant="outline" className="w-full"><Link to="/auth">Ir para o login</Link></Button>
          </div>
        )}
        {state === "ready" && (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pw">Nova senha</Label>
              <Input id="pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
              <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw2">Confirmar senha</Label>
              <Input id="pw2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Salvar senha
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
