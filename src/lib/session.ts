import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MeData = {
  userId: string;
  email: string | null;
  isAdmin: boolean;
  clinic: {
    id: string;
    name: string;
    timezone: string;
    default_duration_min: number;
    access_status: "active" | "suspended";
    phone: string | null;
    address: string | null;
  } | null;
  membershipActive: boolean;
};

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async (): Promise<MeData> => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error("Sessão expirada");
    const [{ data: roles }, { data: mems }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", u.user.id),
      supabase
        .from("clinic_memberships")
        .select("active, clinic:clinics(id,name,timezone,default_duration_min,access_status,phone,address)")
        .eq("user_id", u.user.id)
        .limit(1),
    ]);
    const m = mems?.[0];
    return {
      userId: u.user.id,
      email: u.user.email ?? null,
      isAdmin: !!roles?.some((r) => r.role === "platform_admin"),
      clinic: (m?.clinic as MeData["clinic"]) ?? null,
      membershipActive: !!m?.active,
    };
  },
  staleTime: 60_000,
});

export function useMe() {
  return useSuspenseQuery(meQuery).data;
}

/** Clinic data for the current member; throws when unavailable (guarded by the /app layout). */
export function useClinic() {
  const me = useMe();
  if (!me.clinic) throw new Error("Sem clínica");
  return me.clinic;
}
