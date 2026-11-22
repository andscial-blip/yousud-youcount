-- V2 (diciottesimo giro): l'operatore prepara le bozze, ma emette (numero definitivo, firma dell'ente) solo quietanze
-- e autocertificazioni. Ricevute per erogazioni liberali, notule, dichiarazioni, autorizzazioni ecc. le emette un responsabile.
create or replace function public.issued_doc_issue(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_d public.issued_docs; v_n int; v_y int;
begin
  if app.me_role() is null or app.has_role('read_only') then perform app.fail('forbidden'); end if;
  select * into v_d from public.issued_docs where id = p_id and org_id = app.me_org() for update;
  if not found then perform app.fail('not_found', 'documento'); end if;
  if not app.is_staff() and v_d.created_by <> auth.uid() then perform app.fail('forbidden'); end if;
  if app.has_role('operator') and v_d.type not in ('QUI', 'AUT') then
    perform app.fail('forbidden', 'questo documento lo emette un responsabile o un amministratore');
  end if;
  if v_d.status <> 'draft' then return to_jsonb(v_d); end if;
  if v_d.party_name is null then perform app.fail('invalid', 'manca la controparte'); end if;
  if coalesce(v_d.amount, 0) <= 0 then perform app.fail('invalid', 'manca l''importo'); end if;
  v_y := extract(year from v_d.doc_date)::int;
  insert into app.doc_counters(org_id, kind, year, last) values (v_d.org_id, v_d.type, v_y, 1)
  on conflict (org_id, kind, year) do update set last = app.doc_counters.last + 1 returning last into v_n;
  update public.issued_docs set status = 'issued', number = v_d.type || '-' || v_y || '-' || lpad(v_n::text, 3, '0'),
    issued_at = now(), issued_by = auth.uid(), updated_at = now()
  where id = p_id returning * into v_d;
  return to_jsonb(v_d);
end $$;
