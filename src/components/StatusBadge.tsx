import { STATUS_CLASS, STATUS_LABEL, type ApptStatus } from "@/lib/appointments";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: ApptStatus }) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_CLASS[status])}>{STATUS_LABEL[status]}</span>;
}
