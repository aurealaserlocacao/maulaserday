import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { meQuery } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({ meta: [{ title: "Laser Day Pro" }, { name: "description", content: "Redirecionando para sua área." }] }),
  loader: async ({ context }) => {
    const me = await context.queryClient.fetchQuery(meQuery);
    if (me.clinic && me.membershipActive && me.clinic.access_status === "active") throw redirect({ to: "/app" });
    if (me.isAdmin) throw redirect({ to: "/admin" });
    return { suspended: me.clinic?.access_status === "suspended" || (me.clinic && !me.membershipActive) };
  },
  component: Blocked,
});

function Blocked() {
  const { suspended } = Route.useLoaderData();
  return (
    <div className="flex min-h-screen items-center justify-center bg-blush px-4">
      <div className="max-w-md rounded-2xl border bg-card p-7 text-center shadow-soft">
        <h1 className="text-2xl">{suspended ? "Acesso suspenso" : "Conta sem clínica vinculada"}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {suspended
            ? "O acesso da sua clínica está temporariamente suspenso. Seus dados foram preservados. Entre em contato com a locadora para reativar."
            : "Sua conta ainda não está autorizada a acessar nenhuma clínica. Fale com a locadora para receber um convite."}
        </p>
        <Button className="mt-6" variant="outline" asChild>
          <Link to="/auth" onClick={() => supabase.auth.signOut()}>Sair</Link>
        </Button>
      </div>
    </div>
  );
}
