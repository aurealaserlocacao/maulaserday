import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

async function assertAdmin(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "platform_admin" });
  if (error || !data) throw new Error("Não autorizado");
}

async function audit(admin: any, actor: string, clinic: string | null, action: string, entityId: string | null, meta: Record<string, unknown> = {}) {
  await admin.from("audit_logs").insert({ actor_id: actor, clinic_id: clinic, action, entity: "clinic", entity_id: entityId, metadata: meta });
}

function slugify(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);
}

const clinicSchema = z.object({
  name: z.string().trim().min(2).max(120),
  owner_name: z.string().trim().min(2).max(120),
  contact_email: z.string().trim().email().max(200),
  phone: z.string().trim().max(30).optional().nullable(),
  business_info: z.string().trim().max(500).optional().nullable(),
  admin_notes: z.string().trim().max(2000).optional().nullable(),
  equipment: z.string().trim().max(120).optional().nullable(),
  starts_on: z.string().optional().nullable(),
  ends_on: z.string().optional().nullable(),
  redirectTo: z.string().url(),
});

export const createClinicAndInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => clinicSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.contact_email.toLowerCase();

    let slug = slugify(data.name) || "clinica";
    const { data: exists } = await supabaseAdmin.from("clinics").select("id").eq("slug", slug).maybeSingle();
    if (exists) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

    const { data: clinic, error } = await supabaseAdmin
      .from("clinics")
      .insert({ name: data.name, owner_name: data.owner_name, contact_email: email, phone: data.phone || null, business_info: data.business_info || null, admin_notes: data.admin_notes || null, slug })
      .select("id")
      .single();
    if (error || !clinic) throw new Error("Não foi possível criar a clínica");

    if (data.equipment) {
      await supabaseAdmin.from("rentals").insert({ clinic_id: clinic.id, equipment: data.equipment, starts_on: data.starts_on || null, ends_on: data.ends_on || null });
    }
    await audit(supabaseAdmin, context.userId, clinic.id, "admin.clinic_created", clinic.id, { name: data.name });

    const inv = await inviteOrLink(supabaseAdmin, email, clinic.id, data.redirectTo, data.owner_name);
    await audit(supabaseAdmin, context.userId, clinic.id, "admin.invite_sent", clinic.id, { status: inv.status });
    return { clinicId: clinic.id, invite: inv };
  });

async function inviteOrLink(admin: any, email: string, clinicId: string, redirectTo: string, fullName?: string) {
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: { full_name: fullName ?? "" } });
  let userId: string | undefined = data?.user?.id;
  let status: "invited" | "existing_user" = "invited";
  if (error) {
    // User already exists: just link and send a password-reset style email.
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const u = list?.users?.find((x: any) => x.email?.toLowerCase() === email);
    if (!u) throw new Error("Não foi possível enviar o convite: " + error.message);
    userId = u.id;
    status = "existing_user";
    await admin.auth.resetPasswordForEmail(email, { redirectTo });
  }
  await admin.from("clinic_memberships").upsert(
    { user_id: userId, clinic_id: clinicId, role: "owner", active: true, invited_at: new Date().toISOString() },
    { onConflict: "user_id,clinic_id" },
  );
  return { status };
}

export const resendInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ clinicId: z.string().uuid(), redirectTo: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: c } = await supabaseAdmin.from("clinics").select("contact_email, owner_name").eq("id", data.clinicId).single();
    if (!c?.contact_email) throw new Error("Clínica sem e-mail");
    const inv = await inviteOrLink(supabaseAdmin, c.contact_email, data.clinicId, data.redirectTo, c.owner_name ?? undefined);
    await audit(supabaseAdmin, context.userId, data.clinicId, "admin.invite_resent", data.clinicId, { status: inv.status });
    return inv;
  });

export const setClinicAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ clinicId: z.string().uuid(), status: z.enum(["active", "suspended"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("clinics").update({ access_status: data.status }).eq("id", data.clinicId);
    if (error) throw new Error("Falha ao atualizar acesso");
    await audit(supabaseAdmin, context.userId, data.clinicId, data.status === "active" ? "admin.access_reactivated" : "admin.access_suspended", data.clinicId);
    return { ok: true };
  });

const updateSchema = z.object({
  clinicId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  owner_name: z.string().trim().max(120).nullable(),
  phone: z.string().trim().max(30).nullable(),
  business_info: z.string().trim().max(500).nullable(),
  admin_notes: z.string().trim().max(2000).nullable(),
});
export const updateClinicAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { clinicId, ...rest } = data;
    const { error } = await supabaseAdmin.from("clinics").update(rest).eq("id", clinicId);
    if (error) throw new Error("Falha ao salvar");
    await audit(supabaseAdmin, context.userId, clinicId, "admin.clinic_updated", clinicId);
    return { ok: true };
  });

const rentalSchema = z.object({
  id: z.string().uuid().optional(),
  clinicId: z.string().uuid(),
  equipment: z.string().trim().min(1).max(120),
  starts_on: z.string().nullable(),
  ends_on: z.string().nullable(),
  status: z.enum(["active", "ended", "pending"]),
  notes: z.string().trim().max(1000).nullable(),
});
export const saveRental = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rentalSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = { clinic_id: data.clinicId, equipment: data.equipment, starts_on: data.starts_on || null, ends_on: data.ends_on || null, status: data.status, notes: data.notes, updated_at: new Date().toISOString() };
    const res = data.id
      ? await supabaseAdmin.from("rentals").update(row).eq("id", data.id).eq("clinic_id", data.clinicId)
      : await supabaseAdmin.from("rentals").insert(row);
    if (res.error) throw new Error("Falha ao salvar locação");
    await audit(supabaseAdmin, context.userId, data.clinicId, data.status === "ended" ? "admin.rental_ended" : "admin.rental_saved", data.clinicId);
    return { ok: true };
  });

/** Aggregated, non-personal indicators for the admin dashboard. */
export const adminStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const [clinics, appts] = await Promise.all([
      supabaseAdmin.from("clinics").select("id, access_status"),
      supabaseAdmin.from("appointments").select("clinic_id", { count: "exact", head: false }).gte("starts_at", since),
    ]);
    const perClinic: Record<string, number> = {};
    (appts.data ?? []).forEach((a: any) => (perClinic[a.clinic_id] = (perClinic[a.clinic_id] ?? 0) + 1));
    return {
      total: clinics.data?.length ?? 0,
      active: clinics.data?.filter((c: any) => c.access_status === "active").length ?? 0,
      suspended: clinics.data?.filter((c: any) => c.access_status === "suspended").length ?? 0,
      appointments30d: appts.data?.length ?? 0,
      perClinic,
    };
  });
