import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { COMMON_AREAS, DURATIONS, friendlyDbError } from "@/lib/appointments";
import { addMinutesToTime, formatPhone, isoDateInTz, timeInTz, zonedToISO, onlyDigits } from "@/lib/format";
import { useClinic } from "@/lib/session";
import { cn } from "@/lib/utils";

export type ApptEditable = {
  id: string;
  client_id: string;
  starts_at: string;
  duration_min: number;
  areas: string[];
  areas_note: string | null;
  expected_amount: number | null;
  internal_notes: string | null;
  client?: { full_name: string; phone: string } | null;
};

export function AppointmentForm({ open, onOpenChange, initial, defaultDate, defaultClientId }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: ApptEditable | null;
  defaultDate?: string | undefined;
  defaultClientId?: string;
}) {
  const clinic = useClinic();
  const qc = useQueryClient();
  const tz = clinic.timezone;
  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [clientSearch, setClientSearch] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState<number>(clinic.default_duration_min);
  const [custom, setCustom] = useState(false);
  const [areas, setAreas] = useState<string[]>([]);
  const [areasNote, setAreasNote] = useState("");
  const [expected, setExpected] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setClientMode("existing");
      setClientId(initial.client_id);
      setClientSearch(initial.client?.full_name ?? "");
      setDate(isoDateInTz(initial.starts_at, tz));
      setTime(timeInTz(initial.starts_at, tz));
      setDuration(initial.duration_min);
      setCustom(!DURATIONS.includes(initial.duration_min));
      setAreas(initial.areas ?? []);
      setAreasNote(initial.areas_note ?? "");
      setExpected(initial.expected_amount != null ? String(initial.expected_amount).replace(".", ",") : "");
      setNotes(initial.internal_notes ?? "");
    } else {
      setClientMode("existing");
      setClientId(defaultClientId ?? "");
      setClientSearch("");
      setNewName(""); setNewPhone("");
      setDate(defaultDate ?? isoDateInTz(new Date(), tz));
      setTime("09:00");
      setDuration(clinic.default_duration_min);
      setCustom(!DURATIONS.includes(clinic.default_duration_min));
      setAreas([]); setAreasNote(""); setExpected(""); setNotes("");
    }
  }, [open, initial, defaultDate, defaultClientId, tz, clinic.default_duration_min]);

  const { data: clients } = useQuery({
    queryKey: ["clients-search", clinic.id, clientSearch],
    enabled: open && clientMode === "existing",
    queryFn: async () => {
      let q = supabase.from("clients").select("id, full_name, phone").eq("clinic_id", clinic.id).is("archived_at", null).order("full_name").limit(8);
      const s = clientSearch.trim();
      if (s) {
        const digits = onlyDigits(s);
        q = digits.length >= 3 ? q.ilike("phone_normalized", `%${digits}%`) : q.ilike("full_name", `%${s}%`);
      }
      return (await q).data ?? [];
    },
  });

  const endTime = useMemo(() => addMinutesToTime(time, duration || 0), [time, duration]);

  function toggleArea(a: string) {
    setAreas((cur) => (cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]));
  }

  async function save() {
    if (!date || !time) return toast.error("Informe data e horário.");
    if (!duration || duration < 5) return toast.error("Informe uma duração válida.");
    const exp = expected.trim() ? Number(expected.replace(/\./g, "").replace(",", ".")) : null;
    if (exp != null && (isNaN(exp) || exp < 0)) return toast.error("Valor previsto inválido.");
    setSaving(true);
    try {
      let cid = clientId;
      if (clientMode === "new") {
        if (newName.trim().length < 2) throw new Error("Informe o nome da cliente.");
        if (onlyDigits(newPhone).length < 10) throw new Error("Informe o telefone com DDD.");
        const { data: existing } = await supabase.from("clients").select("id, full_name").eq("clinic_id", clinic.id).eq("phone_normalized", onlyDigits(newPhone)).maybeSingle();
        if (existing) {
          cid = existing.id;
          toast.info(`Telefone já cadastrado para ${existing.full_name}. Usando esse cadastro.`);
        } else {
          const { data: c, error } = await supabase.from("clients").insert({ clinic_id: clinic.id, full_name: newName.trim(), phone: newPhone.trim(), phone_normalized: "" }).select("id").single();
          if (error) throw new Error(friendlyDbError(error));
          cid = c.id;
        }
      }
      if (!cid) throw new Error("Selecione ou cadastre a cliente.");
      const payload = {
        client_id: cid,
        starts_at: zonedToISO(date, time, tz),
        duration_min: duration,
        ends_at: zonedToISO(date, time, tz), // recalculated by the database
        areas,
        areas_note: areasNote.trim() || null,
        expected_amount: exp,
        internal_notes: notes.trim() || null,
      };
      const { error } = initial
        ? await supabase.from("appointments").update(payload).eq("id", initial.id)
        : await supabase.from("appointments").insert({ ...payload, clinic_id: clinic.id });
      if (error) throw new Error(friendlyDbError(error));
      toast.success(initial ? "Agendamento atualizado." : "Agendamento criado.");
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["appointment"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["client"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar agendamento" : "Novo agendamento"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Cliente</Label>
              {!initial && (
                <div className="flex rounded-lg bg-muted p-0.5 text-xs">
                  {(["existing", "new"] as const).map((m) => (
                    <button key={m} type="button" onClick={() => setClientMode(m)} className={cn("rounded-md px-2.5 py-1", clientMode === m && "bg-card shadow-sm font-semibold")}>
                      {m === "existing" ? "Existente" : "Nova cliente"}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {clientMode === "existing" ? (
              <>
                <Input placeholder="Buscar por nome ou telefone" value={clientSearch} onChange={(e) => { setClientSearch(e.target.value); }} />
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {clients?.map((c) => (
                    <button key={c.id} type="button" onClick={() => { setClientId(c.id); setClientSearch(c.full_name); }}
                      className={cn("flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm", clientId === c.id ? "border-primary bg-secondary" : "hover:bg-muted")}>
                      <span>{c.full_name}</span><span className="text-xs text-muted-foreground">{formatPhone(c.phone)}</span>
                    </button>
                  ))}
                  {clients && clients.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma cliente encontrada. Use "Nova cliente".</p>}
                </div>
              </>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                <Input placeholder="Nome completo" value={newName} onChange={(e) => setNewName(e.target.value)} />
                <Input placeholder="WhatsApp com DDD" inputMode="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
              </div>
            )}
          </section>

          <section className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label htmlFor="d">Data</Label><Input id="d" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="t">Início</Label><Input id="t" type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} /></div>
          </section>

          <section className="space-y-2">
            <Label>Duração estimada</Label>
            <div className="flex flex-wrap gap-1.5">
              {DURATIONS.map((d) => (
                <button key={d} type="button" onClick={() => { setDuration(d); setCustom(false); }}
                  className={cn("rounded-full border px-3 py-1 text-sm", !custom && duration === d ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>
                  {d} min
                </button>
              ))}
              <button type="button" onClick={() => setCustom(true)} className={cn("rounded-full border px-3 py-1 text-sm", custom ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>Outra</button>
            </div>
            {custom && <Input type="number" min={5} max={720} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-32" aria-label="Duração em minutos" />}
            <p className="text-sm text-muted-foreground">Término previsto: <strong className="text-foreground">{endTime}</strong></p>
          </section>

          <section className="space-y-2">
            <Label>Áreas previstas <span className="text-muted-foreground">(opcional)</span></Label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_AREAS.map((a) => (
                <button key={a} type="button" onClick={() => toggleArea(a)}
                  className={cn("rounded-full border px-3 py-1 text-xs", areas.includes(a) ? "border-accent-foreground/30 bg-accent text-accent-foreground font-semibold" : "hover:bg-muted")}>
                  {a}
                </button>
              ))}
            </div>
            <Input placeholder="Outras áreas (texto livre)" value={areasNote} onChange={(e) => setAreasNote(e.target.value)} />
          </section>

          <section className="space-y-1.5">
            <Label htmlFor="exp">Valor previsto <span className="text-muted-foreground">(opcional — não conta como receita)</span></Label>
            <Input id="exp" inputMode="decimal" placeholder="R$ 0,00" value={expected} onChange={(e) => setExpected(e.target.value)} />
          </section>

          <section className="space-y-1.5">
            <Label htmlFor="n">Observações internas <span className="text-muted-foreground">(opcional)</span></Label>
            <Textarea id="n" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </section>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
