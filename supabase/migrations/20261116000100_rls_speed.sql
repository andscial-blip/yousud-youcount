-- Velocità (16/11): le regole di accesso valutavano a ogni riga le funzioni sull'utente (organizzazione, ruolo),
-- e nei collegamenti ai movimenti ripetevano il controllo del movimento. Con (select …) Postgres le calcola una volta
-- per interrogazione; il controllo sul movimento lo fa già la regola di movements quando la sottointerrogazione la legge.
-- Stesso significato di prima, nessun cambio di permessi. Misura locale: conteggio di 1.017 movimenti da 154 ms a 2 ms.

alter policy accounts_insert on public.accounts with check (((org_id = (select app.me_org())) AND (select app.has_role(VARIADIC ARRAY['super_admin'::app_role, 'admin'::app_role]))));
alter policy accounts_select on public.accounts using ((org_id = (select app.me_org())));
alter policy accounts_update on public.accounts using (((org_id = (select app.me_org())) AND (select app.has_role(VARIADIC ARRAY['super_admin'::app_role, 'admin'::app_role])))) with check (((org_id = (select app.me_org())) AND (select app.has_role(VARIADIC ARRAY['super_admin'::app_role, 'admin'::app_role]))));
alter policy api_clients_select on public.api_clients using (((org_id = (select app.me_org())) AND (select app.has_role(VARIADIC ARRAY['super_admin'::app_role, 'admin'::app_role]))));
alter policy audit_select on public.audit_log using (((org_id = (select app.me_org())) AND (select app.has_role(VARIADIC ARRAY['super_admin'::app_role, 'admin'::app_role]))));
alter policy bank_rec_select on public.bank_reconciliations using ((org_id = (select app.me_org())));
alter policy budget_delete on public.budget_lines using (((org_id = (select app.me_org())) AND (select app.has_role(VARIADIC ARRAY['super_admin'::app_role, 'admin'::app_role, 'responsabile'::app_role]))));
alter policy budget_insert on public.budget_lines with check (((org_id = (select app.me_org())) AND (select app.has_role(VARIADIC ARRAY['super_admin'::app_role, 'admin'::app_role, 'responsabile'::app_role]))));
alter policy budget_select on public.budget_lines using (((org_id = (select app.me_org())) AND (select app.has_role(VARIADIC ARRAY['super_admin'::app_role, 'admin'::app_role, 'responsabile'::app_role, 'read_only'::app_role]))));
alter policy budget_update on public.budget_lines using (((org_id = (select app.me_org())) AND (select app.has_role(VARIADIC ARRAY['super_admin'::app_role, 'admin'::app_role, 'responsabile'::app_role])))) with check ((org_id = (select app.me_org())));
alter policy cash_select on public.cash_counts using ((org_id = (select app.me_org())));
alter policy categories_insert on public.categories with check (((org_id = (select app.me_org())) AND (select app.has_role(VARIADIC ARRAY['super_admin'::app_role, 'admin'::app_role]))));
alter policy categories_select on public.categories using ((org_id = (select app.me_org())));
alter policy categories_update on public.categories using (((org_id = (select app.me_org())) AND (select app.has_role(VARIADIC ARRAY['super_admin'::app_role, 'admin'::app_role])))) with check (((org_id = (select app.me_org())) AND (select app.has_role(VARIADIC ARRAY['super_admin'::app_role, 'admin'::app_role]))));
alter policy category_groups_insert on public.category_groups with check (((org_id = (select app.me_org())) AND (select app.has_role(VARIADIC ARRAY['super_admin'::app_role, 'admin'::app_role]))));
alter policy category_groups_select on public.category_groups using ((org_id = (select app.me_org())));
alter policy category_groups_update on public.category_groups using (((org_id = (select app.me_org())) AND (select app.has_role(VARIADIC ARRAY['super_admin'::app_role, 'admin'::app_role])))) with check (((org_id = (select app.me_org())) AND (select app.has_role(VARIADIC ARRAY['super_admin'::app_role, 'admin'::app_role]))));
alter policy counterparties_insert on public.counterparties with check (((org_id = (select app.me_org())) AND (select app.has_role(VARIADIC ARRAY['super_admin'::app_role, 'admin'::app_role, 'responsabile'::app_role, 'operator'::app_role])) AND (created_by = ( SELECT auth.uid() AS uid))));
alter policy counterparties_select on public.counterparties using ((org_id = (select app.me_org())));
alter policy counterparties_update on public.counterparties using (((org_id = (select app.me_org())) AND (select app.has_role(VARIADIC ARRAY['super_admin'::app_role, 'admin'::app_role, 'responsabile'::app_role])))) with check ((org_id = (select app.me_org())));
alter policy counterparty_logos_select on public.counterparty_logos using ((org_id = (select app.me_org())));
alter policy cp_private_all on public.counterparty_private using (((org_id = (select app.me_org())) AND (select app.has_role(VARIADIC ARRAY['super_admin'::app_role, 'admin'::app_role, 'responsabile'::app_role])))) with check (((org_id = (select app.me_org())) AND (select app.has_role(VARIADIC ARRAY['super_admin'::app_role, 'admin'::app_role, 'responsabile'::app_role]))));
alter policy documents_select on public.documents using (((org_id = (select app.me_org())) AND ((uploaded_by = ( SELECT auth.uid() AS uid)) OR (select app.has_role(VARIADIC ARRAY['super_admin'::app_role, 'admin'::app_role, 'responsabile'::app_role, 'read_only'::app_role])) OR (EXISTS ( SELECT 1
   FROM (movement_documents md
     JOIN movements m ON ((m.id = md.movement_id)))
  WHERE ((md.document_id = documents.id)))))));
