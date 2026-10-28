import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useClinic } from "@/lib/session";
import { useTemplates } from "@/components/WhatsMenu";
import { WHATS_LABELS, DEFAULT_TEMPLATES, type WhatsKind } from "@/lib/whatsapp";
import { formatDateTime, zonedToISO } from "@/lib/format";
import { DURATIONS } from "@/lib/appointments";

export const Route = createFileRoute("/_authenticated/app/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Laser Day Pro" }, { name: "description", content: "Configurações da clínica." }] }),
  component: Settings,
});

function Settings() {
  return (
    <>
      <PageHeader title="Configurações" />
      <div className="space-y-6">
        <ClinicInfo />
        <Blocks />
        <Templates />
        <Password />
      </div>
    </>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border bg-card p-5"><h2 className="mb-4 text-lg">{title}</h2>{children}</section>;
}

function ClinicInfo() {
  const clinic = useClinic();
  const qc = useQueryClient();
  const [f, setF] = useState({ name: clinic.name, phone: clinic.phone ?? "", address: clinic.address ?? "", dur: clinic.default_duration_min });
  async function save() {
    if (f.name.trim().length < 2) return toast.error("Informe o nome.");
    const { error } = await supabase.from("clinics").update({ name: f.name.trim(), phone: f.phone.trim() || null, address: f.address.trim() || null, default_duration_min: f.dur }).eq("id", clinic.id);
    if (error) return toast.error("Não foi possível salvar.");
    toast.success("Dados salvos.");
    qc.invalidateQueries({ queryKey: ["me"] });
  }
  return (
    <Card title="Dados da clínica">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="nm">Nome de exibição</Label><Input id="nm" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="ph">Telefone / WhatsApp</Label><Input id="ph" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="ad">Endereço <span className="text-muted-foreground">(opcional)</span></Label><Input id="ad" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
        <div className="space-y-1.5">
          <Label htmlFor="du">Duração padrão</Label>
          <select id="du" className="h-9 w-full rounded-md border bg-card px-3 text-sm" value={f.dur} onChange={(e) => setF({ ...f, dur: Number(e.target.value) })}>
            {DURATIONS.map((d) => <option key={d} value={d}>{d} min</option>)}
          </select>
        </div>
        <div className="space-y-1.5"><Label>Fuso horário</Label><Input value={clinic.timezone} disabled /></div>
      </div>
      <Button className="mt-4" onClick={save}>Salvar</Button>
    </Card>
  );
}

function Blocks() {
  const clinic = useClinic();
  const qc = useQueryClient();
  const [f, setF] = useState({ date: "", from: "12:00", to: "13:00", reason: "" });
  const { data } = useQuery({
    queryKey: ["blocks", clinic.id],
    queryFn: async () => (await supabase.from("blocked_times").select("*").eq("clinic_id", clinic.id).gte("ends_at", new Date().toISOString()).order("starts_at")).data ?? [],
  });
  async function add() {
    if (!f.date) return toast.error("Informe a data.");
    if (f.to <= f.from) return toast.error("O fim deve ser depois do início.");
    const { error } = await supabase.from("blocked_times").insert({ clinic_id: clinic.id, starts_at: zonedToISO(f.date, f.from, clinic.timezone), ends_at: zonedToISO(f.date, f.to, clinic.timezone), reason: f.reason.trim() || null });
    if (error) return toast.error("Não foi possível bloquear.");
    toast.success("Horário bloqueado.");
    setF({ ...f, reason: "" });
    qc.invalidateQueries({ queryKey: ["blocks"] });
  }
  async function remove(id: string) {
    if (!confirm("Remover este bloqueio?")) return;
    await supabase.from("blocked_times").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["blocks"] });
  }
  return (
    <Card title="Bloqueios de agenda">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} aria-label="Data" className="col-span-2 sm:col-span-1" />
        <Input type="time" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} aria-label="De" />
        <Input type="time" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} aria-label="Até" />
        <Input placeholder="Motivo (opcional)" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} className="col-span-2 sm:col-span-1" />
        <Button onClick={add} className="col-span-2 sm:col-span-1">Bloquear</Button>
      </div>
      <ul className="mt-4 divide-y">
        {data?.map((b) => (
          <li key={b.id} className="flex items-center justify-between py-2 text-sm">
            <span>{formatDateTime(b.starts_at, clinic.timezone)} – {formatDateTime(b.ends_at, clinic.timezone).slice(11)} {b.reason && <span className="text-muted-foreground">· {b.reason}</span>}</span>
            <Button variant="ghost" size="icon" aria-label="Remover" onClick={() => remove(b.id)}><Trash2 className="h-4 w-4" /></Button>
          </li>
        ))}
        {data?.length === 0 && <li className="py-2 text-sm text-muted-foreground">Nenhum bloqueio futuro.</li>}
      </ul>
    </Card>
  );
}

function Templates() {
  const clinic = useClinic();
  const qc = useQueryClient();
  const { data } = useTemplates();
  const [kind, setKind] = useState<WhatsKind>("confirm");
  const [body, setBody] = useState("");
  useEffect(() => { if (data) setBody(data[kind]); }, [data, kind]);
  async function save() {
    const { error } = await supabase.from("message_templates").upsert({ clinic_id: clinic.id, kind, body, updated_at: new Date().toISOString() }, { onConflict: "clinic_id,kind" });
    if (error) return toast.error("Não foi possível salvar.");
    toast.success("Modelo salvo.");
    qc.invalidateQueries({ queryKey: ["templates"] });
  }
  return (
    <Card title="Mensagens de WhatsApp">
      <select className="mb-3 h-9 w-full rounded-md border bg-card px-3 text-sm" value={kind} onChange={(e) => setKind(e.target.value as WhatsKind)} aria-label="Modelo">
        {(Object.keys(WHATS_LABELS) as WhatsKind[]).map((k) => <option key={k} value={k}>{WHATS_LABELS[k]}</option>)}
      </select>
      <Textarea rows={9} value={body} onChange={(e) => setBody(e.target.value)} />
      <p className="mt-2 text-xs text-muted-foreground">Use {"{nome}"}, {"{data}"}, {"{horario}"} e {"{areas}"}. Linhas com {"{areas}"} somem quando não há áreas.</p>
      <div className="mt-3 flex gap-2">
        <Button onClick={save}>Salvar modelo</Button>
        <Button variant="ghost" onClick={() => setBody(DEFAULT_TEMPLATES[kind])}>Restaurar padrão</Button>
      </div>
    </Card>
  );
}

function Password() {
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  async function save() {
    if (pw.length < 8) return toast.error("A nova senha precisa ter 8+ caracteres.");
    const { error } = await supabase.auth.updateUser({ password: pw, current_password: cur } as any);
    if (error) return toast.error("Não foi possível trocar a senha. Confira a senha atual.");
    toast.success("Senha alterada.");
    setCur(""); setPw("");
  }
  return (
    <Card title="Minha senha">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="cpw">Senha atual</Label><Input id="cpw" type="password" value={cur} onChange={(e) => setCur(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="npw">Nova senha</Label><Input id="npw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
      </div>
      <Button className="mt-4" onClick={save}>Trocar senha</Button>
    </Card>
  );
}
