import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { WhatsMenu } from "@/components/WhatsMenu";
import { AppointmentForm } from "@/components/AppointmentForm";
import { AppointmentSheet } from "@/components/AppointmentSheet";
import { EmptyState } from "@/components/AppShell";
import { ClientDialog } from "@/components/ClientDialog";
import { useClinic } from "@/lib/session";
import { formatBRL, formatDate, formatPhone, formatTime } from "@/lib/format";
import { METHOD_LABEL } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/app/clientes/$id")({
  head: () => ({ meta: [{ title: "Cliente — Laser Day Pro" }, { name: "description", content: "Histórico da cliente." }] }),
  component: ClientDetail,
});

function ClientDetail() {
  const { id } = Route.useParams();
  const clinic = useClinic();
  const tz = clinic.timezone;
  const [edit, setEdit] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: c, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => (await supabase.from("clients").select("*").eq("id", id).maybeSingle()).data,
  });
  const { data: appts } = useQuery({
    queryKey: ["client", id, "appointments"],
    queryFn: async () => (await supabase.from("appointments").select("id, starts_at, status, areas, areas_note, final_amount").eq("client_id", id).order("starts_at", { ascending: false })).data ?? [],
  });

  const { data: pays } = useQuery({
    queryKey: ["client", id, "payments"],
    queryFn: async () => (await supabase.from("payments").select("id, kind, amount, method, paid_on, is_no_show_fee").eq("client_id", id).order("paid_on", { ascending: false })).data ?? [],
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!c) return <EmptyState title="Cliente não encontrada" action={<Button asChild size="sm" variant="outline"><Link to="/app/clientes">Voltar</Link></Button>} />;

  const count = (s: string) => appts?.filter((a) => a.status === s).length ?? 0;

  return (
    <>
      <Link to="/app/clientes" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Clientes</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl">{c.full_name}</h1>
          <p className="text-sm text-muted-foreground">{formatPhone(c.phone)}{c.email && ` · ${c.email}`}</p>
          <p className="text-xs text-muted-foreground">Cadastrada em {formatDate(c.created_at, tz)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <WhatsMenu phone={c.phone} data={{ name: c.full_name }} />
          <Button variant="outline" size="sm" onClick={() => setEdit(true)}><Pencil className="h-4 w-4" /> Editar</Button>
          <Button size="sm" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> Agendar</Button>
        </div>
      </div>
      {c.notes && <div className="mb-6 rounded-xl bg-muted p-3 text-sm">{c.notes}</div>}

      <div className="mb-6 grid grid-cols-3 gap-3">
        {[{ l: "Concluídos", v: count("completed") }, { l: "Faltas", v: count("no_show") }, { l: "Cancelados", v: count("cancelled") }].map((x) => (
          <div key={x.l} className="rounded-2xl border bg-card p-4"><p className="text-xs text-muted-foreground">{x.l}</p><p className="font-display text-2xl">{x.v}</p></div>
        ))}
      </div>

      <h2 className="mb-3 text-xl">Histórico de atendimentos</h2>
      {appts?.length ? (
        <div className="divide-y rounded-2xl border bg-card">
          {appts.map((a) => (
            <button key={a.id} onClick={() => setOpenId(a.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50">
              <span className="w-32 shrink-0 text-sm tabular-nums">{formatDate(a.starts_at, tz)} {formatTime(a.starts_at, tz)}</span>
              <span className="flex-1 truncate text-sm text-muted-foreground">{[...a.areas, a.areas_note].filter(Boolean).join(", ") || "—"}</span>
              <StatusBadge status={a.status} />
            </button>
          ))}
        </div>
      ) : <EmptyState title="Sem atendimentos ainda" />}
      <h2 className="mb-3 mt-8 text-xl">Pagamentos</h2>
      {pays?.length ? (
        <div className="divide-y rounded-2xl border bg-card">
          {pays.map((p) => (
            <div key={p.id} className="flex justify-between px-4 py-3 text-sm">
              <span>{formatDate(p.paid_on + "T12:00:00Z")} · {METHOD_LABEL[p.method]}{p.kind === "refund" && " · estorno"}{p.is_no_show_fee && " · taxa de falta"}</span>
              <span className={p.kind === "refund" ? "text-destructive" : "font-semibold"}>{p.kind === "refund" ? "− " : ""}{formatBRL(Number(p.amount))}</span>
            </div>
          ))}
        </div>
      ) : <EmptyState title="Sem pagamentos registrados" />}

      <ClientDialog open={edit} onOpenChange={setEdit} initial={c} />
      <AppointmentForm open={newOpen} onOpenChange={setNewOpen} defaultClientId={c.id} />
      <AppointmentSheet id={openId} onOpenChange={(o) => !o && setOpenId(null)} />
    </>
  );
}
