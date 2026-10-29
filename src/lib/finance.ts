import type { FinStatus } from "./appointments";

export type PaymentLike = { kind: "receipt" | "refund"; amount: number | string };

export const METHOD_LABEL = { pix: "Pix", cash: "Dinheiro", card: "Cartão", transfer: "Transferência", other: "Outro" } as const;
export type Method = keyof typeof METHOD_LABEL;

export const DEFAULT_EXPENSE_CATEGORIES = ["Aluguel da máquina", "Papel de maca", "Gel condutor", "Materiais descartáveis", "Marketing", "Energia", "Outros"];

/** Net received = receipts − refunds. Expected amounts never enter here. */
export function netReceived(payments: PaymentLike[]) {
  return round(payments.reduce((s, p) => s + (p.kind === "refund" ? -1 : 1) * Number(p.amount), 0));
}

/** Mirrors public.compute_fin_status in the database. */
export function computeFinStatus(payments: PaymentLike[], finalAmount: number | null): FinStatus {
  const net = netReceived(payments);
  const refunded = payments.some((p) => p.kind === "refund");
  if (net <= 0) return refunded ? "refunded" : "pending";
  if (finalAmount == null || net >= finalAmount) return "paid";
  return "partial";
}

export function balanceDue(payments: PaymentLike[], finalAmount: number | null) {
  if (finalAmount == null) return 0;
  return Math.max(0, round(finalAmount - netReceived(payments)));
}

export function periodResult(payments: PaymentLike[], expenses: { amount: number | string }[]) {
  const revenue = netReceived(payments);
  const spent = round(expenses.reduce((s, e) => s + Number(e.amount), 0));
  return { revenue, spent, result: round(revenue - spent) };
}

export function parseMoney(s: string): number | null {
  const t = s.trim().replace(/[R$\s]/g, "");
  if (!t) return null;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return isNaN(n) ? NaN : n;
}

const round = (n: number) => Math.round(n * 100) / 100;

export function toCSV(rows: (string | number)[][]) {
  return "\uFEFF" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
}
