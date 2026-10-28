import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, Pencil, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { StatusBadge } from "./StatusBadge";
import { WhatsMenu } from "./WhatsMenu";
import { AppointmentForm } from "./AppointmentForm";
import { FIN_LABEL, STATUS_LABEL, TRANSITIONS, friendlyDbError, type ApptStatus } from "@/lib/appointments";
import { formatBRL, formatDate, formatDateTime, formatPhone, formatTime } from "@/lib/format";
import { useClinic } from "@/lib/session";

const ACTION_LABEL: Partial<Record<ApptStatus, string>> = {
  confirmed: "Confirmar",
  in_progress: "Iniciar atendimento",
  completed: "Concluir atendimento",
  no_show: "Marcar falta",
  cancelled: "Cancelar",
  pending: "Voltar para aguardando",
};
const NEEDS_CONFIRM: ApptStatus[] = ["cancelled", "no_show", "completed"];

const EVENT_LABEL: Record<string, string> = {
  created: "Agendamento criado",
  status: "Status alterado",
  rescheduled: "Horário alterado",
  final_amount: "Valor final alterado",
  areas: "Áreas atualizadas",
};

export function AppointmentSheet({ id, onOpenChange }: { id: string | null; onOpenChange: (o: boolean) => void }) {
  const clinic = useClinic();
  const tz = clinic.timezone;
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [pending, setPending] = useState<ApptStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [sessionNotes, setSessionNotes] = useState("");
  const [finalAmount, setFinalAmount] = useState("");

  const { data: a, isLoading } = useQuery({
    queryKey: ["appointment", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("appointments").select("*, client:clients(id, full_name, phone)").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
  });
  const { data: events } = useQuery({
    queryKey: ["appointment", id, "events"],
    enabled: !!id,
    queryFn: async () => (await supabase.from("appointment_events").select("*").eq("appointment_id", id!).order("created_at", { ascending: false })).data ?? [],
  });

  useEffect(() => {
    if (a) {
      setSessionNotes(a.session_notes ?? "");
      setFinalAmount(a.final_amount != null ? String(a.final_amount).replace(".", ",") : "");
    }
  }, [a]);

  function refresh() {
    qc.invalidateQueries({ queryKey: ["appointment", id] });
    qc.invalidateQueries({ queryKey: ["appointments"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["client"] });
  }

  async function changeStatus(s: ApptStatus) {
    setBusy(true);
    const { error } = await supabase.from("appointments").update({ status: s }).eq("id", id!);
    setBusy(false);
    setPending(null);
    if (error) return toast.error(friendlyDbError(error));
    toast.success(`Status: ${STATUS_LABEL[s]}`);
    refresh();
  }

  async function saveSession() {
    const fa = finalAmount.trim() ? Number(finalAmount.replace(/\./g, "").replace(",", ".")) : null;
    if (fa != null && (isNaN(fa) || fa < 0)) return toast.error("Valor final inválido.");
    setBusy(true);
    const { error } = await supabase.from("appointments").update({ session_notes: sessionNotes.trim() || null, final_amount: fa }).eq("id", id!);
    setBusy(false);
    if (error) return toast.error(friendlyDbError(error));
    toast.success("Atendimento salvo.");
    refresh();
  }

  const client = a?.client as { id: string; full_name: string; phone: string } | null;

  return (
    <Sheet open={!!id} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader><SheetTitle>Agendamento</SheetTitle></SheetHeader>
        {isLoading || !a ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-6 px-4 pb-8">
            <div>
              <Link to="/app/clientes/$id" params={{ id: client!.id }} className="font-display text-2xl hover:underline">{client?.full_name}</Link>
              <p className="flex items-center gap-1 text-sm text-muted-foreground"><Phone className="h-3.5 w-3.5" /> {formatPhone(client?.phone ?? "")}</p>
              <p className="mt-3 text-sm">{formatDate(a.starts_at, tz)} · {formatTime(a.starts_at, tz)}–{formatTime(a.ends_at, tz)} ({a.duration_min} min)</p>
              {(a.areas.length > 0 || a.areas_note) && <p className="text-sm text-muted-foreground">Áreas: {[...a.areas, a.areas_note].filter(Boolean).join(", ")}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusBadge status={a.status} />
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs">Financeiro: {FIN_LABEL[a.financial_status]}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <WhatsMenu phone={client!.phone} data={{ name: client!.full_name, startsAt: a.starts_at, areas: a.areas, areasNote: a.areas_note }} />
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" /> Editar</Button>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold">Ações</p>
              <div className="flex flex-wrap gap-2">
                {TRANSITIONS[a.status].map((s) => (
                  <Button key={s} size="sm" disabled={busy}
                    variant={s === "cancelled" || s === "no_show" ? "outline" : s === "pending" ? "ghost" : "default"}
                    onClick={() => (NEEDS_CONFIRM.includes(s) ? setPending(s) : changeStatus(s))}>
                    {ACTION_LABEL[s]}
                  </Button>
                ))}
              </div>
            </div>

            {a.internal_notes && (
              <div className="rounded-xl bg-muted p-3 text-sm">
                <p className="mb-1 text-xs font-semibold text-muted-foreground">Observações internas</p>
                {a.internal_notes}
              </div>
            )}

            <div className="space-y-3 rounded-xl border p-4">
              <p className="text-sm font-semibold">Atendimento</p>
              {a.expected_amount != null && <p className="text-xs text-muted-foreground">Valor previsto: {formatBRL(a.expected_amount)} (não é receita)</p>}
              <div className="space-y-1.5">
                <Label htmlFor="fa">Valor final</Label>
                <Input id="fa" inputMode="decimal" placeholder="R$ 0,00" value={finalAmount} onChange={(e) => setFinalAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sn">Observações do atendimento</Label>
                <Textarea id="sn" rows={3} value={sessionNotes} onChange={(e) => setSessionNotes(e.target.value)} />
              </div>
              <Button size="sm" onClick={saveSession} disabled={busy}>Salvar atendimento</Button>
              <p className="text-xs text-muted-foreground">Registro de pagamentos chega na próxima etapa (Financeiro).</p>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold">Histórico</p>
              <ol className="space-y-2 border-l pl-4">
                {events?.map((e) => {
                  const d = e.details as any;
                  return (
                    <li key={e.id} className="text-sm">
                      <p>{EVENT_LABEL[e.kind] ?? e.kind}
                        {e.kind === "status" && `: ${STATUS_LABEL[d.from as ApptStatus]} → ${STATUS_LABEL[d.to as ApptStatus]}`}
                        {e.kind === "rescheduled" && `: ${formatDateTime(d.from, tz)} → ${formatDateTime(d.to, tz)}`}
                        {e.kind === "final_amount" && `: ${d.from != null ? formatBRL(d.from) : "—"} → ${d.to != null ? formatBRL(d.to) : "—"}`}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(e.created_at, tz)}</p>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        )}

        <AppointmentForm open={editOpen} onOpenChange={setEditOpen} initial={a ? { ...a, client } : null} />

        <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{pending && ACTION_LABEL[pending]}?</AlertDialogTitle>
              <AlertDialogDescription>
                {pending === "completed" ? "O atendimento será marcado como concluído. Isso não gera receita automaticamente." : "Essa alteração fica registrada no histórico e libera o horário na agenda."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction onClick={() => pending && changeStatus(pending)}>Confirmar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
