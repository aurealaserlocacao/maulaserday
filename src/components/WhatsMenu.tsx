import { useQuery } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DEFAULT_TEMPLATES, WHATS_LABELS, fillTemplate, waLink, type WhatsData, type WhatsKind } from "@/lib/whatsapp";
import { useClinic } from "@/lib/session";

export function useTemplates() {
  const clinic = useClinic();
  return useQuery({
    queryKey: ["templates", clinic.id],
    queryFn: async () => {
      const { data } = await supabase.from("message_templates").select("kind, body").eq("clinic_id", clinic.id);
      const map = { ...DEFAULT_TEMPLATES };
      data?.forEach((t) => { if (t.kind in map) map[t.kind as WhatsKind] = t.body; });
      return map;
    },
  });
}

export function WhatsMenu({ phone, data, size = "sm" }: { phone: string; data: WhatsData; size?: "sm" | "default" }) {
  const clinic = useClinic();
  const { data: tpls } = useTemplates();
  const open = (k: WhatsKind) => {
    const text = fillTemplate((tpls ?? DEFAULT_TEMPLATES)[k], { ...data, tz: clinic.timezone });
    window.open(waLink(phone, text), "_blank", "noopener");
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size}><MessageCircle className="h-4 w-4" /> WhatsApp</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Abre o WhatsApp com a mensagem pronta — você decide enviar.</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(Object.keys(WHATS_LABELS) as WhatsKind[]).map((k) => (
          <DropdownMenuItem key={k} onClick={() => open(k)}>{WHATS_LABELS[k]}</DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
