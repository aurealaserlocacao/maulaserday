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

## Change log conventions for Lovable sync
- Keep implementation in focused commits with Conventional Commit-style messages so Lovable sessions can identify the intent (for example, `feat(clinic-navigation): ...` or `feat(admin-finance): ...`).
- Add a concise implementation note here or under `.lovable/plan/` when navigation, admin workflows, or database behavior changes.
- Preserve existing routes and business data; avoid production migrations unless a schema change is necessary and documented.

## Implementation notes
- Clinic home/navigation: `/app` redirects to `/app/agenda`; the previous dashboard is available at `/app/visao-geral`.
- Admin operational-finance indicators are documented in `.lovable/plan/2026-10-30-admin-finance-and-agenda.md`; preserve the server-side admin guard and the distinction between received and expected values.

- Admin Laser Day finance: preserve `adminLaserDayEvents` grouping by clinic-local appointment date and keep each event distinct; see `.lovable/plan/2026-10-30-admin-finance-and-agenda.md` for metric definitions and limitations.
