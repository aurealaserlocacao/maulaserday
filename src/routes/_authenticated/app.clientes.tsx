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

import { ClientDialog } from "@/components/ClientDialog";
