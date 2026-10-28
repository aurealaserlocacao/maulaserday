import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { adminStats } from "@/lib/admin.functions";
import { AUDIT_LABEL } from "@/lib/audit-labels";
import { formatDate, formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Painel administrativo — Laser Day Pro" }, { name: "description", content: "Visão geral das clínicas." }] }),
  component: AdminDash,
});

function AdminDash() {
  const statsFn = useServerFn(adminStats);
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
      <div className="mt-8 grid gap-6 md:grid-cols-2">
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
