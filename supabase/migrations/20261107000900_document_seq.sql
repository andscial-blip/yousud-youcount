-- 0900 · Numero d'ordine dei giustificativi di un movimento
-- Serve a dare a ogni file un nome che corrisponde al movimento: MOV-2026-003, MOV-2026-003_2, ...
-- Il file nell'archivio non si rinomina (resta immutabile con la sua impronta SHA-256):
-- il nome si usa in elenco, apertura, download ed esportazioni.
alter table public.movement_documents add column seq integer;

update public.movement_documents md set seq = x.n
from (select movement_id, document_id,
             row_number() over (partition by movement_id order by created_at, document_id) as n
      from public.movement_documents) x
where x.movement_id = md.movement_id and x.document_id = md.document_id;

alter table public.movement_documents alter column seq set not null;

create or replace function app.movement_documents_seq() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext(new.movement_id::text));
  select coalesce(max(md.seq), 0) + 1 into new.seq
  from public.movement_documents md where md.movement_id = new.movement_id;
  return new;
end $$;
revoke execute on function app.movement_documents_seq() from public, anon, authenticated;

create trigger movement_documents_seq before insert on public.movement_documents
  for each row execute function app.movement_documents_seq();
