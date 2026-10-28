import { createFileRoute } from "@tanstack/react-router";
import { SetPasswordCard } from "@/components/SetPasswordCard";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({
    meta: [
      { title: "Nova senha — Laser Day Pro" },
      { name: "description", content: "Defina uma nova senha de acesso." },
      { property: "og:title", content: "Nova senha — Laser Day Pro" },
      { property: "og:description", content: "Defina uma nova senha de acesso." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <SetPasswordCard title="Criar nova senha" />,
});
