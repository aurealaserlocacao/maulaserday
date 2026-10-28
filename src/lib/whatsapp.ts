import { formatDate, formatTime, onlyDigits, DEFAULT_TZ } from "./format";

export type WhatsKind = "confirm" | "reminder" | "pre" | "thanks" | "reschedule" | "payment";

export const WHATS_LABELS: Record<WhatsKind, string> = {
  confirm: "Confirmar agendamento",
  reminder: "Lembrar atendimento",
  pre: "Orientações pré-atendimento",
  thanks: "Agradecimento pós-atendimento",
  reschedule: "Reagendamento",
  payment: "Lembrete de pagamento",
};

export const DEFAULT_TEMPLATES: Record<WhatsKind, string> = {
  confirm:
    "Olá, {nome}! 💖\n\nPassando para confirmar seu agendamento de depilação a laser.\n\n📅 Data: {data}\n⏰ Horário: {horario}\n✨ Áreas: {areas}\n\nPor favor, me confirme se está tudo certo para o seu atendimento.\n\nCaso precise cancelar ou remarcar, peço que me avise com antecedência.\n\nAguardo sua confirmação! 😊",
  reminder: "Olá, {nome}! Lembrando do seu atendimento de depilação a laser.\n\n📅 Data: {data}\n⏰ Horário: {horario}\n✨ Áreas: {areas}\n\nTe espero! 💖",
  pre: "Olá, {nome}! Algumas orientações para o seu atendimento em {data} às {horario}:\n\n• Raspe a área 24h antes (não use cera ou pinça).\n• Evite exposição ao sol.\n• Venha com a pele limpa, sem cremes.\n\nQualquer dúvida, é só me chamar! 💖",
  thanks: "Olá, {nome}! Obrigada pelo seu atendimento hoje 💖\n\nLembre-se dos cuidados pós-laser: use protetor solar e evite sol e calor intenso nos próximos dias.\n\nAté a próxima sessão!",
  reschedule: "Olá, {nome}! Precisamos reagendar seu atendimento de {data} às {horario}. Qual dia e horário ficam melhores para você?",
  payment: "Olá, {nome}! Passando para lembrar do valor pendente referente ao atendimento de {data}. Qualquer dúvida, estou à disposição. 💖",
};

export type WhatsData = { name: string; startsAt?: string; areas?: string[]; areasNote?: string | null; tz?: string };

/** Fills placeholders. Lines whose only content is an empty {areas} are removed. */
export function fillTemplate(tpl: string, d: WhatsData) {
  const tz = d.tz ?? DEFAULT_TZ;
  const areaList = [...(d.areas ?? []), ...(d.areasNote?.trim() ? [d.areasNote.trim()] : [])];
  const areas = areaList.join(", ");
  const firstName = d.name.trim().split(/\s+/)[0] ?? d.name;
  const lines = tpl.split("\n").filter((l) => !(l.includes("{areas}") && !areas));
  return lines
    .join("\n")
    .replaceAll("{nome}", firstName)
    .replaceAll("{data}", d.startsAt ? formatDate(d.startsAt, tz) : "")
    .replaceAll("{horario}", d.startsAt ? formatTime(d.startsAt, tz) : "")
    .replaceAll("{areas}", areas);
}

export function waLink(phone: string, text: string) {
  let digits = onlyDigits(phone);
  if (digits.length <= 11) digits = "55" + digits;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
