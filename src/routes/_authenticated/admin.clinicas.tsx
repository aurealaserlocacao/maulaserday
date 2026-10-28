import { createFileRoute, Link, Outlet, useMatch } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createClinicAndInvite } from "@/lib/admin.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/clinicas")({
  head: () => ({ meta: [{ title: "Clínicas — Laser Day Pro" }, { name: "description", content: "Clínicas parceiras." }] }),
  component: Layout,
});

function Layout() {
  const child = useMatch({ from: "/_authenticated/admin/clinicas/$id", shouldThrow: false });
  return child ? <Outlet /> : <List />;
}

function List() {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-clinics"],
    queryFn: async () => (await supabase.from("clinics").select("id, name, owner_name, contact_email, access_status, rentals(status, equipment)").order("name")).data ?? [],
  });
  return (
    <>
      <PageHeader title="Clínicas" actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nova clínica</Button>} />
      {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : data?.length ? (
        <div className="divide-y rounded-2xl border bg-card">
          {data.map((c) => (
            <Link key={c.id} to="/admin/clinicas/$id" params={{ id: c.id }} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50">
              <div className="min-w-0">
                <p className="truncate font-medium">{c.name}</p>
                <p className="truncate text-xs text-muted-foreground">{c.owner_name} · {c.contact_email}</p>
              </div>
              <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs", c.access_status === "active" ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive")}>
                {c.access_status === "active" ? "Ativa" : "Suspensa"}
              </span>
            </Link>
          ))}
        </div>
      ) : <EmptyState title="Nenhuma clínica cadastrada" description="Cadastre a primeira clínica e envie o convite por e-mail." action={<Button size="sm" onClick={() => setOpen(true)}>Nova clínica</Button>} />}
      <NewClinic open={open} onOpenChange={setOpen} />
    </>
  );
}

function NewClinic({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const create = useServerFn(createClinicAndInvite);
  const empty = { name: "", owner_name: "", contact_email: "", phone: "", business_info: "", equipment: "", starts_on: "", ends_on: "", admin_notes: "" };
  const [f, setF] = useState(empty);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function save() {
    if (f.name.trim().length < 2 || f.owner_name.trim().length < 2) return toast.error("Informe nome da clínica e da responsável.");
    if (!/^\S+@\S+\.\S+$/.test(f.contact_email)) return toast.error("E-mail inválido.");
    setSaving(true);
    try {
      const r = await create({ data: { ...f, redirectTo: `${window.location.origin}/convite` } });
      toast.success(r.invite.status === "invited" ? "Clínica criada e convite enviado." : "Clínica criada. Esse e-mail já tinha conta: enviamos um link para definir senha.");
      qc.invalidateQueries({ queryKey: ["admin-clinics"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      setF(empty);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Não foi possível criar a clínica.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Nova clínica</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="n">Nome da clínica</Label><Input id="n" value={f.name} onChange={set("name")} /></div>
          <div className="space-y-1.5"><Label htmlFor="o">Responsável</Label><Input id="o" value={f.owner_name} onChange={set("owner_name")} /></div>
          <div className="space-y-1.5"><Label htmlFor="e">E-mail de acesso</Label><Input id="e" type="email" value={f.contact_email} onChange={set("contact_email")} /></div>
          <div className="space-y-1.5"><Label htmlFor="p">Telefone <span className="text-muted-foreground">(opcional)</span></Label><Input id="p" value={f.phone} onChange={set("phone")} /></div>
          <div className="space-y-1.5"><Label htmlFor="b">Dados comerciais <span className="text-muted-foreground">(opcional)</span></Label><Input id="b" placeholder="CNPJ, razão social…" value={f.business_info} onChange={set("business_info")} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="eq">Equipamento alugado <span className="text-muted-foreground">(opcional)</span></Label><Input id="eq" value={f.equipment} onChange={set("equipment")} /></div>
          <div className="space-y-1.5"><Label htmlFor="s">Início da locação</Label><Input id="s" type="date" value={f.starts_on} onChange={set("starts_on")} /></div>
          <div className="space-y-1.5"><Label htmlFor="t">Término da locação</Label><Input id="t" type="date" value={f.ends_on} onChange={set("ends_on")} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="an">Observações administrativas <span className="text-muted-foreground">(opcional)</span></Label><Textarea id="an" rows={2} value={f.admin_notes} onChange={set("admin_notes")} /></div>
        </div>
        <p className="text-xs text-muted-foreground">A responsável receberá um e-mail para criar a própria senha.</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Criar e enviar convite</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
