import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { METHOD_LABEL, balanceDue, netReceived, parseMoney, type Method } from "@/lib/finance";
import { formatBRL, formatDate, todayInTz } from "@/lib/format";
import { useClinic } from "@/lib/session";

function friendly(m?: string) {
  if (m?.includes("maior que")) return "O estorno é maior que o valor disponível.";
  return "Não foi possível registrar. Tente novamente.";
}

export function PaymentsPanel({ appointmentId, finalAmount, isNoShow }: { appointmentId: string; finalAmount: number | null; isNoShow: boolean }) {
  const clinic = useClinic();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method>("pix");
  const [date, setDate] = useState(todayInTz(clinic.timezone));
  const [busy, setBusy] = useState(false);
  const [refund, setRefund] = useState<{ id: string; max: number } | null>(null);
  const [refundAmount, setRefundAmount] = useState("");

  const { data: pays } = useQuery({
    queryKey: ["payments", "appt", appointmentId],
    queryFn: async () => (await supabase.from("payments").select("*").eq("appointment_id", appointmentId).order("created_at")).data ?? [],
  });
  const list = pays ?? [];
  const net = netReceived(list);
  const due = balanceDue(list, finalAmount);

  function refresh() {
    ["payments", "appointment", "appointments", "dashboard", "finance", "client"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  }

  async function add() {
    const v = parseMoney(amount);
    if (!v || v <= 0) return toast.error("Informe um valor válido.");
    setBusy(true);
    const { error } = await supabase.from("payments").insert({ clinic_id: clinic.id, appointment_id: appointmentId, kind: "receipt", amount: v, method, paid_on: date, is_no_show_fee: isNoShow, description: isNoShow ? "Taxa de falta" : null });
    setBusy(false);
    if (error) return toast.error(friendly(error.message));
    toast.success("Pagamento registrado.");
    setAmount("");
    refresh();
  }

  async function doRefund() {
    if (!refund) return;
    const v = parseMoney(refundAmount);
    if (!v || v <= 0 || v > refund.max) return toast.error(`Informe um valor até ${formatBRL(refund.max)}.`);
    const orig = list.find((p) => p.id === refund.id)!;
    const { error } = await supabase.from("payments").insert({ clinic_id: clinic.id, kind: "refund", refund_of: refund.id, amount: v, method: orig.method, paid_on: todayInTz(clinic.timezone), description: "Estorno" });
    setRefund(null);
    if (error) return toast.error(friendly(error.message));
    toast.success("Estorno registrado.");
    refresh();
  }

  const refundedOf = (id: string) => list.filter((p) => p.refund_of === id).reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <p className="text-sm font-semibold">Pagamentos</p>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-muted p-2"><p className="text-xs text-muted-foreground">Recebido</p><p className="font-semibold">{formatBRL(net)}</p></div>
        <div className="rounded-lg bg-muted p-2"><p className="text-xs text-muted-foreground">Saldo pendente</p><p className="font-semibold">{finalAmount == null ? "Defina o valor final" : formatBRL(due)}</p></div>
      </div>
      {list.length > 0 && (
        <ul className="divide-y text-sm">
          {list.map((p) => {
            const avail = Number(p.amount) - refundedOf(p.id);
            return (
              <li key={p.id} className="flex items-center justify-between gap-2 py-1.5">
                <span className={p.kind === "refund" ? "text-destructive" : ""}>
                  {p.kind === "refund" ? "− " : ""}{formatBRL(Number(p.amount))} · {METHOD_LABEL[p.method]} · {formatDate(p.paid_on + "T12:00:00Z")}
                  {p.is_no_show_fee && " · taxa de falta"}{p.kind === "refund" && " · estorno"}
                </span>
                {p.kind === "receipt" && avail > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => { setRefund({ id: p.id, max: avail }); setRefundAmount(String(avail).replace(".", ",")); }}>
                    <Undo2 className="h-3.5 w-3.5" /> Estornar
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1"><Label htmlFor="pa">Valor recebido</Label><Input id="pa" inputMode="decimal" placeholder="R$ 0,00" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <div className="space-y-1">
          <Label htmlFor="pm">Forma</Label>
          <select id="pm" className="h-9 w-full rounded-md border bg-card px-2 text-sm" value={method} onChange={(e) => setMethod(e.target.value as Method)}>
            {(Object.keys(METHOD_LABEL) as Method[]).map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
          </select>
        </div>
        <div className="col-span-2 space-y-1"><Label htmlFor="pd">Data do pagamento</Label><Input id="pd" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      </div>
      <Button size="sm" onClick={add} disabled={busy}>{isNoShow ? "Registrar taxa de falta" : "Registrar pagamento"}</Button>

      <AlertDialog open={!!refund} onOpenChange={(o) => !o && setRefund(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Registrar estorno</AlertDialogTitle>
            <AlertDialogDescription>O valor estornado sai da receita. O pagamento original continua no histórico.</AlertDialogDescription>
          </AlertDialogHeader>
          <Input inputMode="decimal" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} aria-label="Valor do estorno" />
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={doRefund}>Estornar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
