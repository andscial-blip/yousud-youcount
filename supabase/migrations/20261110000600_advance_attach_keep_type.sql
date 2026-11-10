-- Anticipi: allegare un documento non cambia più il suo tipo. Il file si registra già come «estimate» o «delivery_receipt»;
-- se era già archiviato (stesso file), resta com'era: un giustificativo di spesa non deve sparire dall'archivio.
create or replace function public.advance_attach(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_org uuid := app.me_org(); v_r public.advance_requests; v_doc uuid := nullif(p->>'document_id', '')::uuid; v_kind text := p->>'kind';
begin
  select * into v_r from public.advance_requests where id = nullif(p->>'id', '')::uuid and org_id = v_org for update;
  if not found then perform app.fail('not_found', 'richiesta'); end if;
  if not exists (select 1 from public.documents where id = v_doc and org_id = v_org) then perform app.fail('not_found', 'documento'); end if;
  if v_kind = 'estimate' then
    if not (v_r.requested_by = auth.uid() or app.has_role('super_admin','admin','responsabile')) then perform app.fail('forbidden'); end if;
    if v_r.status not in ('requested','authorized') then perform app.fail('invalid', 'il preventivo si allega prima della consegna'); end if;
    update public.advance_requests set estimate_document_id = v_doc, updated_at = now() where id = v_r.id returning * into v_r;
  elsif v_kind = 'delivery' then
    if not app.has_role('super_admin','admin','responsabile') then perform app.fail('forbidden', 'solo admin o responsabile'); end if;
    if v_r.status not in ('delivered','reported','closed') then perform app.fail('invalid', 'prima si registra la consegna'); end if;
    update public.advance_requests set delivery_document_id = v_doc, updated_at = now() where id = v_r.id returning * into v_r;
  else
    perform app.fail('invalid', 'tipo di allegato');
  end if;
  return to_jsonb(v_r);
end $$;
revoke all on function public.advance_attach(jsonb) from public, anon;
grant execute on function public.advance_attach(jsonb) to authenticated;
