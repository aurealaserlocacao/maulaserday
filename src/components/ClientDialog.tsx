import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useClinic } from "@/lib/session";
import { onlyDigits } from "@/lib/format";
import { friendlyDbError } from "@/lib/appointments";

export function ClientDialog({ open, onOpenChange, initial }: { open: boolean; onOpenChange: (o: boolean) => void; initial?: { id: string; full_name: string; phone: string; email: string | null; notes: string | null } }) {
  const clinic = useClinic();
  const qc = useQueryClient();
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setForm({ full_name: initial?.full_name ?? "", phone: initial?.phone ?? "", email: initial?.email ?? "", notes: initial?.notes ?? "" });
  }

  async function save() {
    if (form.full_name.trim().length < 2) return toast.error("Informe o nome completo.");
    if (onlyDigits(form.phone).length < 10) return toast.error("Informe o telefone com DDD.");
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) return toast.error("E-mail inválido.");
    setSaving(true);
    const row = { full_name: form.full_name.trim(), phone: form.phone.trim(), email: form.email.trim() || null, notes: form.notes.trim() || null };
    const { error } = initial
      ? await supabase.from("clients").update(row).eq("id", initial.id)
      : await supabase.from("clients").insert({ ...row, clinic_id: clinic.id, phone_normalized: "" });
    setSaving(false);
    if (error) return toast.error(friendlyDbError(error));
    toast.success("Cliente salva.");
    qc.invalidateQueries({ queryKey: ["clients"] });
    qc.invalidateQueries({ queryKey: ["client"] });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial ? "Editar cliente" : "Nova cliente"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="cn">Nome completo</Label><Input id="cn" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="cp">Telefone / WhatsApp</Label><Input id="cp" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="ce">E-mail <span className="text-muted-foreground">(opcional)</span></Label><Input id="ce" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="co">Observações <span className="text-muted-foreground">(opcional)</span></Label><Textarea id="co" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
