-- Prestazioni segnalate dall'advisor di Supabase.
-- 1) auth.uid() nelle regole di accesso calcolato una volta per richiesta, non per ogni riga: (select auth.uid()).
--    Stesse regole, stesso risultato.
alter policy profiles_select on public.profiles
  using (org_id = app.me_org() and (id = (select auth.uid()) or app.has_role('super_admin','admin','responsabile')));
alter policy profiles_update_self on public.profiles
  using (id = (select auth.uid()) and active) with check (id = (select auth.uid()));
alter policy project_members_select on public.project_members
  using (org_id = app.me_org() and (user_id = (select auth.uid()) or app.has_role('super_admin','admin','responsabile')));
alter policy counterparties_insert on public.counterparties
  with check (org_id = app.me_org() and app.has_role('super_admin','admin','responsabile','operator')
              and created_by = (select auth.uid()));
alter policy documents_select on public.documents
  using (org_id = app.me_org() and (
       uploaded_by = (select auth.uid())
    or app.has_role('super_admin','admin','responsabile','read_only')
    or exists (select 1 from public.movement_documents md join public.movements m on m.id = md.movement_id
               where md.document_id = documents.id and app.can_see_movement(m))));
alter policy sync_select on public.sync_log
  using (org_id = app.me_org() and (user_id = (select auth.uid()) or app.has_role('super_admin','admin')));

-- 2) indici sulle chiavi usate dai filtri e dai rendiconti (le altre chiavi segnalate sono colonne di traccia, poco usate)
create index if not exists movements_counterparty_idx on public.movements(counterparty_id) where counterparty_id is not null;
create index if not exists movements_method_idx on public.movements(payment_method_id) where payment_method_id is not null;
create index if not exists grants_donor_idx on public.grants(donor_id) where donor_id is not null;
create index if not exists budget_lines_group_idx on public.budget_lines(group_id);
