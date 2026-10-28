import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { LayoutDashboard, Building2, ScrollText } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { meQuery } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.fetchQuery(meQuery);
    if (!me.isAdmin) throw redirect({ to: "/inicio" });
  },
  component: () => (
    <AppShell title="Painel da locadora" subtitle="Administração" nav={nav}>
      <Outlet />
    </AppShell>
  ),
});

const nav = [
  { to: "/admin", label: "Painel", icon: LayoutDashboard, exact: true },
  { to: "/admin/clinicas", label: "Clínicas", icon: Building2 },
  { to: "/admin/auditoria", label: "Auditoria", icon: ScrollText },
];
