import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { AppointmentForm } from "@/components/AppointmentForm";
import { AppointmentSheet } from "@/components/AppointmentSheet";
import { useClinic } from "@/lib/session";
import { addDays, dayRange, formatDayLabel, formatTime, todayInTz } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [{ title: "Painel — Laser Day Pro" }, { name: "description", content: "Resumo do dia da clínica." }] }),
  component: Dashboard,
});

const PERIODS = [
  { v: 0, l: "Hoje" },
  { v: 7, l: "7 dias" },
  { v: 30, l: "30 dias" },
];

function Dashboard() {
  const clinic = useClinic();
  const tz = clinic.timezone;
  const today = todayInTz(tz);
  const [period, setPeriod] = useState(0);
  const [newOpen, setNewOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const from = dayRange(addDays(today, -period), tz).from;
  const to = dayRange(today, tz).to;

  const { data: stats } = useQuery({
    queryKey: ["dashboard", clinic.id, period, today],
    queryFn: async () => {
      const { data } = await supabase.from("appointments").select("status").eq("clinic_id", clinic.id).gte("starts_at", from).lt("starts_at", to);
      const c = (s: string) => data?.filter((a) => a.status === s).length ?? 0;
      return { total: data?.filter((a) => a.status !== "cancelled").length ?? 0, pending: c("pending"), confirmed: c("confirmed"), completed: c("completed"), noShow: c("no_show") };
    },
  });

  const { data: todayList, isLoading } = useQuery({
    queryKey: ["appointments", "today", clinic.id, today],
    queryFn: async () => {
      const r = dayRange(today, tz);
      return (await supabase.from("appointments").select("id, starts_at, ends_at, status, client:clients(full_name)").eq("clinic_id", clinic.id).gte("starts_at", r.from).lt("starts_at", r.to).not("status", "eq", "cancelled").order("starts_at")).data ?? [];
    },
  });

  const cards = [
    { l: "Agendamentos", v: stats?.total },
    { l: "Aguardando confirmação", v: stats?.pending },
    { l: "Confirmados", v: stats?.confirmed },
    { l: "Concluídos", v: stats?.completed },
    { l: "Faltas", v: stats?.noShow },
  ];

  return (
    <>
      <PageHeader title="Painel" description={formatDayLabel(today)} actions={<Button onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> Novo agendamento</Button>} />
      <div className="mb-3 flex gap-1.5">
        {PERIODS.map((p) => (
          <Button key={p.v} size="sm" variant={period === p.v ? "default" : "outline"} onClick={() => setPeriod(p.v)}>{p.l}</Button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {cards.map((c) => (
          <div key={c.l} className="rounded-2xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{c.l}</p>
            <p className="mt-1 font-display text-3xl">{c.v ?? "–"}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Receitas, despesas e resultado aparecem aqui quando o módulo Financeiro for ativado.</p>

      <h2 className="mb-3 mt-8 text-xl">Atendimentos de hoje</h2>
      {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : todayList?.length ? (
        <div className="divide-y rounded-2xl border bg-card">
          {todayList.map((a) => (
            <button key={a.id} onClick={() => setOpenId(a.id)} className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-muted/50">
              <span className="w-24 shrink-0 font-semibold tabular-nums">{formatTime(a.starts_at, tz)}–{formatTime(a.ends_at, tz)}</span>
              <span className="flex-1 truncate">{(a.client as any)?.full_name}</span>
              <StatusBadge status={a.status} />
            </button>
          ))}
        </div>
      ) : (
        <EmptyState title="Nenhum atendimento hoje" description="Crie um agendamento para começar a organizar o dia." action={<Button size="sm" onClick={() => setNewOpen(true)}>Novo agendamento</Button>} />
      )}

      <AppointmentForm open={newOpen} onOpenChange={setNewOpen} defaultDate={today} />
      <AppointmentSheet id={openId} onOpenChange={(o) => !o && setOpenId(null)} />
    </>
  );
}
