-- 25/11: il PDF della foto non si crea più sul telefono (invio lento): lo crea il server dopo la registrazione e lo collega qui.
-- Si può solo aggiungere un PDF mancante (mai sostituire), nella cartella dell'ente, da chi ha caricato il file o da un responsabile.
create or replace function public.document_attach_pdf(p_id uuid, p_path text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_d public.documents;
begin
  if app.me_role() is null or app.has_role('read_only') then perform app.fail('forbidden'); end if;
  select * into v_d from public.documents where id = p_id and org_id = app.me_org() for update;
  if not found then perform app.fail('not_found', 'documento'); end if;
  if v_d.pdf_path is not null then return jsonb_build_object('outcome', 'already', 'pdf_path', v_d.pdf_path); end if;
  if not (app.has_role('super_admin','admin','responsabile') or v_d.uploaded_by = auth.uid()) then perform app.fail('forbidden'); end if;
  if p_path not like app.me_org()::text || '/%' or p_path not like '%.pdf' then perform app.fail('invalid', 'percorso del PDF'); end if;
  update public.documents set pdf_path = p_path, updated_at = now() where id = p_id;
  return jsonb_build_object('outcome', 'applied', 'pdf_path', p_path);
end $$;
revoke all on function public.document_attach_pdf(uuid, text) from public, anon;
grant execute on function public.document_attach_pdf(uuid, text) to authenticated;
