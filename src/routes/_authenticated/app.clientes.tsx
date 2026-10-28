import { createFileRoute, Link, Outlet, useMatch } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useClinic } from "@/lib/session";
import { formatDate, formatPhone, onlyDigits } from "@/lib/format";
import { friendlyDbError } from "@/lib/appointments";

export const Route = createFileRoute("/_authenticated/app/clientes")({
  head: () => ({ meta: [{ title: "Clientes — Laser Day Pro" }, { name: "description", content: "Cadastro de clientes da clínica." }] }),
  component: ClientsLayout,
});

function ClientsLayout() {
  const child = useMatch({ from: "/_authenticated/app/clientes/$id", shouldThrow: false });
  return child ? <Outlet /> : <ClientsList />;
}

function ClientsList() {
  const clinic = useClinic();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["clients", clinic.id, search],
    queryFn: async () => {
      let q = supabase.from("clients").select("id, full_name, phone, created_at").eq("clinic_id", clinic.id).is("archived_at", null).order("full_name").limit(200);
      const s = search.trim();
      if (s) {
        const d = onlyDigits(s);
        q = d.length >= 3 ? q.ilike("phone_normalized", `%${d}%`) : q.ilike("full_name", `%${s}%`);
      }
      return (await q).data ?? [];
    },
  });

  return (
    <>
      <PageHeader title="Clientes" actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nova cliente</Button>} />
      <div className="relative mb-4">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por nome ou telefone" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : data?.length ? (
        <div className="divide-y rounded-2xl border bg-card">
          {data.map((c) => (
            <Link key={c.id} to="/app/clientes/$id" params={{ id: c.id }} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50">
              <div className="min-w-0">
                <p className="truncate font-medium">{c.full_name}</p>
                <p className="text-xs text-muted-foreground">{formatPhone(c.phone)}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">desde {formatDate(c.created_at)}</span>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState title={search ? "Nenhuma cliente encontrada" : "Nenhuma cliente cadastrada"} description="Clientes também são criadas automaticamente ao fazer um agendamento." action={<Button size="sm" onClick={() => setOpen(true)}>Cadastrar cliente</Button>} />
      )}
      <ClientDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

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
