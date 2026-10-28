import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { LayoutDashboard, CalendarDays, Users, Settings } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { meQuery, useClinic } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/app")({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.fetchQuery(meQuery);
    if (!me.clinic || !me.membershipActive || me.clinic.access_status !== "active") throw redirect({ to: "/inicio" });
  },
  component: ClinicLayout,
});

const nav = [
  { to: "/app", label: "Painel", icon: LayoutDashboard, exact: true },
  { to: "/app/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/app/clientes", label: "Clientes", icon: Users },
  { to: "/app/configuracoes", label: "Ajustes", icon: Settings },
];

function ClinicLayout() {
  const clinic = useClinic();
  return (
    <AppShell title={clinic.name} subtitle="Área da clínica" nav={nav}>
      <Outlet />
    </AppShell>
  );
}
