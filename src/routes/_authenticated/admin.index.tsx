import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { adminStats, adminFinanceSummary, adminLaserDayEvents } from "@/lib/admin.functions";
import { AUDIT_LABEL } from "@/lib/audit-labels";
import { formatBRL, formatDate, formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Painel administrativo — Laser Day Pro" }, { name: "description", content: "Visão geral das clínicas." }] }),
  component: AdminDash,
});

function AdminDash() {
  const statsFn = useServerFn(adminStats);
  const financeFn = useServerFn(adminFinanceSummary);
  const laserDaysFn = useServerFn(adminLaserDayEvents);
  const { data: laserDays } = useQuery({ queryKey: ["admin-laser-day-events"], queryFn: () => laserDaysFn({ data: {} }) });
  const { data: finance } = useQuery({ queryKey: ["admin-finance-summary"], queryFn: () => financeFn({ data: {} }) });
  const { data: s } = useQuery({ queryKey: ["admin-stats"], queryFn: () => statsFn() });
  const { data: expiring } = useQuery({
    queryKey: ["admin-expiring"],
    queryFn: async () => {
      const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      return (await supabase.from("rentals").select("id, equipment, ends_on, clinic:clinics(id, name)").eq("status", "active").lte("ends_on", in30).order("ends_on")).data ?? [];
    },
  });
  const { data: logs } = useQuery({
    queryKey: ["admin-logs-recent"],
    queryFn: async () => (await supabase.from("audit_logs").select("id, action, created_at, clinic:clinics(name)").like("action", "admin.%").order("created_at", { ascending: false }).limit(8)).data ?? [],
  });

  return (
    <>
      <PageHeader title="Painel administrativo" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[{ l: "Clínicas", v: s?.total }, { l: "Com acesso ativo", v: s?.active }, { l: "Suspensas", v: s?.suspended }, { l: "Agendamentos (30 dias)", v: s?.appointments30d }].map((c) => (
          <div key={c.l} className="rounded-2xl border bg-card p-4"><p className="text-xs text-muted-foreground">{c.l}</p><p className="font-display text-3xl">{c.v ?? "–"}</p></div>
        ))}
      </div>
      <section className="mt-6">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-xl">Financeiro das clínicas</h2>
          <p className="text-xs text-muted-foreground">{finance ? `${formatDate(finance.from + "T12:00:00Z")} a ${formatDate(finance.through + "T12:00:00Z")}` : "Últimos 30 dias"}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            { label: "Recebido líquido", value: finance?.total.netReceived },
            { label: "Estornos", value: finance?.total.refunds },
            { label: "Despesas", value: finance?.total.expenses },
            { label: "Saldo operacional", value: finance?.total.operatingBalance },
            { label: "A receber (estimado)", value: finance?.total.expectedOutstanding },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="mt-1 font-display text-xl">{item.value == null ? "–" : formatBRL(item.value)}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">O saldo operacional considera recebimentos menos estornos e despesas. “A receber” é uma estimativa de agendamentos recentes com status financeiro pendente ou parcial; não é receita recebida.</p>
        <div className="mt-3 overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left"><tr><th className="px-3 py-2">Clínica</th><th className="px-3 py-2 text-right">Recebido líquido</th><th className="px-3 py-2 text-right">Despesas</th><th className="px-3 py-2 text-right">Saldo</th><th className="px-3 py-2 text-right">A receber</th></tr></thead>
            <tbody className="divide-y">
              {finance?.clinics.map((clinic) => (
                <tr key={clinic.id}>
                  <td className="px-3 py-2"><Link to="/admin/clinicas/$id" params={{ id: clinic.id }} className="font-medium hover:underline">{clinic.name}</Link></td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatBRL(clinic.netReceived)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatBRL(clinic.expenses)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatBRL(clinic.operatingBalance)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatBRL(clinic.expectedOutstanding)}</td>
                </tr>
              ))}
              {finance?.clinics.length === 0 && <tr><td colSpan={5} className="px-3 py-3 text-muted-foreground">Nenhuma clínica cadastrada.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <section className="mt-6">
        <h2 className="mb-3 text-xl">Faturamento por Laser Day</h2>
        <p className="mb-3 text-xs text-muted-foreground">Cada linha é um evento por clínica. Os recebimentos atualizam os valores sem alterar a data original do Laser Day.</p>
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left"><tr><th className="px-3 py-2">Data</th><th className="px-3 py-2">Clínica</th><th className="px-3 py-2 text-right">Atendimentos</th><th className="px-3 py-2 text-right">Faturamento</th><th className="px-3 py-2 text-right">Recebido líquido</th><th className="px-3 py-2 text-right">Pendente</th></tr></thead>
            <tbody className="divide-y">
              {laserDays?.map((event) => (
                <tr key={event.clinicId + event.date}>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(event.date + "T12:00:00Z")}</td>
                  <td className="px-3 py-2"><Link to="/admin/clinicas/$id" params={{ id: event.clinicId }} className="font-medium hover:underline">{event.clinicName}</Link></td>
                  <td className="px-3 py-2 text-right tabular-nums">{event.appointmentCount}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatBRL(event.revenue)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatBRL(event.netReceived)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatBRL(event.outstanding)}</td>
                </tr>
              ))}
              {laserDays?.length === 0 && <tr><td colSpan={6} className="px-3 py-3 text-muted-foreground">Nenhum Laser Day cadastrado.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <div className="mt-8 grid gap-6 md:grid-cols-2>
        <section>
          <h2 className="mb-3 text-xl">Locações vencendo (30 dias)</h2>
          <div className="divide-y rounded-2xl border bg-card">
            {expiring?.map((r) => (
              <Link key={r.id} to="/admin/clinicas/$id" params={{ id: (r.clinic as any).id }} className="flex justify-between px-4 py-3 text-sm hover:bg-muted/50">
                <span>{(r.clinic as any).name} · {r.equipment}</span><span className="text-muted-foreground">{r.ends_on && formatDate(r.ends_on + "T12:00:00Z")}</span>
              </Link>
            ))}
            {expiring?.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">Nenhuma locação vencendo.</p>}
          </div>
        </section>
        <section>
          <h2 className="mb-3 text-xl">Atividade administrativa</h2>
          <div className="divide-y rounded-2xl border bg-card">
            {logs?.map((l) => (
              <div key={l.id} className="flex justify-between gap-2 px-4 py-3 text-sm">
                <span>{AUDIT_LABEL[l.action] ?? l.action}{(l.clinic as any)?.name && ` · ${(l.clinic as any).name}`}</span>
                <span className="shrink-0 text-muted-foreground">{formatDateTime(l.created_at)}</span>
              </div>
            ))}
            {logs?.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">Sem atividade ainda.</p>}
          </div>
        </section>
      </div>
    </>
  );
}
