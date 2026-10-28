import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, CalendarHeart, ShieldCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Laser Day Pro — Agenda para clínicas de laser" },
      { name: "description", content: "Agenda, clientes, financeiro e termos para clínicas que realizam Laser Day." },
      { property: "og:title", content: "Laser Day Pro" },
      { property: "og:description", content: "Agenda e gestão simples para o seu Laser Day." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/inicio", replace: true });
      else setChecking(false);
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-blush">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-10">
        <header className="flex items-center gap-2 text-primary">
          <Sparkles className="h-5 w-5" />
          <span className="font-display text-xl">Laser Day Pro</span>
        </header>
        <main className="flex flex-1 flex-col justify-center py-16">
          <h1 className="max-w-2xl text-4xl leading-tight text-foreground md:text-6xl">Seu Laser Day organizado, do agendamento ao pagamento.</h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            Agenda, clientes, confirmações por WhatsApp e financeiro em um só lugar — feito para clínicas parceiras.
          </p>
          <div className="mt-8">
            <Button asChild size="lg" disabled={checking}>
              <Link to="/auth">Entrar</Link>
            </Button>
            <p className="mt-3 text-sm text-muted-foreground">Acesso por convite da locadora.</p>
          </div>
          <div className="mt-16 grid gap-4 sm:grid-cols-3">
            {[
              { i: CalendarHeart, t: "Agenda sem conflitos", d: "Dia, semana e lista, com bloqueios." },
              { i: Wallet, t: "Financeiro real", d: "Somente valores recebidos contam como receita." },
              { i: ShieldCheck, t: "Dados isolados", d: "Cada clínica vê apenas os próprios dados." },
            ].map(({ i: Icon, t, d }) => (
              <div key={t} className="rounded-2xl border bg-card/80 p-5 shadow-soft">
                <Icon className="h-5 w-5 text-primary" />
                <p className="mt-3 font-semibold">{t}</p>
                <p className="text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
