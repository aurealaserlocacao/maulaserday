import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useClinic } from "@/lib/session";
import { DEFAULT_EXPENSE_CATEGORIES, METHOD_LABEL, parseMoney, periodResult, toCSV, type Method } from "@/lib/finance";
import { addDays, formatBRL, formatDate, todayInTz } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — Laser Day Pro" }, { name: "description", content: "Receitas recebidas, despesas e resultado." }] }),
  component: Finance,
});

const d = (s: string) => formatDate(s + "T12:00:00Z");

function Finance() {
  const clinic = useClinic();
  const qc = useQueryClient();
  const today = todayInTz(clinic.timezone);
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [tab, setTab] = useState<"all" | "in" | "out">("all");
  const [cat, setCat] = useState("all");
  const [expOpen, setExpOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [recOpen, setRecOpen] = useState(false);

  const { data: cats } = useQuery({
    queryKey: ["finance", "cats", clinic.id],
    queryFn: async () => {
      const { data } = await supabase.from("expense_categories").select("id, name").eq("clinic_id", clinic.id).order("name");
      return { custom: data ?? [], all: [...DEFAULT_EXPENSE_CATEGORIES, ...(data ?? []).map((c) => c.name)] };
    },
  });
  const { data, isLoading } = useQuery({
    queryKey: ["finance", clinic.id, from, to],
    queryFn: async () => {
      const [p, e] = await Promise.all([
        supabase.from("payments").select("id, kind, amount, method, paid_on, description, is_no_show_fee, client:clients(full_name)").eq("clinic_id", clinic.id).gte("paid_on", from).lte("paid_on", to).order("paid_on", { ascending: false }),
        supabase.from("expenses").select("*").eq("clinic_id", clinic.id).is("archived_at", null).gte("spent_on", from).lte("spent_on", to).order("spent_on", { ascending: false }),
      ]);
      return { payments: p.data ?? [], expenses: e.data ?? [] };
    },
  });

  const payments = data?.payments ?? [];
  const expenses = (data?.expenses ?? []).filter((e) => cat === "all" || e.category === cat);
  const r = periodResult(payments as any, expenses);

  const rows = [
    ...(tab !== "out" && cat === "all" ? payments.map((p: any) => ({ id: p.id, date: p.paid_on, type: p.kind === "refund" ? "Estorno" : "Recebimento", desc: p.description || p.client?.full_name || "Recebimento", cat: p.is_no_show_fee ? "Taxa de falta" : "Atendimento", method: METHOD_LABEL[p.method as Method], value: p.kind === "refund" ? -Number(p.amount) : Number(p.amount), exp: null })) : []),
    ...(tab !== "in" ? expenses.map((e) => ({ id: e.id, date: e.spent_on, type: "Despesa", desc: e.description, cat: e.category, method: e.method ? METHOD_LABEL[e.method] : "", value: -Number(e.amount), exp: e })) : []),
  ].sort((a, b) => b.date.localeCompare(a.date));

  function exportCsv() {
    const csv = toCSV([["Data", "Tipo", "Descrição", "Categoria", "Forma", "Valor"], ...rows.map((x) => [d(x.date), x.type, x.desc, x.cat, x.method, x.value.toFixed(2).replace(".", ",")])]);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `financeiro_${from}_${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  async function removeExpense(id: string) {
    if (!confirm("Remover esta despesa? Ela fica registrada no histórico de auditoria.")) return;
    const { error } = await supabase.from("expenses").update({ archived_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error("Não foi possível remover.");
    toast.success("Despesa removida.");
    qc.invalidateQueries({ queryKey: ["finance"] });
  }

  const presets = [
    { l: "Este mês", f: today.slice(0, 8) + "01", t: today },
    { l: "7 dias", f: addDays(today, -6), t: today },
    { l: "30 dias", f: addDays(today, -29), t: today },
  ];

  return (
    <>
      <PageHeader title="Financeiro" description="Somente valores efetivamente recebidos contam como receita."
        actions={<>
          <Button variant="outline" onClick={() => setRecOpen(true)}><Plus className="h-4 w-4" /> Recebimento avulso</Button>
          <Button onClick={() => { setEditing(null); setExpOpen(true); }}><Plus className="h-4 w-4" /> Despesa</Button>
        </>} />

      <div className="mb-4 flex flex-wrap items-end gap-2">
        {presets.map((p) => <Button key={p.l} size="sm" variant={from === p.f && to === p.t ? "default" : "outline"} onClick={() => { setFrom(p.f); setTo(p.t); }}>{p.l}</Button>)}
        <Input type="date" className="w-40" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} aria-label="De" />
        <Input type="date" className="w-40" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} aria-label="Até" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4"><p className="text-xs text-muted-foreground">Receitas recebidas</p><p className="font-display text-2xl text-success">{formatBRL(r.revenue)}</p></div>
        <div className="rounded-2xl border bg-card p-4"><p className="text-xs text-muted-foreground">Despesas{cat !== "all" && ` · ${cat}`}</p><p className="font-display text-2xl text-destructive">{formatBRL(r.spent)}</p></div>
        <div className="rounded-2xl border bg-blush p-4"><p className="text-xs text-muted-foreground">Saldo operacional registrado</p><p className="font-display text-2xl">{formatBRL(r.result)}</p></div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Indicador simples de controle; não substitui contabilidade.</p>

      <div className="my-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg bg-muted p-0.5 text-sm">
          {([["all", "Todos"], ["in", "Receitas"], ["out", "Despesas"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)} className={cn("rounded-md px-3 py-1.5", tab === v && "bg-card font-semibold shadow-sm")}>{l}</button>
          ))}
        </div>
        <select className="h-9 rounded-md border bg-card px-3 text-sm" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoria">
          <option value="all">Todas as categorias</option>
          {cats?.all.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <Button variant="ghost" size="sm" onClick={exportCsv} disabled={!rows.length}><Download className="h-4 w-4" /> Exportar CSV</Button>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : rows.length ? (
        <div className="divide-y rounded-2xl border bg-card">
          {rows.map((x) => (
            <div key={x.type + x.id} className="flex items-center gap-3 px-4 py-3">
              <span className="w-20 shrink-0 text-sm tabular-nums text-muted-foreground">{d(x.date)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{x.desc}</p>
                <p className="truncate text-xs text-muted-foreground">{x.type} · {x.cat}{x.method && ` · ${x.method}`}</p>
              </div>
              <span className={cn("shrink-0 text-sm font-semibold tabular-nums", x.value < 0 ? "text-destructive" : "text-success")}>{formatBRL(x.value)}</span>
              {x.exp && (
                <div className="flex">
                  <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => { setEditing(x.exp); setExpOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" aria-label="Remover" onClick={() => removeExpense(x.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : <EmptyState title="Nenhum lançamento no período" description="Pagamentos são registrados no detalhe do agendamento. Despesas e recebimentos avulsos, aqui." />}

      <ExpenseDialog open={expOpen} onOpenChange={setExpOpen} initial={editing} categories={cats?.all ?? DEFAULT_EXPENSE_CATEGORIES} />
      <ReceiptDialog open={recOpen} onOpenChange={setRecOpen} />
    </>
  );
}

function ExpenseDialog({ open, onOpenChange, initial, categories }: { open: boolean; onOpenChange: (o: boolean) => void; initial: any; categories: string[] }) {
  const clinic = useClinic();
  const qc = useQueryClient();
  const blank = { description: "", category: categories[0] ?? "Outros", amount: "", spent_on: todayInTz(clinic.timezone), method: "", notes: "", newCat: "" };
  const [f, setF] = useState(blank);
  const [last, setLast] = useState(false);
  if (open !== last) {
    setLast(open);
    if (open) setF(initial ? { description: initial.description, category: initial.category, amount: String(initial.amount).replace(".", ","), spent_on: initial.spent_on, method: initial.method ?? "", notes: initial.notes ?? "", newCat: "" } : blank);
  }
  async function save() {
    const v = parseMoney(f.amount);
    if (f.description.trim().length < 2) return toast.error("Informe a descrição.");
    if (!v || v <= 0) return toast.error("Informe um valor válido.");
    let category = f.category;
    if (category === "__new") {
      if (f.newCat.trim().length < 2) return toast.error("Informe o nome da nova categoria.");
      category = f.newCat.trim();
      await supabase.from("expense_categories").insert({ clinic_id: clinic.id, name: category });
    }
    const row = { description: f.description.trim(), category, amount: v, spent_on: f.spent_on, method: (f.method || null) as Method | null, notes: f.notes.trim() || null };
    const { error } = initial ? await supabase.from("expenses").update(row).eq("id", initial.id) : await supabase.from("expenses").insert({ ...row, clinic_id: clinic.id });
    if (error) return toast.error("Não foi possível salvar.");
    toast.success("Despesa salva.");
    qc.invalidateQueries({ queryKey: ["finance"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    onOpenChange(false);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial ? "Editar despesa" : "Nova despesa"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="ed">Descrição</Label><Input id="ed" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="space-y-1.5">
            <Label htmlFor="ec">Categoria</Label>
            <select id="ec" className="h-9 w-full rounded-md border bg-card px-2 text-sm" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              <option value="__new">+ Nova categoria…</option>
            </select>
          </div>
          {f.category === "__new" ? <div className="space-y-1.5"><Label htmlFor="enc">Nome da categoria</Label><Input id="enc" value={f.newCat} onChange={(e) => setF({ ...f, newCat: e.target.value })} /></div> : <div />}
          <div className="space-y-1.5"><Label htmlFor="ea">Valor</Label><Input id="ea" inputMode="decimal" placeholder="R$ 0,00" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="edt">Data</Label><Input id="edt" type="date" value={f.spent_on} onChange={(e) => setF({ ...f, spent_on: e.target.value })} /></div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="em">Forma de pagamento <span className="text-muted-foreground">(opcional)</span></Label>
            <select id="em" className="h-9 w-full rounded-md border bg-card px-2 text-sm" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
              <option value="">—</option>
              {(Object.keys(METHOD_LABEL) as Method[]).map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="en">Observações <span className="text-muted-foreground">(opcional)</span></Label><Textarea id="en" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={save}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReceiptDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const clinic = useClinic();
  const qc = useQueryClient();
  const [f, setF] = useState({ description: "", amount: "", method: "pix" as Method, paid_on: todayInTz(clinic.timezone) });
  async function save() {
    const v = parseMoney(f.amount);
    if (f.description.trim().length < 2) return toast.error("Informe a descrição.");
    if (!v || v <= 0) return toast.error("Informe um valor válido.");
    const { error } = await supabase.from("payments").insert({ clinic_id: clinic.id, kind: "receipt", amount: v, method: f.method, paid_on: f.paid_on, description: f.description.trim() });
    if (error) return toast.error("Não foi possível salvar.");
    toast.success("Recebimento registrado.");
    qc.invalidateQueries({ queryKey: ["finance"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    setF({ ...f, description: "", amount: "" });
    onOpenChange(false);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Recebimento avulso</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="rd">Descrição</Label><Input id="rd" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="ra">Valor</Label><Input id="ra" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
          <div className="space-y-1.5">
            <Label htmlFor="rm">Forma</Label>
            <select id="rm" className="h-9 w-full rounded-md border bg-card px-2 text-sm" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value as Method })}>
              {(Object.keys(METHOD_LABEL) as Method[]).map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="rdt">Data</Label><Input id="rdt" type="date" value={f.paid_on} onChange={(e) => setF({ ...f, paid_on: e.target.value })} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={save}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
