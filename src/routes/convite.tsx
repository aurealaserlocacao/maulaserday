import { createFileRoute } from "@tanstack/react-router";
import { SetPasswordCard } from "@/components/SetPasswordCard";

export const Route = createFileRoute("/convite")({
  head: () => ({
    meta: [
      { title: "Aceitar convite — Laser Day Pro" },
      { name: "description", content: "Crie sua senha para acessar a agenda da clínica." },
      { property: "og:title", content: "Aceitar convite — Laser Day Pro" },
      { property: "og:description", content: "Crie sua senha para acessar a agenda da clínica." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <SetPasswordCard title="Bem-vinda! Crie sua senha" invite />,
});
