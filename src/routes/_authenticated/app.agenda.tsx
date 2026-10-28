import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { AppointmentForm } from "@/components/AppointmentForm";
import { AppointmentSheet } from "@/components/AppointmentSheet";
import { STATUS_LABEL, type ApptStatus } from "@/lib/appointments";
import { useClinic } from "@/lib/session";
import { addDays, dayRange, formatDate, formatDayLabel, formatPhone, formatTime, isoDateInTz, onlyDigits, todayInTz, weekStart } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/agenda")({
  head: () => ({ meta: [{ title: "Agenda — Laser Day Pro" }, { name: "description", content: "Agenda de atendimentos." }] }),
  component: Agenda,
});

type View = "day" | "week" | "list";

function Agenda() {
  const clinic = useClinic();
  const tz = clinic.timezone;
  const [view, setView] = useState<View>("day");
  const [date, setDate] = useState(todayInTz(tz));
  const [status, setStatus] = useState<ApptStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const range = useMemo(() => {
    if (view === "day") return { start: date, days: 1 };
    if (view === "week") return { start: weekStart(date), days: 7 };
    return { start: date, days: 30 };
  }, [view, date]);

  const { data, isLoading } = useQuery({
    queryKey: ["appointments", clinic.id, range.start, range.days],
    queryFn: async () => {
      const from = dayRange(range.start, tz).from;
      const to = dayRange(addDays(range.start, range.days - 1), tz).to;
      const { data } = await supabase
        .from("appointments")
        .select("id, starts_at, ends_at, status, areas, areas_note, client:clients(full_name, phone, phone_normalized)")
        .eq("clinic_id", clinic.id).gte("starts_at", from).lt("starts_at", to).order("starts_at");
      return data ?? [];
    },
  });

  const filtered = (data ?? []).filter((a) => {
    if (status !== "all" && a.status !== status) return false;
    const s = search.trim().toLowerCase();
    if (!s) return true;
    const c = a.client as any;
    const d = onlyDigits(s);
    return c?.full_name?.toLowerCase().includes(s) || (d.length >= 3 && c?.phone_normalized?.includes(d));
  });

  const step = view === "day" ? 1 : view === "week" ? 7 : 30;
  const days = Array.from({ length: range.days }, (_, i) => addDays(range.start, i));
  const byDay = (d: string) => filtered.filter((a) => isoDateInTz(a.starts_at, tz) === d);

  const label = view === "day" ? formatDayLabel(date) : `${formatDate(range.start + "T12:00:00Z")} – ${formatDate(addDays(range.start, range.days - 1) + "T12:00:00Z")}`;

  return (
    <>
      <PageHeader title="Agenda" actions={<Button onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> Novo</Button>} />

      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg bg-muted p-0.5 text-sm">
            {(["day", "week", "list"] as View[]).map((v) => (
              <button key={v} onClick={() => setView(v)} className={cn("rounded-md px-3 py-1.5", view === v && "bg-card font-semibold shadow-sm")}>
                {v === "day" ? "Dia" : v === "week" ? "Semana" : "Lista"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" aria-label="Anterior" onClick={() => setDate(addDays(date, -step))}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => setDate(todayInTz(tz))}>Hoje</Button>
            <Button variant="outline" size="icon" aria-label="Próximo" onClick={() => setDate(addDays(date, step))}><ChevronRight className="h-4 w-4" /></Button>
            <Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-40" aria-label="Ir para data" />
          </div>
        </div>
        <p className="font-display text-lg capitalize">{label}</p>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-48 flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar cliente por nome ou telefone" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="h-9 rounded-md border bg-card px-3 text-sm" aria-label="Filtrar status">
            <option value="all">Todos os status</option>
            {(Object.keys(STATUS_LABEL) as ApptStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </div>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : view === "week" ? (
        <div className="grid gap-3 md:grid-cols-7">
          {days.map((d) => (
            <div key={d} className={cn("rounded-2xl border bg-card p-2", d === todayInTz(tz) && "border-primary")}>
              <button onClick={() => { setDate(d); setView("day"); }} className="mb-2 w-full text-left text-xs font-semibold capitalize text-muted-foreground hover:text-foreground">
                {formatDayLabel(d).split(",")[0]} {d.slice(8)}
              </button>
              <div className="space-y-1.5">
                {byDay(d).map((a) => <ApptChip key={a.id} a={a} tz={tz} onClick={() => setOpenId(a.id)} compact />)}
                {byDay(d).length === 0 && <p className="px-1 text-xs text-muted-foreground">—</p>}
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState title="Nenhum agendamento" description="Não há agendamentos para esse período e filtros." action={<Button size="sm" onClick={() => setNewOpen(true)}>Novo agendamento</Button>} />
      ) : (
        <div className="space-y-5">
          {days.filter((d) => byDay(d).length).map((d) => (
            <div key={d}>
              {view === "list" && <p className="mb-2 text-sm font-semibold capitalize text-muted-foreground">{formatDayLabel(d)}</p>}
              <div className="space-y-2">{byDay(d).map((a) => <ApptChip key={a.id} a={a} tz={tz} onClick={() => setOpenId(a.id)} />)}</div>
            </div>
          ))}
        </div>
      )}

      <AppointmentForm open={newOpen} onOpenChange={setNewOpen} defaultDate={view === "day" ? date : undefined} />
      <AppointmentSheet id={openId} onOpenChange={(o) => !o && setOpenId(null)} />
    </>
  );
}

function ApptChip({ a, tz, onClick, compact }: { a: any; tz: string; onClick: () => void; compact?: boolean }) {
  const areas = [...(a.areas ?? []), a.areas_note].filter(Boolean).join(", ");
  if (compact)
    return (
      <button onClick={onClick} className={cn("w-full rounded-lg bg-secondary px-2 py-1.5 text-left text-xs hover:brightness-95", (a.status === "cancelled" || a.status === "no_show") && "opacity-60")}>
        <p className="font-semibold tabular-nums">{formatTime(a.starts_at, tz)}</p>
        <p className="truncate">{a.client?.full_name}</p>
      </button>
    );
  return (
    <button onClick={onClick} className={cn("flex w-full items-center gap-4 rounded-2xl border bg-card px-4 py-3 text-left hover:shadow-soft", (a.status === "cancelled" || a.status === "no_show") && "opacity-70")}>
      <div className="w-16 shrink-0 tabular-nums">
        <p className="font-semibold">{formatTime(a.starts_at, tz)}</p>
        <p className="text-xs text-muted-foreground">{formatTime(a.ends_at, tz)}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{a.client?.full_name}</p>
        <p className="truncate text-xs text-muted-foreground">{formatPhone(a.client?.phone ?? "")}{areas && ` · ${areas}`}</p>
      </div>
      <StatusBadge status={a.status} />
    </button>
  );
}