alter policy fx_insert on public.fx_rates with check (((org_id = (select app.me_org())) AND (select app.has_role(VARIADIC ARRAY['super_admin'::app_role, 'admin'::app_role, 'responsabile'::app_role]))));
alter policy fx_select on public.fx_rates using ((org_id = (select app.me_org())));
alter policy fx_update on public.fx_rates using (((org_id = (select app.me_org())) AND (select app.has_role(VARIADIC ARRAY['super_admin'::app_role, 'admin'::app_role, 'responsabile'::app_role])))) with check ((org_id = (select app.me_org())));
alter policy grants_select on public.grants using ((org_id = (select app.me_org())));
alter policy grants_update on public.grants using (((org_id = (select app.me_org())) AND (select app.has_role(VARIADIC ARRAY['super_admin'::app_role, 'admin'::app_role, 'responsabile'::app_role])))) with check ((org_id = (select app.me_org())));
alter policy grants_write on public.grants with check (((org_id = (select app.me_org())) AND (select app.has_role(VARIADIC ARRAY['super_admin'::app_role, 'admin'::app_role, 'responsabile'::app_role]))));
alter policy movement_documents_select on public.movement_documents using (((org_id = (select app.me_org())) AND (EXISTS ( SELECT 1
   FROM movements m
  WHERE ((m.id = movement_documents.movement_id))))));
alter policy org_select on public.organizations using ((id = (select app.me_org())));
alter policy payment_methods_insert on public.payment_methods with check (((org_id = (select app.me_org())) AND (select app.has_role(VARIADIC ARRAY['super_admin'::app_role, 'admin'::app_role]))));
alter policy payment_methods_select on public.payment_methods using ((org_id = (select app.me_org())));
alter policy payment_methods_update on public.payment_methods using (((org_id = (select app.me_org())) AND (select app.has_role(VARIADIC ARRAY['super_admin'::app_role, 'admin'::app_role])))) with check (((org_id = (select app.me_org())) AND (select app.has_role(VARIADIC ARRAY['super_admin'::app_role, 'admin'::app_role]))));
alter policy periods_select on public.periods using ((org_id = (select app.me_org())));
alter policy profiles_select on public.profiles using (((org_id = (select app.me_org())) AND ((id = ( SELECT auth.uid() AS uid)) OR (select app.has_role(VARIADIC ARRAY['super_admin'::app_role, 'admin'::app_role, 'responsabile'::app_role])))));
alter policy project_members_select on public.project_members using (((org_id = (select app.me_org())) AND ((user_id = ( SELECT auth.uid() AS uid)) OR (select app.has_role(VARIADIC ARRAY['super_admin'::app_role, 'admin'::app_role, 'responsabile'::app_role])))));
alter policy projects_insert on public.projects with check (((org_id = (select app.me_org())) AND (select app.has_role(VARIADIC ARRAY['super_admin'::app_role, 'admin'::app_role]))));
alter policy projects_select on public.projects using ((org_id = (select app.me_org())));
alter policy projects_update on public.projects using (((org_id = (select app.me_org())) AND (select app.has_role(VARIADIC ARRAY['super_admin'::app_role, 'admin'::app_role])))) with check (((org_id = (select app.me_org())) AND (select app.has_role(VARIADIC ARRAY['super_admin'::app_role, 'admin'::app_role]))));
alter policy rec_items_select on public.reconciliation_items using ((org_id = (select app.me_org())));
alter policy report_lines_insert on public.report_lines with check (((org_id = (select app.me_org())) AND (select app.has_role(VARIADIC ARRAY['super_admin'::app_role, 'admin'::app_role]))));
alter policy report_lines_select on public.report_lines using ((org_id = (select app.me_org())));
alter policy report_lines_update on public.report_lines using (((org_id = (select app.me_org())) AND (select app.has_role(VARIADIC ARRAY['super_admin'::app_role, 'admin'::app_role])))) with check (((org_id = (select app.me_org())) AND (select app.has_role(VARIADIC ARRAY['super_admin'::app_role, 'admin'::app_role]))));
alter policy self_certs_select on public.self_certs using (((org_id = ( SELECT app.me_org() AS me_org)) AND (EXISTS ( SELECT 1
   FROM movements m
  WHERE ((m.id = self_certs.movement_id))))));
alter policy settings_select on public.settings using ((org_id = (select app.me_org())));
alter policy settings_write on public.settings using (((org_id = (select app.me_org())) AND (select app.has_role(VARIADIC ARRAY['super_admin'::app_role, 'admin'::app_role])))) with check (((org_id = (select app.me_org())) AND (select app.has_role(VARIADIC ARRAY['super_admin'::app_role, 'admin'::app_role]))));
alter policy sync_select on public.sync_log using (((org_id = (select app.me_org())) AND ((user_id = ( SELECT auth.uid() AS uid)) OR (select app.has_role(VARIADIC ARRAY['super_admin'::app_role, 'admin'::app_role])))));

drop policy movements_select on public.movements;
create policy movements_select on public.movements for select to authenticated using (
  org_id = (select app.me_org()) and (
       (select app.has_role('super_admin','admin','responsabile'))
    or ((select app.has_role('read_only')) and status <> 'draft')
    or ((select app.has_role('operator')) and (created_by = (select auth.uid()) or (status <> 'draft' and app.can_see_project(project_id))))));

