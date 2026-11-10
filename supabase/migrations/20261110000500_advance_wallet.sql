-- Anticipi, concept B (scelta del 10/11): portafoglio della persona.
-- Alla richiesta si allega il preventivo o la stima; alla consegna si archivia la ricevuta di consegna firmata.
-- Sono documenti dell'anticipo, non giustificativi di spesa: tipi propri, esclusi dall'archivio dei giustificativi.

alter table public.documents drop constraint if exists documents_doc_type_check;
alter table public.documents add constraint documents_doc_type_check
  check (doc_type in ('invoice','receipt','till_receipt','self_cert','bank_statement','contract','other','statement','estimate','delivery_receipt'));

alter table public.advance_requests add column if not exists estimate_document_id uuid references public.documents(id) on delete set null;
alter table public.advance_requests add column if not exists delivery_document_id uuid references public.documents(id) on delete set null;
create index if not exists advance_requests_estimate_idx on public.advance_requests(estimate_document_id) where estimate_document_id is not null;
create index if not exists advance_requests_delivery_doc_idx on public.advance_requests(delivery_document_id) where delivery_document_id is not null;

-- Collega un documento a una richiesta: il preventivo (chi ha chiesto o un responsabile, finché non è consegnata)
-- o la ricevuta di consegna firmata (responsabile o amministratore, dopo la consegna).
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
    update public.documents set doc_type = 'estimate' where id = v_doc and doc_type in ('other','receipt','invoice');
    update public.advance_requests set estimate_document_id = v_doc, updated_at = now() where id = v_r.id returning * into v_r;
  elsif v_kind = 'delivery' then
    if not app.has_role('super_admin','admin','responsabile') then perform app.fail('forbidden', 'solo admin o responsabile'); end if;
    if v_r.status not in ('delivered','reported','closed') then perform app.fail('invalid', 'prima si registra la consegna'); end if;
    update public.documents set doc_type = 'delivery_receipt' where id = v_doc and doc_type in ('other','receipt','invoice');
    update public.advance_requests set delivery_document_id = v_doc, updated_at = now() where id = v_r.id returning * into v_r;
  else
    perform app.fail('invalid', 'tipo di allegato');
  end if;
  return to_jsonb(v_r);
end $$;
revoke all on function public.advance_attach(jsonb) from public, anon;
grant execute on function public.advance_attach(jsonb) to authenticated;
