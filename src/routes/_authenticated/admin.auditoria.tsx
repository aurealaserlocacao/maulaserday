import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/AppShell";
import { AUDIT_LABEL } from "@/lib/audit-labels";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/auditoria")({
  head: () => ({ meta: [{ title: "Auditoria — Laser Day Pro" }, { name: "description", content: "Registro de ações relevantes." }] }),
  component: Audit,
});

function Audit() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-audit"],
    queryFn: async () => (await supabase.from("audit_logs").select("id, action, created_at, actor_id, clinic:clinics(name)").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });
  return (
    <>
      <PageHeader title="Log de auditoria" description="Últimas 200 ações registradas." />
      {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : data?.length ? (
        <div className="divide-y rounded-2xl border bg-card">
          {data.map((l) => (
            <div key={l.id} className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm">
              <span>{AUDIT_LABEL[l.action] ?? l.action}{(l.clinic as any)?.name && <span className="text-muted-foreground"> · {(l.clinic as any).name}</span>}</span>
              <span className="text-muted-foreground">{formatDateTime(l.created_at)}</span>
            </div>
          ))}
        </div>
      ) : <EmptyState title="Nenhum registro ainda" />}
    </>
  );
}
