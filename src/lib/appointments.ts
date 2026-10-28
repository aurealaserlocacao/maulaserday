import type { Database } from "@/integrations/supabase/types";

export type ApptStatus = Database["public"]["Enums"]["appointment_status"];
export type FinStatus = Database["public"]["Enums"]["financial_status"];

export const STATUS_LABEL: Record<ApptStatus, string> = {
  pending: "Aguardando confirmação",
  confirmed: "Confirmado",
  in_progress: "Em atendimento",
  completed: "Concluído",
  no_show: "Faltou",
  cancelled: "Cancelado",
};
export const STATUS_CLASS: Record<ApptStatus, string> = {
  pending: "bg-warning/20 text-warning-foreground",
  confirmed: "bg-info/15 text-info",
  in_progress: "bg-primary/15 text-primary",
  completed: "bg-success/15 text-success",
  no_show: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground line-through",
};
export const FIN_LABEL: Record<FinStatus, string> = {
  pending: "Pendente",
  partial: "Parcialmente pago",
  paid: "Pago",
  refunded: "Estornado",
};

export const DURATIONS = [15, 30, 45, 60, 90, 120];

export const COMMON_AREAS = ["Axilas", "Buço", "Virilha", "Virilha completa", "Perianal", "Meia perna", "Perna inteira", "Braços", "Rosto", "Abdômen", "Costas", "Glúteos"];

/** Allowed transitions — mirrors the database trigger. */
export const TRANSITIONS: Record<ApptStatus, ApptStatus[]> = {
  pending: ["confirmed", "in_progress", "cancelled", "no_show"],
  confirmed: ["pending", "in_progress", "cancelled", "no_show"],
  in_progress: ["completed", "confirmed"],
  completed: ["in_progress"],
  no_show: ["pending", "confirmed"],
  cancelled: ["pending", "confirmed"],
};

export function friendlyDbError(err: { code?: string; message?: string } | null | undefined) {
  if (!err) return "Erro inesperado.";
  if (err.code === "23P01") return "Já existe um agendamento nesse horário. Escolha outro horário.";
  if (err.code === "23505") return "Já existe uma cliente com esse telefone nesta clínica.";
  const m = err.message ?? "";
  if (m.includes("bloqueado")) return "Esse horário está bloqueado na agenda.";
  if (m.includes("status não permitida")) return "Essa mudança de status não é permitida.";
  if (m.includes("Telefone inválido")) return "Telefone inválido. Informe DDD + número.";
  return "Não foi possível salvar. Verifique os dados e tente novamente.";
}
