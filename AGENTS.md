<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Laser Day Pro architecture
- Multi-tenant isolation lives in RLS via `public.is_clinic_member(clinic_id)` (active membership + clinic not suspended); never rely on UI filters. Why: brief requires backend-enforced isolation.
- Admin role is `platform_admin` in `user_roles`, checked with `has_role`; privileged admin actions go through `src/lib/admin.functions.ts` server functions that verify the role before using the admin client. Why: no privilege escalation via profile edits.
- Appointment conflicts are blocked by a Postgres EXCLUDE constraint plus a trigger for blocked times; status transitions are validated in the `appointment_before` trigger and mirrored in `src/lib/appointments.ts`. Why: safe under concurrent requests.
- Times are stored as timestamptz and converted with helpers in `src/lib/format.ts` using the clinic timezone. Why: avoid date shifts.
