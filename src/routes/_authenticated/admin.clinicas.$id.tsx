import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { resendInvite, saveRental, setClinicAccess, updateClinicAdmin, adminStats, adminFinanceSummary, adminLaserDayEvents } from "@/lib/admin.functions";
import { AUDIT_LABEL } from "@/lib/audit-labels";
import { formatBRL, formatDate, formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/clinicas/$id")({
  head: () => ({ meta: [{ title: "Clínica — Laser Day Pro" }, { name: "description", content: "Detalhes da clínica." }] }),
  component: ClinicAdmin,
});

const RENTAL_LABEL = { active: "Ativa", ended: "Encerrada", pending: "Pendente" } as const;

function ClinicAdmin() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const accessFn = useServerFn(setClinicAccess);
  const resendFn = useServerFn(resendInvite);
  const updateFn = useServerFn(updateClinicAdmin);
  const rentalFn = useServerFn(saveRental);
  const statsFn = useServerFn(adminStats);
  const financeFn = useServerFn(adminFinanceSummary);
  const laserDaysFn = useServerFn(adminLaserDayEvents);
  const [confirmSuspend, setConfirmSuspend] = useState(false);

  const { data: c } = useQuery({ queryKey: ["admin-clinic", id], queryFn: async () => (await supabase.from("clinics").select("*").eq("id", id).maybeSingle()).data });
  const { data: rentals } = useQuery({ queryKey: ["admin-rentals", id], queryFn: async () => (await supabase.from("rentals").select("*").eq("clinic_id", id).order("created_at", { ascending: false })).data ?? [] });
  const { data: members } = useQuery({ queryKey: ["admin-members", id], queryFn: async () => (await supabase.from("clinic_memberships").select("id, role, active, invited_at, user_id").eq("clinic_id", id)).data ?? [] });
  const { data: logs } = useQuery({ queryKey: ["admin-clinic-logs", id], queryFn: async () => (await supabase.from("audit_logs").select("id, action, created_at").eq("clinic_id", id).order("created_at", { ascending: false }).limit(15)).data ?? [] });
  const { data: stats } = useQuery({ queryKey: ["admin-stats"], queryFn: () => statsFn() });
  const { data: finance } = useQuery({ queryKey: ["admin-clinic-finance", id], queryFn: () => financeFn({ data: { clinicId: id } }) });
  const { data: laserDays } = useQuery({ queryKey: ["admin-clinic-laser-days", id], queryFn: () => laserDaysFn({ data: { clinicId: id } }) });

  const [f, setF] = useState({ name: "", owner_name: "", phone: "", business_info: "", admin_notes: "" });
  useEffect(() => { if (c) setF({ name: c.name, owner_name: c.owner_name ?? "", phone: c.phone ?? "", business_info: c.business_info ?? "", admin_notes: c.admin_notes ?? "" }); }, [c]);
  const [r, setR] = useState({ equipment: "", starts_on: "", ends_on: "" });

  const refresh = () => ["admin-clinic", "admin-rentals", "admin-clinic-logs", "admin-clinics", "admin-stats"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

  async function run(p: Promise<unknown>, ok: string) {
    try { await p; toast.success(ok); refresh(); } catch (e: any) { toast.error(e.message ?? "Erro"); }
  }

  if (!c) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  const active = c.access_status === "active";

  return (
    <>
      <Link to="/admin/clinicas" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Clínicas</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl">{c.name}</h1>
          <p className="text-sm text-muted-foreground">{c.contact_email} · {active ? "Acesso ativo" : "Acesso suspenso"}</p>
          <p className="text-xs text-muted-foreground">Agendamentos nos últimos 30 dias: {stats?.perClinic?.[id] ?? 0}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => run(resendFn({ data: { clinicId: id, redirectTo: `${window.location.origin}/convite` } }), "Convite reenviado.")}><Mail className="h-4 w-4" /> Reenviar convite</Button>
          {active
            ? <Button variant="destructive" size="sm" onClick={() => setConfirmSuspend(true)}>Suspender acesso</Button>
            : <Button size="sm" onClick={() => run(accessFn({ data: { clinicId: id, status: "active" } }), "Acesso reativado.")}>Reativar acesso</Button>}
        </div>
      </div>

      <section className="mb-6 rounded-2xl border bg-card p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg">Financeiro da clínica · últimos 30 dias</h2>
          <p className="text-xs text-muted-foreground">{finance ? `${formatDate(finance.from + "T12:00:00Z")} a ${formatDate(finance.through + "T12:00:00Z")}` : "Carregando período…"}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            { label: "Recebido bruto", value: finance?.total.grossReceipts },
            { label: "Estornos", value: finance?.total.refunds },
            { label: "Recebido líquido", value: finance?.total.netReceived },
            { label: "Despesas", value: finance?.total.expenses },
            { label: "Saldo operacional", value: finance?.total.operatingBalance },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border p-3">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="mt-1 font-display text-lg">{item.value == null ? "–" : formatBRL(item.value)}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <p><span className="text-muted-foreground">Estimativa a receber:</span> <strong>{finance ? formatBRL(finance.total.expectedOutstanding) : "–"}</strong></p>
          <p><span className="text-muted-foreground">Agendamentos pendentes/parciais:</span> <strong>{finance?.total.unpaidAppointments ?? "–"}</strong></p>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Valores previstos são estimativas separadas dos recebimentos confirmados. Estornos reduzem o recebido líquido; despesas arquivadas não entram no saldo.</p>
      </section>

      <section className="mb-6 rounded-2xl border bg-card p-5">
        <h2 className="mb-3 text-lg">Faturamento por Laser Day</h2>
        <p className="mb-3 text-xs text-muted-foreground">Cada data permanece como um evento próprio. Recebimentos e estornos ligados aos atendimentos atualizam os valores desta data.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left"><tr><th className="px-3 py-2">Data do Laser Day</th><th className="px-3 py-2 text-right">Atendimentos</th><th className="px-3 py-2 text-right">Faturamento</th><th className="px-3 py-2 text-right">Recebido líquido</th><th className="px-3 py-2 text-right">Pendente</th></tr></thead>
            <tbody className="divide-y">
              {laserDays?.map((event) => (
                <tr key={event.date}>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(event.date + "T12:00:00Z")}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{event.appointmentCount}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatBRL(event.revenue)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatBRL(event.netReceived)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatBRL(event.outstanding)}</td>
                </tr>
              ))}
              {laserDays?.length === 0 && <tr><td colSpan={5} className="px-3 py-3 text-muted-foreground">Nenhum Laser Day cadastrado.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="mb-4 text-lg">Cadastro</h2>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="n">Nome</Label><Input id="n" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="o">Responsável</Label><Input id="o" value={f.owner_name} onChange={(e) => setF({ ...f, owner_name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="p">Telefone</Label><Input id="p" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="b">Dados comerciais</Label><Input id="b" value={f.business_info} onChange={(e) => setF({ ...f, business_info: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="a">Observações administrativas</Label><Textarea id="a" rows={3} value={f.admin_notes} onChange={(e) => setF({ ...f, admin_notes: e.target.value })} /></div>
            <Button onClick={() => run(updateFn({ data: { clinicId: id, name: f.name, owner_name: f.owner_name || null, phone: f.phone || null, business_info: f.business_info || null, admin_notes: f.admin_notes || null } }), "Dados salvos.")}>Salvar</Button>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-5">
          <h2 className="mb-4 text-lg">Locações</h2>
          <ul className="mb-4 divide-y">
            {rentals?.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <div>
                  <p className="font-medium">{x.equipment} <span className="text-xs text-muted-foreground">· {RENTAL_LABEL[x.status]}</span></p>
                  <p className="text-xs text-muted-foreground">{x.starts_on ? formatDate(x.starts_on + "T12:00:00Z") : "—"} até {x.ends_on ? formatDate(x.ends_on + "T12:00:00Z") : "—"}</p>
                </div>
                {x.status !== "ended" && (
                  <Button variant="ghost" size="sm" onClick={() => confirm("Encerrar esta locação?") && run(rentalFn({ data: { id: x.id, clinicId: id, equipment: x.equipment, starts_on: x.starts_on, ends_on: x.ends_on, status: "ended", notes: x.notes } }), "Locação encerrada.")}>Encerrar</Button>
                )}
              </li>
            ))}
            {rentals?.length === 0 && <li className="py-2 text-sm text-muted-foreground">Nenhuma locação.</li>}
          </ul>
          <div className="grid grid-cols-2 gap-2">
            <Input className="col-span-2" placeholder="Equipamento" value={r.equipment} onChange={(e) => setR({ ...r, equipment: e.target.value })} />
            <Input type="date" aria-label="Início" value={r.starts_on} onChange={(e) => setR({ ...r, starts_on: e.target.value })} />
            <Input type="date" aria-label="Término" value={r.ends_on} onChange={(e) => setR({ ...r, ends_on: e.target.value })} />
            <Button className="col-span-2" variant="outline" disabled={!r.equipment.trim()} onClick={() => run(rentalFn({ data: { clinicId: id, equipment: r.equipment, starts_on: r.starts_on || null, ends_on: r.ends_on || null, status: "active", notes: null } }).then(() => setR({ equipment: "", starts_on: "", ends_on: "" })), "Locação adicionada.")}>Adicionar locação</Button>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-5">
          <h2 className="mb-4 text-lg">Acessos</h2>
          <ul className="divide-y text-sm">
            {members?.map((m) => (
              <li key={m.id} className="py-2">{m.role === "owner" ? "Responsável" : "Equipe"} · convidada em {m.invited_at ? formatDateTime(m.invited_at) : "—"} · {m.active ? "ativa" : "inativa"}</li>
            ))}
            {members?.length === 0 && <li className="py-2 text-muted-foreground">Nenhum usuário vinculado.</li>}
          </ul>
        </section>

        <section className="rounded-2xl border bg-card p-5">
          <h2 className="mb-4 text-lg">Auditoria da clínica</h2>
          <ul className="divide-y text-sm">
            {logs?.map((l) => (
              <li key={l.id} className="flex justify-between gap-2 py-2"><span>{AUDIT_LABEL[l.action] ?? l.action}</span><span className="shrink-0 text-muted-foreground">{formatDateTime(l.created_at)}</span></li>
            ))}
          </ul>
        </section>
      </div>

      <AlertDialog open={confirmSuspend} onOpenChange={setConfirmSuspend}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspender acesso de {c.name}?</AlertDialogTitle>
            <AlertDialogDescription>A clínica deixa de acessar o sistema imediatamente. Nenhum dado é apagado e o acesso pode ser reativado depois.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => run(accessFn({ data: { clinicId: id, status: "suspended" } }), "Acesso suspenso.")}>Suspender</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
